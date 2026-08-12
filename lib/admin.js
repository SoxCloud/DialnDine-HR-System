/**
 * lib/admin.js
 *
 * Shared read helpers for the Admin dashboard API routes.
 * All helpers only ever fetch the columns they need.
 */
import { COLS, SHEETS, getOptionalSheetData, getSheetData } from "./googleSheets";
import { durationHours, SHIFT_START_MINUTES, toMinutes, todayISO } from "./utils";
import { businessDateToInstant, businessToday } from "./time";

const EMPLOYEE_COLS = "A1:I";
const ATTENDANCE_COLS = "A1:G";
const LEAVE_COLS = "A1:H";
const GROUP_COLS = "A1:E";
const CREDIT_COLS = "A1:C";
const SCHEDULE_COLS = "A1:C";

const clean = (value) => String(value ?? "").trim();

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Instant of a stored "YYYY-MM-DDTHH:mm:ss" cell expressed in business time. */
function storedTimeInstant(dateKey, storedTime) {
  const [hour = 0, minute = 0, second = 0] =
    String(storedTime ?? "").split("T")[1]?.split(":").map(Number) ?? [];
  return businessDateToInstant(dateKey, hour, minute, second);
}

/**
 * Sum an attendance row's hours.
 * When the employee's group has active slots for that day, only time inside
 * the slots counts; otherwise the sheet's Hours_Worked cell (raw duration)
 * is preferred, then a fallback duration.
 */
function hoursFor(row, scheduleByDate = new Map(), employeeId = "") {
  const date = clean(row[COLS.attendance.date]);
  const slotHours = employeeId
    ? scheduleByDate.get(employeeId)?.get(date)
    : undefined;
  if (slotHours && slotHours.size) {
    return hoursWithinSlots(
      clean(row[COLS.attendance.clockIn]),
      clean(row[COLS.attendance.clockOut]),
      slotHours,
      date
    );
  }
  const stored = toPositiveNumber(row[COLS.attendance.hoursWorked]);
  if (stored > 0) return stored;
  return durationHours(clean(row[COLS.attendance.clockIn]), clean(row[COLS.attendance.clockOut]));
}

/**
 * Decimal hours of [clockIn, clockOut] that fall inside the hourly slots for
 * `date`. Each slot hour H covers H:00 to H+1:00 in business time.
 */
export function hoursWithinSlots(clockIn, clockOut, slotHours, date) {
  if (!clockIn || !clockOut || !slotHours || slotHours.size === 0) return 0;
  const dateKey = clean(date) || businessToday();
  const inMs = storedTimeInstant(dateKey, clockIn).getTime();
  const outMs = storedTimeInstant(dateKey, clockOut).getTime();
  if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) return 0;

  let ms = 0;
  for (const hour of slotHours) {
    const start = businessDateToInstant(dateKey, hour, 0).getTime();
    const end = businessDateToInstant(dateKey, hour + 1, 0).getTime();
    ms += Math.max(0, Math.min(outMs, end) - Math.max(inMs, start));
  }
  return ms / 3600000;
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

/** All active slot rows for every group. */
export async function loadSchedule() {
  const rows = await getOptionalSheetData(SHEETS.schedule, SCHEDULE_COLS);
  return rows.map((row) => ({
    date: clean(row[COLS.schedule.date]),
    time: clean(row[COLS.schedule.time]),
    groupId: clean(row[COLS.schedule.groupId]),
  }));
}

/**
 * Map of date -> (groupId -> Set<hour>). A group with a slot at hour H is
 * active from H:00 to H+1:00. Absent date/group = no active slots (off).
 */
export function buildActiveSlots(schedule) {
  const map = new Map();
  for (const row of schedule) {
    if (!row.date || !row.groupId) continue;
    const hour = toMinutes(row.time);
    if (hour === null || hour % 60 !== 0) continue;
    if (!map.has(row.date)) map.set(row.date, new Map());
    const byGroup = map.get(row.date);
    if (!byGroup.has(row.groupId)) byGroup.set(row.groupId, new Set());
    byGroup.get(row.groupId).add(hour / 60);
  }
  return map;
}

