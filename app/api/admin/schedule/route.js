/**
 * /api/admin/schedule
 *
 * GET -> { date, slots, groups } for one day's time-slot grid.
 *        slots:  ["08:00", ..., "22:00"]
 *        groups: [{ groupId, name, hours: number[] }]  (active slot hours)
 * PUT -> Replace one day's active cells.
 *        Body: { date, cells: [{ groupId, hour }] }   (hour 8..22)
 */
import { SLOT_HOURS, isSlotDate, readCellsForDate, timeForHour, writeCellsForDate } from "../../../../lib/schedule";
import { loadGroups } from "../../../../lib/admin";
import { fail, ok, readBody } from "../../../../lib/utils";
import { requireAdmin, requireAdminOrManager } from "../../../../lib/serverAuth";

const clean = (value) => String(value ?? "").trim();

export async function GET(request) {
  if (!(await requireAdminOrManager(request))) return fail("Unauthorized", 401);
  try {
    const { searchParams } = new URL(request.url);
    const date = clean(searchParams.get("date"));

    if (!isSlotDate(date)) {
      return fail("date (YYYY-MM-DD) is required", 400);
    }

    const [groups, cells] = await Promise.all([loadGroups(), readCellsForDate(date)]);

    const byGroup = new Map();
    for (const cell of cells) {
      if (!byGroup.has(cell.groupId)) byGroup.set(cell.groupId, []);
      byGroup.get(cell.groupId).push(cell.hour);
    }

    return ok({
      date,
      slots: SLOT_HOURS.map(timeForHour),
      groups: groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
        hours: [...(byGroup.get(group.groupId) || [])].sort((a, b) => a - b),
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/schedule]", error);
    return fail("Internal server error");
  }
}

export async function PUT(request) {
  if (!(await requireAdmin(request))) return fail("Unauthorized", 401);
  try {
    const body = await readBody(request);
    const date = clean(body.date);

    if (!isSlotDate(date)) {
      return fail("date (YYYY-MM-DD) is required", 400);
    }

    if (!Array.isArray(body.cells)) {
      return fail("cells (array of { groupId, hour }) is required", 400);
    }

    const count = await writeCellsForDate(date, body.cells);
    return ok({ date, cells: count });
  } catch (error) {
    console.error("[PUT /api/admin/schedule]", error);
    return fail("Internal server error");
  }
}