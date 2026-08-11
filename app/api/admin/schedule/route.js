/**
 * /api/admin/schedule
 *
 * GET  -> { groupId, month, days } for one group's monthly schedule.
 *         days: [{ date, startTime, endTime }] for scheduled days plus
 *               [{ date, off: true }] for days with no shift (off / not working).
 * PUT  -> Replace a group's schedule for a month.
 *         Body: { groupId, month, pattern?, overrides? }
 *           pattern?:  { weekdays: number[] (0=Sun..6=Sat), startTime, endTime }
 *           overrides?: [{ date, startTime, endTime }] — empty startTime = day off.
 *         Pattern fills the matching weekdays, then overrides win; days with no
 *         entry anywhere are off.
 */
import {
  COLS,
  SHEETS,
  appendRow,
  clearRow,
  findRows,
} from "../../../../lib/googleSheets";
import { fail, ok, readBody } from "../../../../lib/utils";

const SCHEDULE_COLS = "A1:D";

const clean = (value) => String(value ?? "").trim();

function isValidTime(value) {
  if (value === null || value === undefined) return false;
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(clean(value));
}

/** All "YYYY-MM-DD" dates inside a "YYYY-MM" month. */
function monthDates(month) {
  const [year, monthNumber] = String(month).split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return [];
  }
  const pad2 = (value) => String(value).padStart(2, "0");
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return `${year}-${pad2(monthNumber)}-${pad2(day)}`;
  });
}

function isISOMonth(value) {
  return /^\d{4}-\d{2}$/.test(String(value ?? ""));
}

/** Read a group's current schedule rows for a month (used only for clearing). */
async function loadMonthRows(groupId, month) {
  const matches = await findRows(SHEETS.schedule, SCHEDULE_COLS, (row) => {
    if (clean(row[COLS.schedule.groupId]) !== groupId) return false;
    return String(row[COLS.schedule.date]).startsWith(month);
  });
  return { matches };
}

/** Build the GET/PUT response shape for a group + month from a date->shift map. */
function shapeMonth(groupId, month, shiftByDate) {
  return monthDates(month).map((date) => {
    const shift = shiftByDate.get(date);
    if (!shift || !shift.startTime) return { date, off: true };
    return { date, startTime: shift.startTime, endTime: shift.endTime };
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = clean(searchParams.get("groupId"));
    const month = clean(searchParams.get("month"));

    if (!groupId || !isISOMonth(month)) {
      return fail("groupId and month (YYYY-MM) are required", 400);
    }

    const { matches } = await loadMonthRows(groupId, month);
    const map = new Map();
    for (const { record } of matches) {
      const date = clean(record[COLS.schedule.date]);
      const startTime = clean(record[COLS.schedule.startTime]);
      if (date) {
        map.set(date, startTime ? { startTime, endTime: clean(record[COLS.schedule.endTime]) } : null);
      }
    }

    return ok({ groupId, month, days: shapeMonth(groupId, month, map) });
  } catch (error) {
    console.error("[GET /api/admin/schedule]", error);
    return fail("Internal server error");
  }
}

export async function PUT(request) {
  try {
    const body = await readBody(request);
    const groupId = clean(body.groupId);
    const month = clean(body.month);

    if (!groupId || !isISOMonth(month)) {
      return fail("groupId and month (YYYY-MM) are required", 400);
    }

    // Replace the whole month: drop every existing row, then rebuild the
    // month purely from the pattern + overrides sent in this request.
    const { matches } = await loadMonthRows(groupId, month);
    for (const { rowNumber } of matches) {
      await clearRow(SHEETS.schedule, rowNumber, "D");
    }
    const map = new Map();

    // 1) Apply the repeating pattern (fill matching weekdays).
    const pattern = body.pattern;
    if (
      pattern &&
      Array.isArray(pattern.weekdays) &&
      pattern.weekdays.length &&
      isValidTime(pattern.startTime)
    ) {
      const weekdays = new Set(pattern.weekdays.map(Number));
      for (const date of monthDates(month)) {
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
        if (weekdays.has(dow)) {
          map.set(date, {
            startTime: clean(pattern.startTime),
            endTime: isValidTime(pattern.endTime) ? clean(pattern.endTime) : "",
          });
        }
      }
    }

    // 2) Apply per-day overrides (blank start = day off, overrides remove pattern).
    if (Array.isArray(body.overrides)) {
      for (const override of body.overrides) {
        const date = clean(override?.date);
        if (!monthDates(month).includes(date)) continue;
        if (isValidTime(override?.startTime)) {
          map.set(date, {
            startTime: clean(override.startTime),
            endTime: isValidTime(override?.endTime) ? clean(override.endTime) : "",
          });
        } else {
          map.set(date, null);
        }
      }
    }

    // Never keep explicit off/null markers (they mean "no row").
    const rows = [];
    for (const [date, shift] of map) {
      if (shift && shift.startTime) {
        rows.push([groupId, date, shift.startTime, shift.endTime]);
      }
    }
    rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

    if (rows.length) {
      await appendRow(SHEETS.schedule, rows);
    }

    const finalMap = new Map();
    for (const row of rows) finalMap.set(row[1], { startTime: row[2], endTime: row[3] });

    return ok({
      groupId,
      month,
      days: shapeMonth(groupId, month, finalMap),
    });
  } catch (error) {
    console.error("[PUT /api/admin/schedule]", error);
    return fail("Internal server error");
  }
}