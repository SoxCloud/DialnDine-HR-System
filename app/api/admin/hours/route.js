/**
 * GET /api/admin/hours
 * Hours worked this month grouped by group. Ungrouped workers are collected
 * under a pseudo "Ungrouped" group.
 * Response:
 * {
 *   groups: [{ groupId, name, monthHours, employees: [{ employeeId, name, monthHours }] }],
 *   totalHours
 * }
 */
import {
  activeEmployees,
  loadEmployees,
  loadGroups,
  loadMonthHours,
} from "../../../../lib/admin";
import { fail, ok } from "../../../../lib/utils";

export async function GET() {
  try {
    const [employees, groups, monthHours] = await Promise.all([
      loadEmployees(),
      loadGroups(),
      loadMonthHours(),
    ]);

    const workers = activeEmployees(employees);
    const byId = new Map(workers.map((employee) => [employee.employeeId, employee.name]));
    const assigned = new Map();
    const memberMap = new Map();

    for (const group of groups) {
      memberMap.set(group.groupId, new Set());
    }
    for (const group of groups) {
      for (const employeeId of group.memberIds) {
        if (!assigned.has(employeeId)) {
          assigned.set(employeeId, group.groupId);
        }
        memberMap.get(group.groupId)?.add(employeeId);
      }
    }

    const round2 = (value) => Math.round(value * 100) / 100;

    const result = groups
      .map((group) => {
        const groupMembers = [...(memberMap.get(group.groupId) || new Set())]
          .filter((employeeId) => byId.has(employeeId))
          .map((employeeId) => ({
            employeeId,
            name: byId.get(employeeId),
            monthHours: round2(monthHours.get(employeeId) || 0),
          }))
          .sort((a, b) => b.monthHours - a.monthHours);

        return {
          groupId: group.groupId,
          name: group.name,
          monthHours: round2(groupMembers.reduce((sum, member) => sum + member.monthHours, 0)),
          employees: groupMembers,
        };
      })
      .sort((a, b) => b.monthHours - a.monthHours);

    const ungrouped = workers
      .filter((employee) => !assigned.has(employee.employeeId))
      .map((employee) => ({
        employeeId: employee.employeeId,
        name: employee.name,
        monthHours: round2(monthHours.get(employee.employeeId) || 0),
      }))
      .sort((a, b) => b.monthHours - a.monthHours);

    if (ungrouped.length) {
      result.push({
        groupId: "ungrouped",
        name: "Ungrouped",
        monthHours: round2(ungrouped.reduce((sum, member) => sum + member.monthHours, 0)),
        employees: ungrouped,
      });
    }

    const totalHours = round2(
      result.reduce((sum, group) => sum + group.monthHours, 0)
    );

    return ok({ groups: result, totalHours });
  } catch (error) {
    console.error("[GET /api/admin/hours]", error);
    return fail("Internal server error");
  }
}