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

export async function GET() {
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
    const monthTotals = snapshot.monthTotals;
    const attendanceMap = snapshot.todayMap;
    const roster = new Map(employees.map((employee) => [employee.employeeId, employee.name]));

    const presentToday = attendanceMap.size;
    const onLeaveToday = onLeave.size;
    const absentToday = Math.max(0, workers.length - presentToday - onLeaveToday);

    const entries = workers.map((employee) => {
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

    const employeesPayload = workers.map(({ employeeId, name, extension }) => ({
      employeeId,
      name,
      extension,
    }));

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