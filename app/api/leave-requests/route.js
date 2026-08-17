/**
 * GET /api/leave-requests
 * List one employee's leave requests.
 * ?employeeId=A001
 * Response: { employeeId, requests: [{ requestId, startDate, endDate, days, status }] }
 */
import { COLS, SHEETS, findRows } from "../../../lib/googleSheets";
import { fail, ok } from "../../../lib/utils";
import { requireAnyUser } from "../../../lib/serverAuth";

export async function GET(request) {
  if (!(await requireAnyUser(request))) return fail("Unauthorized", 401);
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = (searchParams.get("employeeId") || "").trim();

    if (!employeeId) {
      return fail("employeeId is required", 400);
    }

    const matches = await findRows(SHEETS.leaveRequests, "A1:G", (row) => {
      const rowId = String(row[COLS.leaveRequests.employeeId] ?? "").trim();
      return rowId === employeeId;
    });

    const requests = matches
      .map(({ record }) => ({
        requestId: record[COLS.leaveRequests.requestId] ?? "",
        startDate: record[COLS.leaveRequests.startDate] ?? "",
        endDate: record[COLS.leaveRequests.endDate] ?? "",
        days: record[COLS.leaveRequests.days] ?? "",
        status: record[COLS.leaveRequests.status] ?? "Pending",
      }))
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));

    return ok({ employeeId, requests });
  } catch (error) {
    console.error("[GET /api/leave-requests]", error);
    return fail("Internal server error");
  }
}