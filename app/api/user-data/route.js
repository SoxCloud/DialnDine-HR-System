/**
 * GET /api/user-data
 * Everything the Agent dashboard needs for one employee.
 * ?employeeId=A001
 *
 * Response:
 * {
 *   employeeId, name, extension, department,
 *   group: { name, startTime, endTime } | null,
 *   clockStatus: "clocked_in" | "clocked_out",
 *   onLeaveToday: boolean,
 *   lateToday: boolean,
 *   hoursToday, hoursWeek, hoursMonth,
 *   leave: { totalLeave, leaveTaken, remaining },
 *   absentDays,                         // weekdays this month (to yesterday) with no clock-in
 *   credits, creditsUpdatedAt,
 *   nextShift: { date, startTime, endTime } | null,
 *   attendance: [{ date, clockIn, clockOut, hoursWorked, late }]   // last 14 days
 * }
 */
import { COLS, SHEETS, getOptionalSheetData, getSheetData } from "../../../lib/googleSheets";
import { durationHours, fail, ok, SHIFT_START_MINUTES, toMinutes, todayISO } from "../../../lib/utils";
import {
  businessDateToInstant,
  businessToday,
  businessWeekStart,
  shiftBusinessDate,
} from "../../../lib/time";
import { loadCredits, loadEmployees, loadGroups } from "../../../lib/admin";

const ATTENDANCE_COLS = "A1:G";
const LEAVE_COLS = "A1:H";
const BALANCE_COLS = "A1:D";

const clean = (value) => String(value ?? "").trim();

const pad2 = (value) => String(value).padStart(2, "0");

/** YYYY-MM-DD for a UTC-anchored Date (TZ-independent calendar math). */
function utcKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function round2(value) {
  return Math.round((value || 0) * 100) / 100;
}

/** Decimal hours for one attendance row (prefer the sheet's stored value). */
function hoursFor(row) {
  const stored = Number(row[COLS.attendance.hoursWorked]);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return durationHours(
    clean(row[COLS.attendance.clockIn]),
    clean(row[COLS.attendance.clockOut])
  );
}

function sumHours(rows) {
  let total = 0;
  for (const row of rows) total += row.hoursWorked;
  return total;
}

/** Start of the current business week, Monday, as a "YYYY-MM-DD" key. */
function startOfWeek(now) {
  return businessWeekStart(businessToday(now));
}