/**
 * Map of employeeId -> (date -> Set<hour>) for employees assigned to a group.
 * Group members share their group's read-only hour set, so lookups are cheap.
 */
export function buildEmployeeScheduleIndex(activeSlots, groups) {
  const groupMembers = new Map();
  for (const group of groups) groupMembers.set(group.groupId, group.memberIds);
  const index = new Map();
  for (const [date, byGroup] of activeSlots) {
    for (const [groupId, hours] of byGroup) {
      const memberIds = groupMembers.get(groupId) || [];
      for (const employeeId of memberIds) {
        if (!index.has(employeeId)) index.set(employeeId, new Map());
        index.get(employeeId).set(date, hours);
      }
    }
  }
  return index;
}

/**
 * Map of employeeId -> late threshold (minutes past midnight) for ONE date.
 * Grouped employees use the day's FIRST active slot; a grouped employee with
 * no slot that day maps to null (not scheduled -> never late). Ungrouped
 * employees are absent and fall back to the global default start.
 */
export function buildScheduledLateThresholds(groups, activeSlots, date) {
  const map = new Map();
  for (const group of groups) {
    const slotHours = activeSlots.get(date)?.get(group.groupId);
    const threshold =
      slotHours && slotHours.size ? Math.min(...slotHours) * 60 : null;
    for (const employeeId of group.memberIds) {
      if (!map.has(employeeId)) map.set(employeeId, threshold);
    }
  }
  return map;
}

/** Map of employeeId -> today's attendance row (clockIn, clockOut, hours, late). */
export async function loadTodayAttendance(lateThresholds = new Map(), scheduleByDate = new Map()) {
  const today = todayISO();
  const rows = await getSheetData(SHEETS.attendanceLog, ATTENDANCE_COLS);
  const map = new Map();
  for (const row of rows) {
    if (clean(row[COLS.attendance.date]) !== today) continue;
    const employeeId = clean(row[COLS.attendance.employeeId]);
    if (!employeeId) continue;
    const clockIn = clean(row[COLS.attendance.clockIn]);
    const clockInMinutes = toMinutes(clockIn);
    const threshold = lateThresholds.has(employeeId)
      ? lateThresholds.get(employeeId)
      : SHIFT_START_MINUTES;
    const late = threshold !== null && clockInMinutes !== null && clockInMinutes > threshold;
    map.set(employeeId, {
      employeeId,
      clockIn,
      clockOut: clean(row[COLS.attendance.clockOut]),
      hoursWorked: hoursFor(row, scheduleByDate, employeeId),
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
export async function loadMonthHours(scheduleByDate = new Map()) {
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await getSheetData(SHEETS.attendanceLog, ATTENDANCE_COLS);
  const totals = new Map();
  for (const row of rows) {
    const date = clean(row[COLS.attendance.date]);
    if (!date || date < monthStart) continue;
    const employeeId = clean(row[COLS.attendance.employeeId]);
    if (!employeeId) continue;
    totals.set(employeeId, (totals.get(employeeId) || 0) + hoursFor(row, scheduleByDate, employeeId));
  }
  return totals;
}

/**
 * Single read of Attendance_Log producing both today's map and the current
 * month's totals, so the dashboard only queries the sheet once.
 * Returns { todayMap, monthTotals }.
 */
export async function loadAttendanceSnapshot(lateThresholds = new Map(), scheduleByDate = new Map()) {
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
        (monthTotals.get(employeeId) || 0) + hoursFor(row, scheduleByDate, employeeId)
      );
    }

    if (date === today) {
      const clockIn = clean(row[COLS.attendance.clockIn]);
      const clockInMinutes = toMinutes(clockIn);
      const threshold = lateThresholds.has(employeeId)
        ? lateThresholds.get(employeeId)
        : SHIFT_START_MINUTES;
      todayMap.set(employeeId, {
        employeeId,
        clockIn,
        clockOut: clean(row[COLS.attendance.clockOut]),
        hoursWorked: hoursFor(row, scheduleByDate, employeeId),
        late: threshold !== null && clockInMinutes !== null && clockInMinutes > threshold,
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