/**
 * lib/admin.js
 *
 * Shared read helpers for the Admin dashboard API routes.
 * All helpers only ever fetch the columns they need.
 */
import { COLS, SHEETS, getOptionalSheetData, getSheetData } from "./googleSheets";
import { durationHours, SHIFT_START_MINUTES, toMinutes, todayISO } from "./utils";

const EMPLOYEE_COLS = "A1:I";
const ATTENDANCE_COLS = "A1:G";
const LEAVE_COLS = "A1:H";
const GROUP_COLS = "A1:E";
const CREDIT_COLS = "A1:C";
const SCHEDULE_COLS = "A1:D";

const clean = (value) => String(value ?? "").trim();

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Sum an attendance row's hours; prefers the sheet's Hours_Worked cell. */
function hoursFor(row) {
  const stored = toPositiveNumber(row[COLS.attendance.hoursWorked]);
  if (stored > 0) return stored;
  return durationHours(clean(row[COLS.attendance.clockIn]), clean(row[COLS.attendance.clockOut]));
}

/** All employee rows (active + inactive) with the fields the admin needs. */
export async function loadEmployees() {
  const rows = await getSheetData(SHEETS.employees, EMPLOYEE_COLS);
  return rows
    .map((row) => ({
      employeeId: clean(row[COLS.employees.employeeId]),
      name: clean(row[COLS.employees.fullName]) || clean(row[COLS.employees.employeeId]),
      extension: clean(row[COLS.employees.extension]),
      department: clean(row[COLS.employees.department]),
      status: clean(row[COLS.employees.status]),
    }))
    .filter((employee) => employee.employeeId !== "");
}

/** Active employees only (Status is not "Inactive"). */
export function activeEmployees(employees) {
  return employees.filter(
    (employee) => employee.status.toLowerCase() !== "inactive"
  );
}

