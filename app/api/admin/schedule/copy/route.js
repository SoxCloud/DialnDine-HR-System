/**
 * POST /api/admin/schedule/copy
 * Copy one day's active schedule cells to another day.
 * Body: { fromDate, toDate }
 */
import { isSlotDate, readCellsForDate, writeCellsForDate } from "../../../../../lib/schedule";
import { fail, ok, readBody } from "../../../../../lib/utils";
import { requireAdmin } from "../../../../../lib/serverAuth";

const clean = (value) => String(value ?? "").trim();

export async function POST(request) {
  if (!(await requireAdmin(request))) return fail("Unauthorized", 401);
  try {
    const { fromDate, toDate } = await readBody(request);
    const source = clean(fromDate);
    const target = clean(toDate);

    if (!isSlotDate(source) || !isSlotDate(target)) {
      return fail("fromDate and toDate (YYYY-MM-DD) are required", 400);
    }

    const cells = await readCellsForDate(source);
    const count = await writeCellsForDate(target, cells);

    return ok({ fromDate: source, toDate: target, copied: count });
  } catch (error) {
    console.error("[POST /api/admin/schedule/copy]", error);
    return fail("Internal server error");
  }
}