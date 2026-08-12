/**
 * lib/schedule.js
 *
 * Time-slot schedule primitives shared by the admin schedule routes.
 *
 * A schedule is a set of ACTIVE cells: (date, hour, groupId). A group is
 * active from hour H:00 to H+1:00. Absent cells are inactive (off).
 */
import { COLS, SHEETS, appendRow, clearRow, findRows } from "./googleSheets";
import { isISODate, toMinutes } from "./utils";

const SCHEDULE_COLS = "A1:C";

/** Hourly slots 08:00..22:00 (15 slots). */
export const SLOT_HOURS = Array.from({ length: 15 }, (_, index) => index + 8);

const pad2 = (value) => String(value).padStart(2, "0");

const clean = (value) => String(value ?? "").trim();

export function isSlotHour(hour) {
  return Number.isInteger(hour) && hour >= SLOT_HOURS[0] && hour <= SLOT_HOURS[SLOT_HOURS.length - 1];
}

/** "HH:00" for a slot hour. */
export function timeForHour(hour) {
  return `${pad2(hour)}:00`;
}

/** Hour for a stored "HH:00" time, or null when not an hourly slot. */
export function hourForTime(time) {
  const minutes = toMinutes(time);
  if (minutes === null || minutes % 60 !== 0) return null;
  const hour = minutes / 60;
  return isSlotHour(hour) ? hour : null;
}

/** Active cells for one date: [{ groupId, hour }] sorted by group then hour. */
export async function readCellsForDate(date) {
  const matches = await findRows(SHEETS.schedule, SCHEDULE_COLS, (row) =>
    clean(row[COLS.schedule.date]) === date
  );

  const cells = [];
  for (const { record } of matches) {
    const hour = hourForTime(record[COLS.schedule.time]);
    const groupId = clean(record[COLS.schedule.groupId]);
    if (hour !== null && groupId) cells.push({ groupId, hour });
  }
  cells.sort((a, b) => a.groupId.localeCompare(b.groupId) || a.hour - b.hour);
  return cells;
}

/**
 * Replace a date's active cells. Every existing row for the date is cleared,
 * then the supplied cells are written (deduped). Returns the number written.
 */
export async function writeCellsForDate(date, cells) {
  const matches = await findRows(SHEETS.schedule, SCHEDULE_COLS, (row) =>
    clean(row[COLS.schedule.date]) === date
  );
  for (const { rowNumber } of matches) {
    await clearRow(SHEETS.schedule, rowNumber, "C");
  }

  const seen = new Set();
  const rows = [];
  for (const cell of cells || []) {
    const hour = Number(cell?.hour);
    const groupId = clean(cell?.groupId);
    if (!groupId || !isSlotHour(hour)) continue;
    const key = `${groupId}|${hour}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push([date, timeForHour(hour), groupId]);
  }

  if (rows.length) {
    await appendRow(SHEETS.schedule, rows);
  }
  return rows.length;
}

/** "YYYY-MM-DD" dates inside a "YYYY-MM" month. */
export function monthDates(month) {
  const [year, monthNumber] = String(month).split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return [];
  }
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return `${year}-${pad2(monthNumber)}-${pad2(day)}`;
  });
}

export function isISOMonth(value) {
  return /^\d{4}-\d{2}$/.test(String(value ?? ""));
}

export function isSlotDate(value) {
  return isISODate(value);
}
