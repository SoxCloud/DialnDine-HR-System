/**
 * POST /api/clock-out
 * Close today's open attendance row (the one without a Clock_Out).
 * Body: { employeeId }
 */
import { COLUMN_LETTERS, COLS, SHEETS, findRows, updateRow } from "../../../lib/googleSheets";
import { fail, nowISO, ok, readBody, todayISO } from "../../../lib/utils";

export async function POST(request) {
  try {
    const { employeeId } = await readBody(request);
    if (!employeeId) {
      return fail("employeeId is required", 400);
    }

    const date = todayISO();
    const clockOut = nowISO();

    // Find today's record(s) for this employee with no Clock_Out yet.
    const openRows = await findRows(SHEETS.attendanceLog, "A1:D", (row) => {
      const matchesEmployee =
        String(row[COLS.attendance.employeeId]).trim() === String(employeeId).trim();
      const matchesDate = String(row[COLS.attendance.date]).trim() === date;
      const hasNoClockOut = String(row[COLS.attendance.clockOut] ?? "").trim() === "";
      return matchesEmployee && matchesDate && hasNoClockOut;
    });

    if (!openRows.length) {
      return fail("No open clock-in found for today", 404);
    }

    // Update the existing row only — never create a new one.
    const { rowNumber } = openRows[openRows.length - 1];
    await updateRow(SHEETS.attendanceLog, rowNumber, {
      [COLUMN_LETTERS.attendance.clockOut]: clockOut,
    });

    return ok({
      employeeId,
      date,
      clockOut,
      rowNumber,
    });
  } catch (error) {
    console.error("[POST /api/clock-out]", error);
    return fail("Internal server error");
  }
}