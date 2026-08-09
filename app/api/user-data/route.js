/**
 * GET /api/user-data
 * Personal data summary for one employee.
 * ?employeeId=A001
 *
 * Response:
 * {
 *   employeeId,
 *   attendance: [{ date, clockIn, clockOut, hoursWorked, late, notes }],  // newest first
 *   leave:      [{ requestId, startDate, endDate, days, status }],        // newest first
 *   totalHours,
 *   leaveBalance: { totalLeave, usedLeave, remainingLeave },
 * }
 *
 * Reads are scoped to the exact columns needed (never the whole file).
 */
import { COLS, SHEETS, getSheetData } from "../../../lib/googleSheets";
import { durationHours, fail, ok } from "../../../lib/utils";

const ATTENDANCE_COLS = "A1:G"; // Date..Notes
const LEAVE_COLS = "A1:G";      // Request_ID..Approved_By
const BALANCE_COLS = "A1:D";    // Employee_ID..Remaining_Leave

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = (searchParams.get("employeeId") || "").trim();

    if (!employeeId) {
      return fail("employeeId is required", 400);
    }

    const [attendanceRows, leaveRows, balanceRows] = await Promise.all([
      getSheetData(SHEETS.attendanceLog, ATTENDANCE_COLS),
      getSheetData(SHEETS.leaveRequests, LEAVE_COLS),
      getSheetData(SHEETS.leaveBalance, BALANCE_COLS),
    ]);

    // Attendance history for this employee only.
    const attendance = attendanceRows
      .filter(
        (row) =>
          String(row[COLS.attendance.employeeId]).trim() === employeeId
      )
      .map((row) => ({
        date: row[COLS.attendance.date] ?? "",
        clockIn: row[COLS.attendance.clockIn] ?? "",
        clockOut: row[COLS.attendance.clockOut] ?? "",
        hoursWorked: row[COLS.attendance.hoursWorked] ?? "",
        late: row[COLS.attendance.late] ?? "",
        notes: row[COLS.attendance.notes] ?? "",
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    // Prefer the sheet's Hours_Worked cell; fall back to a timestamp diff.
    const totalHours = attendance.reduce((sum, entry) => {
      const stored = Number(entry.hoursWorked);
      if (Number.isFinite(stored) && stored > 0) return sum + stored;
      return sum + durationHours(entry.clockIn, entry.clockOut);
    }, 0);

    // Leave history for this employee only.
    const leave = leaveRows
      .filter(
        (row) =>
          String(row[COLS.leaveRequests.employeeId]).trim() === employeeId
      )
      .map((row) => ({
        requestId: row[COLS.leaveRequests.requestId] ?? "",
        startDate: row[COLS.leaveRequests.startDate] ?? "",
        endDate: row[COLS.leaveRequests.endDate] ?? "",
        days: row[COLS.leaveRequests.days] ?? "",
        status: row[COLS.leaveRequests.status] ?? "Pending",
      }))
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));

    // Leave balance from the formula-backed sheet when present.
    const balanceRow = balanceRows.find(
      (row) =>
        String(row[COLS.leaveBalance.employeeId]).trim() === employeeId
    );

    const leaveBalance = {
      totalLeave: balanceRow ? Number(balanceRow.totalLeave) || 0 : 0,
      usedLeave: balanceRow ? Number(balanceRow.usedLeave) || 0 : 0,
      remainingLeave: balanceRow
        ? Number(balanceRow.remainingLeave) || 0
        : 0,
    };

    return ok({
      employeeId,
      attendance,
      leave,
      totalHours: Math.round(totalHours * 100) / 100,
      leaveBalance,
    });
  } catch (error) {
    console.error("[GET /api/user-data]", error);
    return fail("Internal server error");
  }
}