/**
 * /api/admin/credits/month-end
 *
 * GET  -> candidates for `month` (YYYY-MM, defaults to current): employees who
 *         worked hours after the 25th. { month, candidates: [...] }
 * POST -> credit absconded hours for the selected employees the following month.
 *        Body: { month: "YYYY-MM", employeeIds: [..] }
 */
import { COLS, SHEETS, appendRow, readRange } from "../../../../../lib/googleSheets";
import {
  activeEmployees,
  buildActiveSlots,
  buildEmployeeScheduleIndex,
  loadEmployees,
  loadGroups,
  loadMonthEndCandidates,
  loadSchedule,
} from "../../../../../lib/admin";
import { fail, nowISO, ok, readBody, todayISO } from "../../../../../lib/utils";
import { requireAdmin, requireAdminOrManager } from "../../../../../lib/serverAuth";

const clean = (value) => String(value ?? "").trim();

function monthInput(value) {
  const raw = clean(value) || todayISO().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

function nextMonth(month) {
  const d = new Date(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request) {
  if (!(await requireAdminOrManager(request))) return fail("Unauthorized", 401);
  try {
    const { searchParams } = new URL(request.url);
    const month = monthInput(searchParams.get("month"));
    if (!month) return fail("month must be YYYY-MM", 400);

    const [employees, groups, schedule] = await Promise.all([
      loadEmployees(),
      loadGroups(),
      loadSchedule(),
    ]);
    const activeSlots = buildActiveSlots(schedule);
    const scheduleByDate = buildEmployeeScheduleIndex(activeSlots, groups);
    const candidates = await loadMonthEndCandidates(month, activeEmployees(employees), scheduleByDate);

    return ok({ month, candidates });
  } catch (error) {
    console.error("[GET /api/admin/credits/month-end]", error);
    return fail("Internal server error");
  }
}

export async function POST(request) {
  if (!(await requireAdmin(request))) return fail("Unauthorized", 401);
  try {
    const { month, employeeIds } = await readBody(request);
    const m = monthInput(month);
    if (!m) return fail("month must be YYYY-MM", 400);
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return fail("employeeIds must be a non-empty array", 400);
    }

    const [employees, groups, schedule] = await Promise.all([
      loadEmployees(),
      loadGroups(),
      loadSchedule(),
    ]);
    const activeSlots = buildActiveSlots(schedule);
    const scheduleByDate = buildEmployeeScheduleIndex(activeSlots, groups);
    const candidates = await loadMonthEndCandidates(m, activeEmployees(employees), scheduleByDate);

    const byId = new Map(candidates.map((candidate) => [candidate.employeeId, candidate]));
    const applied = [];
    const creditMonth = nextMonth(m);
    const creditDate = `${creditMonth}-01`;

    for (const rawId of employeeIds) {
      const employeeId = clean(rawId);
      const candidate = byId.get(employeeId);
      if (!candidate) continue;
      await appendRow(SHEETS.creditLog, [
        creditDate,
        employeeId,
        "absconded_hours",
        "",
        "",
        `Absconded after ${m}-25 — hours credited to ${creditMonth}`,
        "",
        candidate.hoursAfter25th,
        nowISO(),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      applied.push({ employeeId, hours: candidate.hoursAfter25th });
    }

    return ok({ month: m, creditMonth, applied });
  } catch (error) {
    console.error("[POST /api/admin/credits/month-end]", error);
    return fail("Internal server error");
  }
}