/** Weekdays (Mon-Fri) from monthStart to yesterday with no attendance record. */
function countAbsentWeekdays(monthStart, yesterday, presentDates, excludedDates = new Set()) {
  const cursor = new Date(`${monthStart}T00:00:00Z`);
  const last = new Date(`${yesterday}T00:00:00Z`);
  let absent = 0;
  while (cursor <= last) {
    const day = cursor.getUTCDay();
    const dateKey = utcKey(cursor);
    if (
      day !== 0 &&
      day !== 6 &&
      !presentDates.has(dateKey) &&
      !excludedDates.has(dateKey)
    ) {
      absent += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return absent;
}

/** All calendar dates covered by a list of approved leave requests. */
function collectApprovedLeaveDates(rows, employeeId, today) {
  const dates = new Set();
  for (const row of rows) {
    if (clean(row[COLS.leaveRequests.employeeId]) !== employeeId) continue;
    if (clean(row[COLS.leaveRequests.status]).toLowerCase() !== "approved") continue;
    const start = clean(row[COLS.leaveRequests.startDate]);
    const end = clean(row[COLS.leaveRequests.endDate]);
    if (!start || !end || start > today) continue;
    const cursor = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    while (cursor <= endDate) {
      dates.add(utcKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return dates;
}

/** Upcoming shift based on the agent's group schedule (business time zone). */
function computeNextShift(group, now) {
  if (!group || !group.startTime) return null;
  const [hour = 0, minute = 0] = String(group.startTime).split(":").map(Number);
  const today = businessToday(now);
  const todayStart = businessDateToInstant(today, hour, minute);

  if (now < todayStart) {
    return {
      date: today,
      startTime: group.startTime,
      endTime: group.endTime,
    };
  }

  return {
    date: shiftBusinessDate(today, 1),
    startTime: group.startTime,
    endTime: group.endTime,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = (searchParams.get("employeeId") || "").trim();
    if (!employeeId) {
      return fail("employeeId is required", 400);
    }

    const [employees, groups] = await Promise.all([
      loadEmployees(),
      loadGroups(),
    ]);

    const [attendanceRows, leaveRows, balanceRows, credits] =
      await Promise.all([
        getSheetData(SHEETS.attendanceLog, ATTENDANCE_COLS),
        getSheetData(SHEETS.leaveRequests, LEAVE_COLS),
        getSheetData(SHEETS.leaveBalance, BALANCE_COLS),
        loadCredits(employees),
      ]);

    const employee = employees.find((row) => row.employeeId === employeeId);
    if (!employee) {
      return fail("No employee found", 404);
    }

    const now = new Date();
    const today = todayISO(now);
    const monthStart = `${today.slice(0, 7)}-01`;

    const group =
      groups.find((row) => row.memberIds.includes(employeeId)) || null;
    const groupInfo = group
      ? { name: group.name, startTime: group.startTime, endTime: group.endTime }
      : null;
    const lateThreshold = toMinutes(group?.startTime) ?? SHIFT_START_MINUTES;

    const attendance = attendanceRows
      .filter((row) => clean(row[COLS.attendance.employeeId]) === employeeId)
      .map((row) => {
        const clockIn = clean(row[COLS.attendance.clockIn]);
        const clockInMinutes = toMinutes(clockIn);
        return {
          employeeId,
          date: clean(row[COLS.attendance.date]),
          clockIn,
          clockOut: clean(row[COLS.attendance.clockOut]),
          hoursWorked: hoursFor(row),
          late: clockInMinutes !== null && clockInMinutes > lateThreshold,
        };
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const todayEntry = attendance.find((entry) => entry.date === today) || null;

    const hoursToday = todayEntry?.hoursWorked ?? 0;
    const hoursWeek = sumHours(
      attendance.filter((entry) => entry.date >= startOfWeek(now))
    );
    const hoursMonth = sumHours(
      attendance.filter((entry) => entry.date >= monthStart)
    );

    const balance = balanceRows.find(
      (row) => clean(row[COLS.leaveBalance.employeeId]) === employeeId
    ) || null;

    const leave = {
      totalLeave: balance ? Number(balance[COLS.leaveBalance.totalLeave]) || 0 : 0,
      leaveTaken: balance ? Number(balance[COLS.leaveBalance.usedLeave]) || 0 : leaveRows
        .filter(
          (row) =>
            clean(row[COLS.leaveRequests.employeeId]) === employeeId &&
            clean(row[COLS.leaveRequests.status]).toLowerCase() === "approved"
        )
        .reduce((sum, row) => sum + (Number(row[COLS.leaveRequests.days]) || 0), 0),
      remaining: balance ? Number(balance[COLS.leaveBalance.remainingLeave]) || 0 : 0,
    };

    const onLeaveToday = leaveRows.some(
      (row) =>
        clean(row[COLS.leaveRequests.employeeId]) === employeeId &&
        clean(row[COLS.leaveRequests.status]).toLowerCase() === "approved" &&
        clean(row[COLS.leaveRequests.startDate]) <= today &&
        clean(row[COLS.leaveRequests.endDate]) >= today
    );

    const presentDates = new Set(
      attendance.filter((entry) => entry.date >= monthStart).map((entry) => entry.date)
    );
    const approvedLeaveDates = collectApprovedLeaveDates(leaveRows, employeeId, today);
    const absentDays = countAbsentWeekdays(
      monthStart,
      shiftBusinessDate(today, -1),
      presentDates,
      approvedLeaveDates
    );

    const creditRow = credits.find((row) => row.employeeId === employeeId) || null;

    const historyLimit = shiftBusinessDate(today, -13);

    return ok({
      employeeId,
      name: employee.name,
      extension: employee.extension,
      department: employee.department,
      group: groupInfo,
      clockStatus: todayEntry && todayEntry.clockIn ? "clocked_in" : "clocked_out",
      onLeaveToday,
      lateToday: Boolean(todayEntry?.late),
      hoursToday: round2(hoursToday),
      hoursWeek: round2(hoursWeek),
      hoursMonth: round2(hoursMonth),
      leave,
      absentDays,
      credits: creditRow?.credits ?? 0,
      creditsUpdatedAt: creditRow?.updatedAt ?? "",
      nextShift: computeNextShift(groupInfo, now),
      attendance: attendance
        .filter((entry) => entry.date >= historyLimit)
        .map(({ late, ...entry }) => ({
          date: entry.date,
          clockIn: entry.clockIn,
          clockOut: entry.clockOut,
          hoursWorked: round2(entry.hoursWorked),
          late,
        })),
    });
  } catch (error) {
    console.error("[GET /api/user-data]", error);
    return fail("Internal server error");
  }
}