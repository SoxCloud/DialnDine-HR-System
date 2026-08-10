/**
 * POST /api/leave-request
 * Create a leave request. Generates the Request_ID and defaults Status to Pending.
 * Body: { employeeId, startDate, endDate, reason? }  (dates in YYYY-MM-DD)
 */
import { COLS, SHEETS, appendRow, getSheetData } from "../../../lib/googleSheets";
import { daysInclusive, fail, isISODate, ok, readBody } from "../../../lib/utils";

export async function POST(request) {
  try {
    const { employeeId, startDate, endDate, reason } = await readBody(request);

    if (!employeeId) {
      return fail("employeeId is required", 400);
    }
    if (!isISODate(startDate) || !isISODate(endDate)) {
      return fail("startDate and endDate must be valid dates in YYYY-MM-DD format", 400);
    }
    if (startDate > endDate) {
      return fail("startDate cannot be after endDate", 400);
    }

    // Auto-generate a sequential Request_ID (e.g. LV-0001).
    const existing = await getSheetData(SHEETS.leaveRequests, "A1:A");
    const requestId = `LV-${String(existing.length + 1).padStart(4, "0")}`;
    const days = daysInclusive(startDate, endDate);

    await appendRow(SHEETS.leaveRequests, [
      requestId,             // A: Request_ID
      String(employeeId),    // B: Employee_ID
      startDate,             // C: Start_Date
      endDate,               // D: End_Date
      days,                  // E: Days
      "Pending",             // F: Status
      "",                    // G: Approved_By
      String(reason ?? ""),  // H: Reason
    ]);

    return ok(
      {
        requestId,
        employeeId,
        startDate,
        endDate,
        days,
        reason: String(reason ?? ""),
        status: "Pending",
      },
      201
    );
  } catch (error) {
    console.error("[POST /api/leave-request]", error);
    return fail("Internal server error");
  }
}