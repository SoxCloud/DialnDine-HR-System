/**
 * POST /api/clock-out
 * Close today's open attendance row (the one without a Clock_Out).
 * Body: { employeeId }  — or { extension } for backwards compatibility.
 */
import { COLUMN_LETTERS, COLS, SHEETS, findRows, getClockEnabled, updateRow } from "../../../lib/googleSheets";
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
    const clockOut = nowISO();

    // Find today's record(s) for this agent with no Clock_Out yet.
    const openRows = await findRows(SHEETS.attendanceLog, "A1:D", (row) => {
      const matchesEmployee =
        String(row[COLS.attendance.employeeId]).trim() === employeeId;
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
      extension: employeeExtension,
      date,
      clockOut,
      rowNumber,
    });
  } catch (error) {
    console.error("[POST /api/clock-out]", error);
    return fail("Internal server error");
  }
}