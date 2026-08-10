/**
 * GET /api/admin/summary
 * Top-row counts for the Admin dashboard: total workers, present, absent and
 * on leave today.
 * Response: { date, totalWorkers, presentToday, absentToday, onLeaveToday }
 */
import {
  activeEmployees,
  buildLateThresholds,
  loadApprovedLeaveOverlapping,
  loadEmployees,
  loadGroups,
  loadTodayAttendance,
} from "../../../../lib/admin";
import { fail, ok, todayISO } from "../../../../lib/utils";

export async function GET() {
  try {
    const [employees, groups, { onLeave }] = await Promise.all([
      loadEmployees(),
      loadGroups(),
      loadApprovedLeaveOverlapping(todayISO()),
    ]);

    const workers = activeEmployees(employees);
    const attendanceMap = await loadTodayAttendance(buildLateThresholds(groups));
    const presentToday = attendanceMap.size;
    const onLeaveToday = onLeave.size;
    const absentToday = Math.max(0, workers.length - presentToday - onLeaveToday);

    return ok({
      date: todayISO(),
      totalWorkers: workers.length,
      presentToday,
      absentToday,
      onLeaveToday,
    });
  } catch (error) {
    console.error("[GET /api/admin/summary]", error);
    return fail("Internal server error");
  }
}