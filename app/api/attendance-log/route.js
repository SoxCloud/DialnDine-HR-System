/**
 * GET /api/attendance-log
 * Full attendance log joined with employee names and extensions (Admin view).
 * Response: { entries: [{ date, employeeId, name, extension, clockIn, clockOut, hoursWorked, late, status }] }
 *   status: "none" | "clocked_in" | "completed"
 * Entries are newest first.
 */
import { COLS, SHEETS, getSheetData } from "../../../lib/googleSheets";
import { fail, ok } from "../../../lib/utils";

const EMPLOYEE_COLS = "A1:I";
const ATTENDANCE_COLS = "A1:G";

export async function GET() {
  try {
    const [employees, attendance] = await Promise.all([
      getSheetData(SHEETS.employees, EMPLOYEE_COLS),
      getSheetData(SHEETS.attendanceLog, ATTENDANCE_COLS),
    ]);

    const roster = new Map(
      employees.map((row) => [
        String(row[COLS.employees.employeeId] ?? "").trim(),
        {
          name: String(row[COLS.employees.fullName] ?? "").trim(),
          extension: String(row[COLS.employees.extension] ?? "").trim(),
        },
      ])
    );

    const entries = attendance
      .map((row) => {
        const employeeId = String(row[COLS.attendance.employeeId] ?? "").trim();
        const person = roster.get(employeeId) || { name: "", extension: "" };
        const clockIn = String(row[COLS.attendance.clockIn] ?? "").trim();
        const clockOut = String(row[COLS.attendance.clockOut] ?? "").trim();
        const status = clockIn ? (clockOut ? "completed" : "clocked_in") : "none";

        return {
          date: String(row[COLS.attendance.date] ?? "").trim(),
          employeeId,
          name: person.name || employeeId,
          extension: person.extension,
          clockIn,
          clockOut,
          hoursWorked: String(row[COLS.attendance.hoursWorked] ?? "").trim(),
          late: String(row[COLS.attendance.late] ?? "").trim(),
          status,
        };
      })
      .sort((a, b) => {
        const byDate = String(b.date).localeCompare(String(a.date));
        if (byDate !== 0) return byDate;
        return String(b.clockIn).localeCompare(String(a.clockIn));
      });

    return ok({ entries });
  } catch (error) {
    console.error("[GET /api/attendance-log]", error);
    return fail("Internal server error");
  }
}