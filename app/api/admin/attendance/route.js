/**
 * /api/admin/attendance
 *
 * GET  -> live attendance table for today (as before).
 * POST -> add or override an attendance record for a date+employee. Creates a
 *         new row when none exists, otherwise updates the existing clock in/out.
 *         Body: { date, employeeId, clockIn, clockOut }  (clockIn/clockOut are
 *         full timestamps like "YYYY-MM-DDTHH:mm").
 * PUT  -> edit an existing attendance record's clock in/out.
 *         Body: { date, employeeId, clockIn, clockOut }
 *
 * Only columns C/D are written; Hours_Worked and Late are live sheet formulas.
 */
import {
  activeEmployees,
  buildActiveSlots,
  buildEmployeeScheduleIndex,
  buildGroupMemberMap,
  buildScheduledLateThresholds,
  loadApprovedLeaveOverlapping,
  loadEmployees,
  loadGroups,
  loadSchedule,
  loadTodayAttendance,
} from "../../../../lib/admin";
import {
  COLUMN_LETTERS,
  COLS,
  SHEETS,
  appendRow,
  findRows,
  updateRow,
} from "../../../../lib/googleSheets";
import { fail, isISODate, ok, readBody, todayISO } from "../../../../lib/utils";
import { requireAdmin, requireAdminOrManager } from "../../../../lib/serverAuth";

const ATTENDANCE_COLS = "A1:D";

const clean = (value) => String(value ?? "").trim();

/** Validate the shared POST/PUT body and pull out a normalized record. */
function parseRecord(body) {
  const { date, employeeId, clockIn, clockOut } = body;
  const record = {
    date: clean(date),
    employeeId: clean(employeeId),
    clockIn: clean(clockIn),
    clockOut: clean(clockOut),
  };
  if (!isISODate(record.date)) {
    return { error: "date must be a valid date in YYYY-MM-DD format" };
  }
  if (!record.employeeId) {
    return { error: "employeeId is required" };
  }
  if (!record.clockIn) {
    return { error: "clockIn is required" };
  }
  if (record.clockOut && record.clockOut < record.clockIn) {
    return { error: "clockOut cannot be before clockIn" };
  }
  return { record };
}

/** Find the Attendance_Log row for a date + employee. */
async function findAttendanceRow(date, employeeId) {
  const matches = await findRows(SHEETS.attendanceLog, ATTENDANCE_COLS, (row) => {
    const matchesDate = clean(row[COLS.attendance.date]) === date;
    const matchesEmployee = clean(row[COLS.attendance.employeeId]) === employeeId;
    return matchesDate && matchesEmployee;
  });
  return matches[matches.length - 1] || null;
}

export async function GET(request) {
  if (!(await requireAdminOrManager(request))) return fail("Unauthorized", 401);
  try {
    const [employees, groups, schedule, { onLeave }] = await Promise.all([
      loadEmployees(),
      loadGroups(),
      loadSchedule(),
      loadApprovedLeaveOverlapping(todayISO()),
    ]);

    const groupMap = buildGroupMemberMap(groups);
    const activeSlots = buildActiveSlots(schedule);
    const scheduleByDate = buildEmployeeScheduleIndex(activeSlots, groups);
    const todayThresholds = buildScheduledLateThresholds(groups, activeSlots, todayISO());
    const attendanceMap = await loadTodayAttendance(todayThresholds, scheduleByDate);
    const workers = activeEmployees(employees);

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

    return ok({
      date: todayISO(),
      entries,
      summary: {
        present: entries.filter((entry) => entry.status === "Present").length,
        late: entries.filter((entry) => entry.status === "Late").length,
        absent: entries.filter((entry) => entry.status === "Absent").length,
        onLeave: entries.filter((entry) => entry.status === "On Leave").length,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/attendance]", error);
    return fail("Internal server error");
  }
}

/** Add a manual attendance row (or override an existing one for the same day). */
export async function POST(request) {
  if (!(await requireAdmin(request))) return fail("Unauthorized", 401);
  try {
    const { error, record } = parseRecord(await readBody(request));
    if (error) return fail(error, 400);

    const existing = await findAttendanceRow(record.date, record.employeeId);

    if (existing) {
      await updateRow(SHEETS.attendanceLog, existing.rowNumber, {
        [COLUMN_LETTERS.attendance.clockIn]: record.clockIn,
        [COLUMN_LETTERS.attendance.clockOut]: record.clockOut || "",
      });
      return ok({
        ...record,
        rowNumber: existing.rowNumber,
        created: false,
      });
    }

    const result = await appendRow(SHEETS.attendanceLog, [
      record.date,                 // A: Date
      record.employeeId,           // B: Employee_ID
      record.clockIn,              // C: Clock_In
      record.clockOut || "",       // D: Clock_Out
    ]);

    return ok(
      {
        ...record,
        rowNumber: result.rowNumber,
        created: true,
      },
      201
    );
  } catch (error) {
    console.error("[POST /api/admin/attendance]", error);
    return fail("Internal server error");
  }
}

/** Edit an existing attendance record's clock in/out. */
export async function PUT(request) {
  if (!(await requireAdmin(request))) return fail("Unauthorized", 401);
  try {
    const { error, record } = parseRecord(await readBody(request));
    if (error) return fail(error, 400);

    const existing = await findAttendanceRow(record.date, record.employeeId);
    if (!existing) {
      return fail("No attendance record exists for this employee on that date", 404);
    }

    await updateRow(SHEETS.attendanceLog, existing.rowNumber, {
      [COLUMN_LETTERS.attendance.clockIn]: record.clockIn,
      [COLUMN_LETTERS.attendance.clockOut]: record.clockOut || "",
    });

    return ok({
      ...record,
      rowNumber: existing.rowNumber,
      created: false,
    });
  } catch (error) {
    console.error("[PUT /api/admin/attendance]", error);
    return fail("Internal server error");
  }
}