/** Groups with member ids resolved from the Members cell (comma-separated). */
export async function loadGroups() {
  const rows = await getOptionalSheetData(SHEETS.groups, GROUP_COLS);
  return rows.map((row) => ({
    groupId: clean(row[COLS.groups.groupId]),
    name: clean(row[COLS.groups.name]),
    startTime: clean(row[COLS.groups.startTime]),
    endTime: clean(row[COLS.groups.endTime]),
    memberIds: String(row[COLS.groups.members] ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  }));
}

/** employeeId -> first matching group name. */
export function buildGroupMemberMap(groups) {
  const map = new Map();
  for (const group of groups) {
    for (const employeeId of group.memberIds) {
      if (!map.has(employeeId)) map.set(employeeId, group.name);
    }
  }
  return map;
}

/**
 * Map of employeeId -> their group's shift start time (minutes past midnight).
 * Ungrouped employees get no entry and fall back to the global default start.
 */
export function buildLateThresholds(groups) {
  const map = new Map();
  for (const group of groups) {
    const threshold = toMinutes(group.startTime);
    if (threshold === null) continue;
    for (const employeeId of group.memberIds) {
      if (!map.has(employeeId)) map.set(employeeId, threshold);
    }
  }
  return map;
}

/** All monthly schedule rows for every group. */
export async function loadSchedule() {
  const rows = await getOptionalSheetData(SHEETS.schedule, SCHEDULE_COLS);
  return rows.map((row) => ({
    groupId: clean(row[COLS.schedule.groupId]),
    date: clean(row[COLS.schedule.date]),
    startTime: clean(row[COLS.schedule.startTime]),
    endTime: clean(row[COLS.schedule.endTime]),
  }));
}

/**
 * Map of groupId -> (date "YYYY-MM-DD" -> { startTime, endTime }).
 * Days with no entry are off / not working.
 */
export function buildScheduleMap(schedule) {
  const map = new Map();
  for (const row of schedule) {
    if (!row.groupId) continue;
    if (!map.has(row.groupId)) map.set(row.groupId, new Map());
    if (row.date && row.startTime) {
      map.get(row.groupId).set(row.date, {
        startTime: row.startTime,
        endTime: row.endTime,
      });
    }
  }
  return map;
}

/**
 * Map of employeeId -> late threshold (minutes past midnight) for ONE date.
 * Uses that date's scheduled shift start time when the schedule has one,
 * otherwise the group's default start time. Ungrouped employees get no entry
 * and fall back to the global default start.
 */
export function buildScheduledLateThresholds(groups, scheduleMap, date) {
  const map = new Map();
  for (const group of groups) {
    const scheduledShift = scheduleMap.get(group.groupId)?.get(date);
    const threshold = toMinutes(scheduledShift?.startTime ?? group.startTime);
    if (threshold === null) continue;
    for (const employeeId of group.memberIds) {
      if (!map.has(employeeId)) map.set(employeeId, threshold);
    }
  }
  return map;
}

/** Map of employeeId -> today's attendance row (clockIn, clockOut, hours, late). */
export async function loadTodayAttendance(lateThresholds = new Map()) {
  const today = todayISO();
  const rows = await getSheetData(SHEETS.attendanceLog, ATTENDANCE_COLS);
  const map = new Map();
  for (const row of rows) {
    if (clean(row[COLS.attendance.date]) !== today) continue;
    const employeeId = clean(row[COLS.attendance.employeeId]);
    if (!employeeId) continue;
    const clockIn = clean(row[COLS.attendance.clockIn]);
    const clockInMinutes = toMinutes(clockIn);
    const threshold = lateThresholds.get(employeeId) ?? SHIFT_START_MINUTES;
    const late = clockInMinutes !== null && clockInMinutes > threshold;
    map.set(employeeId, {
      employeeId,
      clockIn,
      clockOut: clean(row[COLS.attendance.clockOut]),
      hoursWorked: hoursFor(row),
      late,
    });
  }
  return map;
}

/**
 * Approved leave overlapping a date.
 * Returns { onLeave: Set<employeeId>, agents: [{ employeeId, leaveType, returnDate }] }.
 */
export async function loadApprovedLeaveOverlapping(date) {
  const day = String(date);
  const rows = await getSheetData(SHEETS.leaveRequests, LEAVE_COLS);
  const onLeave = new Set();
  const agents = [];
  const seen = new Set();

  for (const row of rows) {
    if (clean(row[COLS.leaveRequests.status]).toLowerCase() !== "approved") continue;
    const start = clean(row[COLS.leaveRequests.startDate]);
    const end = clean(row[COLS.leaveRequests.endDate]);
    if (!start || !end) continue;
    if (day < start || day > end) continue;

    const employeeId = clean(row[COLS.leaveRequests.employeeId]);
    onLeave.add(employeeId);
    if (!seen.has(employeeId)) {
      seen.add(employeeId);
      agents.push({
        employeeId,
        leaveType: clean(row[COLS.leaveRequests.reason]) || "Leave",
        returnDate: end,
      });
    }
  }

  return { onLeave, agents };
}

/** Map of employeeId -> hours worked since the start of the current month. */
export async function loadMonthHours() {
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await getSheetData(SHEETS.attendanceLog, ATTENDANCE_COLS);
  const totals = new Map();
  for (const row of rows) {
    const date = clean(row[COLS.attendance.date]);
    if (!date || date < monthStart) continue;
    const employeeId = clean(row[COLS.attendance.employeeId]);
    if (!employeeId) continue;
    totals.set(employeeId, (totals.get(employeeId) || 0) + hoursFor(row));
  }
  return totals;
}

/**
 * Single read of Attendance_Log producing both today's map and the current
 * month's totals, so the dashboard only queries the sheet once.
 * Returns { todayMap, monthTotals }.
 */
export async function loadAttendanceSnapshot(lateThresholds = new Map()) {
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await getSheetData(SHEETS.attendanceLog, ATTENDANCE_COLS);
  const todayMap = new Map();
  const monthTotals = new Map();

  for (const row of rows) {
    const date = clean(row[COLS.attendance.date]);
    const employeeId = clean(row[COLS.attendance.employeeId]);
    if (!date || !employeeId) continue;

    if (date >= monthStart) {
      monthTotals.set(
        employeeId,
        (monthTotals.get(employeeId) || 0) + hoursFor(row)
      );
    }

    if (date === today) {
      const clockIn = clean(row[COLS.attendance.clockIn]);
      const clockInMinutes = toMinutes(clockIn);
      const threshold = lateThresholds.get(employeeId) ?? SHIFT_START_MINUTES;
      todayMap.set(employeeId, {
        employeeId,
        clockIn,
        clockOut: clean(row[COLS.attendance.clockOut]),
        hoursWorked: hoursFor(row),
        late: clockInMinutes !== null && clockInMinutes > threshold,
      });
    }
  }

  return { todayMap, monthTotals };
}

/** All leave requests with employee names resolved. */
export async function loadLeaveRequests(employees) {
  const roster = new Map(employees.map((employee) => [employee.employeeId, employee.name]));
  const rows = await getSheetData(SHEETS.leaveRequests, LEAVE_COLS);
  return rows
    .map((row) => {
      const employeeId = clean(row[COLS.leaveRequests.employeeId]);
      const status = clean(row[COLS.leaveRequests.status]) || "Pending";
      return {
        requestId: clean(row[COLS.leaveRequests.requestId]),
        employeeId,
        name: roster.get(employeeId) || employeeId,
        startDate: clean(row[COLS.leaveRequests.startDate]),
        endDate: clean(row[COLS.leaveRequests.endDate]),
        days: toPositiveNumber(row[COLS.leaveRequests.days]),
        reason: clean(row[COLS.leaveRequests.reason]),
        status,
        approvedBy: clean(row[COLS.leaveRequests.approvedBy]),
      };
    })
    .sort((a, b) => {
      const rank = { Pending: 0, Approved: 1, Rejected: 2 };
      const byStatus = (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
      if (byStatus !== 0) return byStatus;
      return String(b.startDate).localeCompare(String(a.startDate));
    });
}

/** employeeId -> current credits, defaulting to 0 for everyone. */
export async function loadCredits(employees) {
  const rows = await getOptionalSheetData(SHEETS.credits, CREDIT_COLS);
  const map = new Map();
  const updatedMap = new Map();
  for (const row of rows) {
    const employeeId = clean(row[COLS.credits.employeeId]);
    const credits = Number(row[COLS.credits.credits]) || 0;
    map.set(employeeId, credits);
    updatedMap.set(employeeId, clean(row[COLS.credits.updatedAt]));
  }
  return employees.map((employee) => ({
    employeeId: employee.employeeId,
    name: employee.name,
    credits: map.get(employee.employeeId) || 0,
    updatedAt: updatedMap.get(employee.employeeId) || null,
  }));
}

/**
 * Hours worked this month grouped by group. Ungrouped workers are collected
 * under a pseudo "Ungrouped" group, mirroring /api/admin/hours.
 * Returns { groups, totalHours }.
 */
export function aggregateHoursByGroup(groups, monthTotals, workers) {
  const byId = new Map(workers.map((employee) => [employee.employeeId, employee.name]));
  const assigned = new Map();
  const memberMap = new Map();

  for (const group of groups) {
    memberMap.set(group.groupId, new Set());
  }
  for (const group of groups) {
    for (const employeeId of group.memberIds) {
      if (!assigned.has(employeeId)) {
        assigned.set(employeeId, group.groupId);
      }
      memberMap.get(group.groupId)?.add(employeeId);
    }
  }

  const round2 = (value) => Math.round(value * 100) / 100;

  const result = groups
    .map((group) => {
      const groupMembers = [...(memberMap.get(group.groupId) || new Set())]
        .filter((employeeId) => byId.has(employeeId))
        .map((employeeId) => ({
          employeeId,
          name: byId.get(employeeId),
          monthHours: round2(monthTotals.get(employeeId) || 0),
        }))
        .sort((a, b) => b.monthHours - a.monthHours);

      return {
        groupId: group.groupId,
        name: group.name,
        monthHours: round2(
          groupMembers.reduce((sum, member) => sum + member.monthHours, 0)
        ),
        employees: groupMembers,
      };
    })
    .sort((a, b) => b.monthHours - a.monthHours);

  const ungrouped = workers
    .filter((employee) => !assigned.has(employee.employeeId))
    .map((employee) => ({
      employeeId: employee.employeeId,
      name: employee.name,
      monthHours: round2(monthTotals.get(employee.employeeId) || 0),
    }))
    .sort((a, b) => b.monthHours - a.monthHours);

  if (ungrouped.length) {
    result.push({
      groupId: "ungrouped",
      name: "Ungrouped",
      monthHours: round2(
        ungrouped.reduce((sum, member) => sum + member.monthHours, 0)
      ),
      employees: ungrouped,
    });
  }

  const totalHours = round2(
    result.reduce((sum, group) => sum + group.monthHours, 0)
  );

  return { groups: result, totalHours };
}