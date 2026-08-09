/**
 * POST /api/approve-leave
 * Admin approves a leave request.
 * Body: { requestId, approvedBy }
 */
import { COLUMN_LETTERS, COLS, SHEETS, findRows, updateRow } from "../../../lib/googleSheets";
import { fail, ok, readBody } from "../../../lib/utils";

export async function POST(request) {
  try {
    const { requestId, approvedBy } = await readBody(request);

    if (!requestId) {
      return fail("requestId is required", 400);
    }
    if (!approvedBy) {
      return fail("approvedBy is required", 400);
    }

    const matches = await findRows(SHEETS.leaveRequests, "A1:G", (row) => {
      const rowId = String(row[COLS.leaveRequests.requestId] ?? "").trim();
      return rowId === String(requestId).trim();
    });

    if (!matches.length) {
      return fail("Leave request not found", 404);
    }

    const { rowNumber } = matches[0];
    await updateRow(SHEETS.leaveRequests, rowNumber, {
      [COLUMN_LETTERS.leaveRequests.status]: "Approved",
      [COLUMN_LETTERS.leaveRequests.approvedBy]: String(approvedBy),
    });

    return ok({
      requestId,
      status: "Approved",
      approvedBy,
      rowNumber,
    });
  } catch (error) {
    console.error("[POST /api/approve-leave]", error);
    return fail("Internal server error");
  }
}