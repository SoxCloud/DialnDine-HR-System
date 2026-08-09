/**
 * GET /api/attendance-status
 * Returns today's attendance row for an employee.
 * ?employeeId=164  — or ?extension=164 for the kiosk.
 * Response: { employeeId, extension, date, clockIn, clockOut, status }
 *   status: "none" | "clocked_in" | "completed"
 */
import { COLS, SHEETS, findRows } from "../../../lib/googleSheets";
import { findEmployeeById, findEmployeeByExtension } from "../../../lib/employees";
import { fail, ok, todayISO } from "../../../lib/utils";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeIdQuery = (searchParams.get("employeeId") || "").trim();
    const extension = (searchParams.get("extension") || "").trim();

    if (!employeeIdQuery && !extension) {
      return fail("employeeId or extension is required", 400);
    }

    const employee = employeeIdQuery
      ? await findEmployeeById(employeeIdQuery)
      : await findEmployeeByExtension(extension);
    if (!employee) {
      return fail("No employee found", 404);
    }

    const employeeId = String(employee[COLS.employees.employeeId]).trim();
    const date = todayISO();

    const matches = await findRows(SHEETS.attendanceLog, "A1:F", (row) => {
      const matchesEmployee =
        String(row[COLS.attendance.employeeId]).trim() === employeeId;
      const matchesDate = String(row[COLS.attendance.date]).trim() === date;
      return matchesEmployee && matchesDate;
    });

    // The clock-in guard prevents duplicates, so at most one row exists.
    const target = matches[matches.length - 1];

    const clockIn = target?.record[COLS.attendance.clockIn] ?? "";
    const clockOut = target?.record[COLS.attendance.clockOut] ?? "";

    const status = clockIn ? (clockOut ? "completed" : "clocked_in") : "none";

    return ok({
      employeeId,
      extension,
      date,
      clockIn,
      clockOut,
      status,
      rowNumber: target?.rowNumber ?? null,
    });
  } catch (error) {
    console.error("[GET /api/attendance-status]", error);
    return fail("Internal server error");
  }
}