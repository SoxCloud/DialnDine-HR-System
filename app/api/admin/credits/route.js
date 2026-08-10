/**
 * /api/admin/credits
 *
 * GET -> credits for every active employee (0 when no Credits row exists).
 *        { credits: [{ employeeId, name, credits, updatedAt }] }
 * POST -> adjust credits. Body: { employeeId, action: "set"|"add"|"deduct", amount }
 */
import { COLUMN_LETTERS, COLS, SHEETS, appendRow, findRows, updateRow } from "../../../../lib/googleSheets";
import { activeEmployees, loadCredits, loadEmployees } from "../../../../lib/admin";
import { fail, nowISO, ok, readBody } from "../../../../lib/utils";

const CREDIT_COLS = "A1:C";

const clean = (value) => String(value ?? "").trim();

export async function GET() {
  try {
    const employees = await loadEmployees();
    const credits = await loadCredits(activeEmployees(employees));
    return ok({ credits });
  } catch (error) {
    console.error("[GET /api/admin/credits]", error);
    return fail("Internal server error");
  }
}

export async function POST(request) {
  try {
    const { employeeId, action, amount } = await readBody(request);

    if (!clean(employeeId)) {
      return fail("employeeId is required", 400);
    }
    if (!["set", "add", "deduct"].includes(action)) {
      return fail("action must be set, add or deduct", 400);
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      return fail("amount must be a non-negative number", 400);
    }

    const matches = await findRows(SHEETS.credits, CREDIT_COLS, (row) => clean(row[COLS.credits.employeeId]) === clean(employeeId));

    let credits;
    if (action === "set") {
      credits = value;
    } else {
      const current = matches.length ? Number(matches[0].record[COLS.credits.credits]) || 0 : 0;
      credits = action === "deduct" ? Math.max(0, current - value) : current + value;
    }

    if (matches.length) {
      await updateRow(SHEETS.credits, matches[0].rowNumber, {
        [COLUMN_LETTERS.credits.credits]: credits,
        [COLUMN_LETTERS.credits.updatedAt]: nowISO(),
      });
    } else {
      await appendRow(SHEETS.credits, [clean(employeeId), credits, nowISO()]);
    }

    return ok({ employeeId: clean(employeeId), credits, action, updatedAt: nowISO() });
  } catch (error) {
    console.error("[POST /api/admin/credits]", error);
    return fail("Internal server error");
  }
}