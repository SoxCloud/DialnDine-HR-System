/**
 * /api/admin/credits
 *
 * GET  -> credits for every active employee (0 when no log entries exist),
 *         aggregated from the Credit_Log sheet. Includes the full log.
 *        { credits: [{ employeeId, name, amount, hours, credits, updatedAt }], log: [...] }
 * POST -> record a wrong-order credit.
 *        Body: { employeeId, date?, store, customerDetails, reason, amount }
 */
import { COLS, SHEETS, appendRow } from "../../../../lib/googleSheets";
import { loadCreditLog, loadCredits, activeEmployees, loadEmployees } from "../../../../lib/admin";
import { fail, nowISO, ok, readBody, todayISO } from "../../../../lib/utils";
import { requireAdmin, requireAdminOrManager } from "../../../../lib/serverAuth";

const clean = (value) => String(value ?? "").trim();

export async function GET(request) {
  if (!(await requireAdminOrManager(request))) return fail("Unauthorized", 401);
  try {
    const employees = await loadEmployees();
    const active = activeEmployees(employees);
    const [credits, log] = await Promise.all([
      loadCredits(active),
      loadCreditLog(active),
    ]);
    return ok({ credits, log });
  } catch (error) {
    console.error("[GET /api/admin/credits]", error);
    return fail("Internal server error");
  }
}

export async function POST(request) {
  if (!(await requireAdmin(request))) return fail("Unauthorized", 401);
  try {
    const { employeeId, date, store, customerDetails, reason, amount } = await readBody(request);

    if (!clean(employeeId)) {
      return fail("employeeId is required", 400);
    }
    if (!clean(reason)) {
      return fail("Reason is required", 400);
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      return fail("Amount must be a non-negative number", 400);
    }

    const creditDate = clean(date) || todayISO();
    await appendRow(SHEETS.creditLog, [
      creditDate,
      clean(employeeId),
      "wrong_order",
      clean(store),
      clean(customerDetails),
      clean(reason),
      value,
      "",
      nowISO(),
    ]);

    return ok({ employeeId: clean(employeeId), amount: value, date: creditDate });
  } catch (error) {
    console.error("[POST /api/admin/credits]", error);
    return fail("Internal server error");
  }
}
