/**
 * /api/admin/leave
 *
 * GET    -> all leave requests with employee names.
 *          { requests: [{ requestId, employeeId, name, startDate, endDate, days, reason, status, approvedBy }] }
 * POST   -> add a leave request manually.
 *          Body: { employeeId, startDate, endDate, reason?, status?, approvedBy? }
 *          Status defaults to "Approved" when omitted.
 * PUT    -> update a leave request (edit dates/reason, or approve/reject).
 *          Body: { requestId, startDate?, endDate?, reason?, status?, approvedBy? }
 *          When both dates are sent, Days is recomputed server-side.
 * DELETE -> delete a leave request. Body: { requestId }
 */
import { COLUMN_LETTERS, COLS, SHEETS, appendRow, clearRow, findRows, getSheetData, updateRow } from "../../../../lib/googleSheets";
import { loadEmployees, loadLeaveRequests } from "../../../../lib/admin";
import { daysInclusive, fail, isISODate, ok, readBody } from "../../../../lib/utils";

const LEAVE_COLS = "A1:H";

const clean = (value) => String(value ?? "").trim();

export async function GET() {
  try {
    const employees = await loadEmployees();
    const requests = await loadLeaveRequests(employees);
    return ok({ requests });
  } catch (error) {
    console.error("[GET /api/admin/leave]", error);
    return fail("Internal server error");
  }
}

export async function POST(request) {
  try {
    const { employeeId, startDate, endDate, reason, status, approvedBy } = await readBody(request);

    if (!clean(employeeId)) {
      return fail("employeeId is required", 400);
    }
    if (!isISODate(startDate) || !isISODate(endDate)) {
      return fail("startDate and endDate must be valid dates in YYYY-MM-DD format", 400);
    }
    if (startDate > endDate) {
      return fail("startDate cannot be after endDate", 400);
    }

    const existing = await getSheetData(SHEETS.leaveRequests, "A1:A");
    const requestId = `LV-${String(existing.length + 1).padStart(4, "0")}`;
    const days = daysInclusive(startDate, endDate);
    const resolvedStatus = clean(status) || "Approved";

    await appendRow(SHEETS.leaveRequests, [
      requestId,                    // A: Request_ID
      clean(employeeId),            // B: Employee_ID
      startDate,                    // C: Start_Date
      endDate,                      // D: End_Date
      days,                         // E: Days
      resolvedStatus,               // F: Status
      clean(approvedBy) || "",      // G: Approved_By
      String(reason ?? ""),         // H: Reason
    ]);

    return ok(
      {
        requestId,
        employeeId: clean(employeeId),
        startDate,
        endDate,
        days,
        reason: String(reason ?? ""),
        status: resolvedStatus,
        approvedBy: clean(approvedBy) || "",
      },
      201
    );
  } catch (error) {
    console.error("[POST /api/admin/leave]", error);
    return fail("Internal server error");
  }
}

export async function PUT(request) {
  try {
    const { requestId, startDate, endDate, reason, status, approvedBy } = await readBody(request);

    if (!clean(requestId)) {
      return fail("requestId is required", 400);
    }
    if (startDate !== undefined && !isISODate(startDate)) {
      return fail("startDate must be a valid date in YYYY-MM-DD format", 400);
    }
    if (endDate !== undefined && !isISODate(endDate)) {
      return fail("endDate must be a valid date in YYYY-MM-DD format", 400);
    }
    if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
      return fail("startDate cannot be after endDate", 400);
    }

    const matches = await findRows(SHEETS.leaveRequests, LEAVE_COLS, (row) => clean(row[COLS.leaveRequests.requestId]) === clean(requestId));
    if (!matches.length) {
      return fail("Leave request not found", 404);
    }

    const updates = {};
    if (startDate !== undefined) updates[COLUMN_LETTERS.leaveRequests.startDate] = clean(startDate);
    if (endDate !== undefined) updates[COLUMN_LETTERS.leaveRequests.endDate] = clean(endDate);
    if (startDate !== undefined && endDate !== undefined) {
      updates[COLUMN_LETTERS.leaveRequests.days] = daysInclusive(startDate, endDate);
    }
    if (reason !== undefined) updates[COLUMN_LETTERS.leaveRequests.reason] = String(reason);
    if (status !== undefined) updates[COLUMN_LETTERS.leaveRequests.status] = clean(status);
    if (approvedBy !== undefined) updates[COLUMN_LETTERS.leaveRequests.approvedBy] = String(approvedBy);

    const { rowNumber } = matches[0];
    if (Object.keys(updates).length) {
      await updateRow(SHEETS.leaveRequests, rowNumber, updates);
    }

    return ok({
      requestId: clean(requestId),
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      reason: reason ?? undefined,
      status: status ?? undefined,
      approvedBy: approvedBy ?? undefined,
      rowNumber,
    });
  } catch (error) {
    console.error("[PUT /api/admin/leave]", error);
    return fail("Internal server error");
  }
}

export async function DELETE(request) {
  try {
    const { requestId } = await readBody(request);

    if (!clean(requestId)) {
      return fail("requestId is required", 400);
    }

    const matches = await findRows(SHEETS.leaveRequests, LEAVE_COLS, (row) => clean(row[COLS.leaveRequests.requestId]) === clean(requestId));
    if (!matches.length) {
      return fail("Leave request not found", 404);
    }

    await clearRow(SHEETS.leaveRequests, matches[0].rowNumber, "H");

    return ok({ requestId: clean(requestId) });
  } catch (error) {
    console.error("[DELETE /api/admin/leave]", error);
    return fail("Internal server error");
  }
}