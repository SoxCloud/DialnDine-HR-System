/**
 * POST /api/admin/schedule/bulk
 * Copy one day's active cells onto every matching weekday within a month.
 * Body: { fromDate, month, weekdays: number[] }  (weekdays 0=Sun..6=Sat)
 */
import { isSlotDate, isISOMonth, monthDates, readCellsForDate, writeCellsForDate } from "../../../../../lib/schedule";
import { fail, ok, readBody } from "../../../../../lib/utils";

const clean = (value) => String(value ?? "").trim();

export async function POST(request) {
  try {
    const body = await readBody(request);
    const fromDate = clean(body.fromDate);
    const month = clean(body.month);
    const weekdays = body.weekdays;

    if (!isSlotDate(fromDate) || !isISOMonth(month)) {
      return fail("fromDate (YYYY-MM-DD) and month (YYYY-MM) are required", 400);
    }
    if (!Array.isArray(weekdays) || weekdays.some((day) => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6)) {
      return fail("weekdays must be an array of 0..6", 400);
    }

    const selected = new Set(weekdays.map(Number));
    const cells = await readCellsForDate(fromDate);

    const applied = [];
    let total = 0;
    for (const date of monthDates(month)) {
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (!selected.has(dow)) continue;
      const count = await writeCellsForDate(date, cells);
      total += count;
      applied.push(date);
    }

    return ok({ fromDate, month, weekdays: [...selected], applied: applied.length, cells: total });
  } catch (error) {
    console.error("[POST /api/admin/schedule/bulk]", error);
    return fail("Internal server error");
  }
}