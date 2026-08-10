/**
 * /api/admin/groups
 *
 * GET    -> { groups, employees } for the Group Management UI.
 *           groups: [{ groupId, name, startTime, endTime, memberIds, members: [{ employeeId, name }] }]
 *           employees: [{ employeeId, name, extension }]
 * POST   -> create group. Body: { name, startTime?, endTime? }
 * PUT    -> update group.    Body: { groupId, name?, startTime?, endTime?, members?: string[] }
 * DELETE -> delete group.    Body: { groupId }
 */
import { COLUMN_LETTERS, COLS, SHEETS, appendRow, clearRow, findRows, getOptionalSheetData, updateRow } from "../../../../lib/googleSheets";
import { activeEmployees, loadEmployees, loadGroups } from "../../../../lib/admin";
import { fail, ok, readBody } from "../../../../lib/utils";

const GROUP_COLS = "A1:E";

const clean = (value) => String(value ?? "").trim();

function toTime(value) {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

export async function GET() {
  try {
    const [groups, allEmployees] = await Promise.all([loadGroups(), loadEmployees()]);
    const employees = activeEmployees(allEmployees);
    const roster = new Map(allEmployees.map((employee) => [employee.employeeId, employee.name]));

    return ok({
      groups: groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
        startTime: group.startTime,
        endTime: group.endTime,
        memberIds: group.memberIds,
        members: group.memberIds
          .map((employeeId) => ({ employeeId, name: roster.get(employeeId) || employeeId }))
          .filter((member) => employees.some((employee) => employee.employeeId === member.employeeId)),
      })),
      employees: employees.map(({ employeeId, name, extension }) => ({ employeeId, name, extension })),
    });
  } catch (error) {
    console.error("[GET /api/admin/groups]", error);
    return fail("Internal server error");
  }
}

export async function POST(request) {
  try {
    const { name, startTime, endTime } = await readBody(request);

    if (!clean(name)) {
      return fail("name is required", 400);
    }

    const existing = await getOptionalSheetData(SHEETS.groups, "A1:A");
    const groupId = `G-${String(existing.length + 1).padStart(4, "0")}`;

    await appendRow(SHEETS.groups, [
      groupId,                    // A: Group_ID
      clean(name),                // B: Group_Name
      toTime(startTime) ?? "",     // C: Start_Time
      toTime(endTime) ?? "",       // D: End_Time
      "",                          // E: Members
    ]);

    return ok({ groupId, name: clean(name), startTime: toTime(startTime) ?? "", endTime: toTime(endTime) ?? "" }, 201);
  } catch (error) {
    console.error("[POST /api/admin/groups]", error);
    return fail("Internal server error");
  }
}

export async function PUT(request) {
  try {
    const { groupId, name, startTime, endTime, members } = await readBody(request);

    if (!clean(groupId)) {
      return fail("groupId is required", 400);
    }

    const matches = await findRows(SHEETS.groups, GROUP_COLS, (row) => clean(row[COLS.groups.groupId]) === clean(groupId));
    if (!matches.length) {
      return fail("Group not found", 404);
    }

    const updates = {};
    if (name !== undefined) updates[COLUMN_LETTERS.groups.name] = clean(name);
    if (startTime !== undefined) updates[COLUMN_LETTERS.groups.startTime] = String(startTime);
    if (endTime !== undefined) updates[COLUMN_LETTERS.groups.endTime] = String(endTime);
    if (members !== undefined) {
      updates[COLUMN_LETTERS.groups.members] = Array.isArray(members) ? members.map(clean).filter(Boolean).join(",") : "";
    }

    const { rowNumber } = matches[0];
    if (Object.keys(updates).length) {
      await updateRow(SHEETS.groups, rowNumber, updates);
    }

    return ok({ groupId: clean(groupId), rowNumber });
  } catch (error) {
    console.error("[PUT /api/admin/groups]", error);
    return fail("Internal server error");
  }
}

export async function DELETE(request) {
  try {
    const { groupId } = await readBody(request);

    if (!clean(groupId)) {
      return fail("groupId is required", 400);
    }

    const matches = await findRows(SHEETS.groups, GROUP_COLS, (row) => clean(row[COLS.groups.groupId]) === clean(groupId));
    if (!matches.length) {
      return fail("Group not found", 404);
    }

    await clearRow(SHEETS.groups, matches[0].rowNumber, "E");
    return ok({ groupId: clean(groupId) });
  } catch (error) {
    console.error("[DELETE /api/admin/groups]", error);
    return fail("Internal server error");
  }
}