/**
 * POST /api/clock-in
 * Register an employee's clock-in for today.
 * Rejects with 409 if the employee has already clocked in today.
 * Body: { employeeId }  — or { extension } for backwards compatibility.
 */
import { COLUMN_LETTERS, COLS, SHEETS, appendRow, getClockEnabled, getSheetData } from "../../../lib/googleSheets";
import { findEmployeeById, findEmployeeByExtension } from "../../../lib/employees";
import { fail, nowISO, ok, readBody, todayISO } from "../../../lib/utils";

export async function POST(request) {
  try {
    // Server-side gate: clocking must be enabled (cannot be bypassed by the client).
    if (!(await getClockEnabled())) {
      return fail("Clocking is currently disabled", 403);
    }

    const { employeeId: bodyEmployeeId, extension } = await readBody(request);

    const employee = bodyEmployeeId
      ? await findEmployeeById(bodyEmployeeId)
      : await findEmployeeByExtension(extension);
    if (!employee) {
      return fail("No employee found", 404);
    }

    const employeeId = String(employee[COLS.employees.employeeId]).trim();
    const employeeExtension = String(employee[COLS.employees.extension] ?? "").trim();
    const date = todayISO();
    const clockIn = nowISO();

    // Only the columns needed for the duplicate check: date + employee id.
    const log = await getSheetData(SHEETS.attendanceLog, "A1:B");

    const alreadyClockedIn = log.some(
      (row) =>
        String(row[COLS.attendance.date]).trim() === date &&
        String(row[COLS.attendance.employeeId]).trim() === employeeId
    );

    if (alreadyClockedIn) {
      return fail("This employee has already clocked in today", 409);
    }

    // Append only A..C — the Hours_Worked / Late columns hold live sheet
    // formulas that must not be overwritten. Clock-out fills column D later.
    const result = await appendRow(SHEETS.attendanceLog, [
      date,                 // A: Date
      employeeId,           // B: Employee_ID
      clockIn,              // C: Clock_In
    ]);

    return ok(
      {
        employeeId,
        extension: employeeExtension,
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