/**
 * POST /api/clock-in
 * Register an employee's clock-in for today.
 * Rejects with 409 if the employee has already clocked in today.
 * Body: { employeeId }
 */
import { COLS, COLUMN_LETTERS, SHEETS, appendRow, getSheetData } from "../../../lib/googleSheets";
import { fail, nowISO, ok, readBody, todayISO } from "../../../lib/utils";

export async function POST(request) {
  try {
    const { employeeId } = await readBody(request);
    if (!employeeId) {
      return fail("employeeId is required", 400);
    }

    const date = todayISO();
    const clockIn = nowISO();

    // Only the columns needed for the duplicate check: date + employee id.
    const log = await getSheetData(SHEETS.attendanceLog, "A1:B");

    const alreadyClockedIn = log.some(
      (row) =>
        String(row[COLS.attendance.date]).trim() === date &&
        String(row[COLS.attendance.employeeId]).trim() === String(employeeId).trim()
    );

    if (alreadyClockedIn) {
      return fail("You have already clocked in today", 409);
    }

    const result = await appendRow(SHEETS.attendanceLog, [
      date,                 // A: Date
      String(employeeId),   // B: Employee_ID
      clockIn,              // C: Clock_In
      "",                   // D: Clock_Out (filled by clock-out)
      "",                   // E: Hours_Worked
      "",                   // F: Late
      "",                   // G: Notes
    ]);

    return ok(
      {
        employeeId,
        date,
        clockIn,
        clockInColumn: COLUMN_LETTERS.attendance.clockIn,
        rowNumber: result.rowNumber,
      },
      201
    );
  } catch (error) {
    console.error("[POST /api/clock-in]", error);
    return fail("Internal server error");
  }
}