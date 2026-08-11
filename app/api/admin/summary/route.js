/**
 * GET /api/admin/summary
 * Top-row counts for the Admin dashboard: total workers, present, absent and
 * on leave today.
 * Response: { date, totalWorkers, presentToday, absentToday, onLeaveToday }
 */
import {
  activeEmployees,
  buildScheduleMap,
  buildScheduledLateThresholds,
  loadApprovedLeaveOverlapping,
  loadEmployees,
  loadGroups,
  loadSchedule,
  loadTodayAttendance,
} from "../../../../lib/admin";
import { fail, ok, todayISO } from "../../../../lib/utils";

export async function GET() {
  try {
    const [employees, groups, schedule, { onLeave }] = await Promise.all([
      loadEmployees(),
      loadGroups(),
      loadSchedule(),
      loadApprovedLeaveOverlapping(todayISO()),
    ]);

    const workers = activeEmployees(employees);
    const todayThresholds = buildScheduledLateThresholds(
      groups,
      buildScheduleMap(schedule),
      todayISO()
    );
    const attendanceMap = await loadTodayAttendance(todayThresholds);
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