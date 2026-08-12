/**
 * POST /api/clock-in
 * Register an employee's clock-in for today.
 * Rejects with 409 if the employee has already clocked in today.
 * Body: { employeeId }  — or { extension } for backwards compatibility.
 *
 * Schedule check: clock-ins are allowed at any time, but when the employee's
 * group has NO active time slot at the current hour the row is flagged
 * "Unscheduled" in the Notes column so admins can see it.
 */
import { COLUMN_LETTERS, COLS, SHEETS, appendRow, getClockEnabled, getSheetData, updateRow } from "../../../lib/googleSheets";
import { findEmployeeById, findEmployeeByExtension } from "../../../lib/employees";
import { fail, nowISO, ok, readBody, todayISO } from "../../../lib/utils";
import { businessParts } from "../../../lib/time";
import { buildActiveSlots, loadGroups, loadSchedule } from "../../../lib/admin";

export async function POST(request) {
  try {
    // Server-side gate: clocking must be enabled (cannot be bypassed by the client).
    if (!(await getClockEnabled())) {
      return fail("Clocking is currently disabled", 403);
    }

    const { employeeId: bodyEmployeeId, extension } = await readBody(request);

    const employee = bodyEmployeeId
      ? await findEmployeeById(bodyEmployeeId)
      : await findEmployeeByExtension(extension);
    if (!employee) {
      return fail("No employee found", 404);
    }

    const employeeId = String(employee[COLS.employees.employeeId]).trim();
    const employeeExtension = String(employee[COLS.employees.extension] ?? "").trim();
    const date = todayISO();
    const clockIn = nowISO();

    // Only the columns needed for the duplicate check: date + employee id.
    const log = await getSheetData(SHEETS.attendanceLog, "A1:B");

    const alreadyClockedIn = log.some(
      (row) =>
        String(row[COLS.attendance.date]).trim() === date &&
        String(row[COLS.attendance.employeeId]).trim() === employeeId
    );

    if (alreadyClockedIn) {
      return fail("This employee has already clocked in today", 409);
    }

    // Is this employee's group scheduled at the current hour?
    const [groups, schedule] = await Promise.all([loadGroups(), loadSchedule()]);
    const activeSlots = buildActiveSlots(schedule);
    const group = groups.find((row) => row.memberIds.includes(employeeId));
    const currentHour = businessParts().hour;
    const inSlot = Boolean(
      group && activeSlots.get(date)?.get(group.groupId)?.has(currentHour)
    );
    const unscheduled = !inSlot;

    // Append only A..C — the Hours_Worked / Late columns hold live sheet
    // formulas that must not be overwritten. Clock-out fills column D later.
    const result = await appendRow(SHEETS.attendanceLog, [
      date,                 // A: Date
      employeeId,           // B: Employee_ID
      clockIn,              // C: Clock_In
    ]);

    if (unscheduled && result.rowNumber) {
      await updateRow(SHEETS.attendanceLog, result.rowNumber, {
        [COLUMN_LETTERS.attendance.notes]: "Unscheduled",
      });
    }

    return ok(
      {
        employeeId,
        extension: employeeExtension,
        date,
        clockIn,
        clockInColumn: COLUMN_LETTERS.attendance.clockIn,
        rowNumber: result.rowNumber,
        unscheduled,
      },
      201
    );
  } catch (error) {
    console.error("[POST /api/clock-in]", error);
    return fail("Internal server error");
  }
}