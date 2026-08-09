/**
 * GET /api/attendance-status
 * Returns today's attendance row for an employee.
 * ?employeeId=A001
 * Response: { employeeId, date, clockIn, clockOut, status }
 *   status: "none" | "clocked_in" | "completed"
 */
import { COLS, SHEETS, findRows } from "../../../lib/googleSheets";
import { fail, ok, todayISO } from "../../../lib/utils";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = (searchParams.get("employeeId") || "").trim();

    if (!employeeId) {
      return fail("employeeId is required", 400);
    }

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