/**
 * GET /api/dashboard
 * Consolidated payload for the Admin dashboard: summary counts, the live
 * attendance table, group management data, leave management data, agents on
 * leave today, credits and hours-by-group — all in a single round-trip.
 */
import {
  activeEmployees,
  aggregateHoursByGroup,
  buildActiveSlots,
  buildEmployeeScheduleIndex,
  buildGroupMemberMap,
  buildScheduledLateThresholds,
  loadApprovedLeaveOverlapping,
  loadAttendanceSnapshot,
  loadCredits,
  loadEmployees,
  loadGroups,
  loadLeaveRequests,
  loadSchedule,
} from "../../../lib/admin";
import { fail, ok, todayISO } from "../../../lib/utils";
import { requireAdminOrManager } from "../../../lib/serverAuth";

export async function GET(request) {
  if (!(await requireAdminOrManager(request))) return fail("Unauthorized", 401);
  try {
    const today = todayISO();

    const [employees, groups, schedule] = await Promise.all([
      loadEmployees(),
      loadGroups(),
      loadSchedule(),
    ]);
    const activeSlots = buildActiveSlots(schedule);
    const scheduleByDate = buildEmployeeScheduleIndex(activeSlots, groups);

    const [{ onLeave, agents }, snapshot, leaveRequests, credits] = await Promise.all([
      loadApprovedLeaveOverlapping(today),
      loadAttendanceSnapshot(
        buildScheduledLateThresholds(groups, activeSlots, today),
        scheduleByDate
      ),
      loadLeaveRequests(employees),
      loadCredits(activeEmployees(employees)),
    ]);

    const workers = activeEmployees(employees);
    const groupMap = buildGroupMemberMap(groups);
    const groupTimes = new Map();
    for (const group of groups) {
      for (const employeeId of group.memberIds) {
        if (!groupTimes.has(employeeId)) {
          groupTimes.set(employeeId, {
            startTime: group.startTime,
            endTime: group.endTime,
          });
        }
      }
    }
    const monthTotals = snapshot.monthTotals;
    const attendanceMap = snapshot.todayMap;
    const roster = new Map(employees.map((employee) => [employee.employeeId, employee.name]));

    const scheduledToday = new Set(
      workers
        .map((employee) => scheduleByDate.get(employee.employeeId)?.get(today))
        .map((hours, index) => (hours && hours.size ? workers[index].employeeId : null))
        .filter(Boolean)
    );

    const presentToday = [...attendanceMap.keys()].filter((id) => scheduledToday.has(id)).length;
    const onLeaveToday = [...onLeave].filter((id) => scheduledToday.has(id)).length;
    const absentToday = Math.max(0, scheduledToday.size - presentToday - onLeaveToday);

    const entries = workers
      .filter((employee) => scheduledToday.has(employee.employeeId))
      .map((employee) => {
        const attendance = attendanceMap.get(employee.employeeId);
        let status = "Absent";
        if (onLeave.has(employee.employeeId)) status = "On Leave";
        else if (attendance) status = attendance.late ? "Late" : "Present";

        return {
          employeeId: employee.employeeId,
          name: employee.name,
          extension: employee.extension,
          group: groupMap.get(employee.employeeId) || "—",
          status,
          clockIn: attendance?.clockIn ?? "",
          clockOut: attendance?.clockOut ?? "",
          hoursWorked: attendance?.hoursWorked ?? 0,
        };
      });

    const groupsPayload = groups.map((group) => ({
      groupId: group.groupId,
      name: group.name,
      startTime: group.startTime,
      endTime: group.endTime,
      memberIds: group.memberIds,
      members: group.memberIds
        .map((employeeId) => ({ employeeId, name: roster.get(employeeId) || employeeId }))
        .filter((member) => workers.some((employee) => employee.employeeId === member.employeeId)),
    }));

    const employeesPayload = workers.map(({ employeeId, name, extension }) => {
      const times = groupTimes.get(employeeId);
      return {
        employeeId,
        name,
        extension,
        startTime: times?.startTime ?? "",
        endTime: times?.endTime ?? "",
      };
    });

    const hoursByGroup = aggregateHoursByGroup(groups, monthTotals, workers);

    return ok({
      date: today,
      summary: {
        totalWorkers: workers.length,
        presentToday,
        absentToday,
        onLeaveToday,
      },
      attendance: {
        entries,
        summary: {
          present: entries.filter((entry) => entry.status === "Present").length,
          late: entries.filter((entry) => entry.status === "Late").length,
          absent: entries.filter((entry) => entry.status === "Absent").length,
          onLeave: entries.filter((entry) => entry.status === "On Leave").length,
        },
      },
      groups: {
        groups: groupsPayload,
        employees: employeesPayload,
      },
      leave: { requests: leaveRequests },
      leaveToday: {
        agents: agents.map((agent) => ({
          employeeId: agent.employeeId,
          name: roster.get(agent.employeeId) || agent.employeeId,
          leaveType: agent.leaveType,
          returnDate: agent.returnDate,
        })),
      },
      credits: { credits },
      hours: hoursByGroup,
    });
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return fail("Internal server error");
  }
}