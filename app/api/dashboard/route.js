/**
 * GET /api/dashboard
 * Returns summary metrics for today.
 */
import { COLS, SHEETS, getSheetData } from "../../../lib/googleSheets";
import { SHIFT_START_MINUTES, durationHours, fail, ok, toMinutes, todayISO } from "../../../lib/utils";

export async function GET() {
  try {
    // Fetch both sheets in parallel (single round-trip each, limited columns).
    const [employees, attendance] = await Promise.all([
      getSheetData(SHEETS.employees, "A1:F"),
      getSheetData(SHEETS.attendanceLog, "A1:F"),
    ]);

    const today = todayISO();

    const todaysRows = attendance.filter(
      (row) => String(row[COLS.attendance.date]).trim() === today
    );

    const presentToday = todaysRows.length;

    const lateToday = todaysRows.filter((row) => {
      const minutes = toMinutes(row[COLS.attendance.clockIn]);
      return minutes !== null && minutes > SHIFT_START_MINUTES;
    }).length;

    const totalHoursWorkedToday = todaysRows.reduce((sum, row) => {
      // Prefer the sheet's own Hours_Worked value, else compute from timestamps.
      const stored = Number(row[COLS.attendance.hoursWorked]);
      if (Number.isFinite(stored) && stored > 0) {
        return sum + stored;
      }
      return (
        sum +
        durationHours(
          row[COLS.attendance.clockIn],
          row[COLS.attendance.clockOut]
        )
      );
    }, 0);

    return ok({
      totalEmployees: employees.length,
      presentToday,
      lateToday,
      totalHoursToday: Math.round(totalHoursWorkedToday * 100) / 100,
    });
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return fail("Internal server error");
  }
}