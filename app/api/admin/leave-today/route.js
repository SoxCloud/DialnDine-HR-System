/**
 * GET /api/admin/leave-today
 * Agents currently on approved leave, with the leave type (reason) and return
 * date.
 * Response: { date, agents: [{ employeeId, name, leaveType, returnDate }] }
 */
import {
  loadApprovedLeaveOverlapping,
  loadEmployees,
} from "../../../../lib/admin";
import { fail, ok, todayISO } from "../../../../lib/utils";

export async function GET() {
  try {
    const today = todayISO();
    const [employees, { agents }] = await Promise.all([
      loadEmployees(),
      loadApprovedLeaveOverlapping(today),
    ]);

    const roster = new Map(employees.map((employee) => [employee.employeeId, employee.name]));

    return ok({
      date: today,
      agents: agents.map((agent) => ({
        employeeId: agent.employeeId,
        name: roster.get(agent.employeeId) || agent.employeeId,
        leaveType: agent.leaveType,
        returnDate: agent.returnDate,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/leave-today]", error);
    return fail("Internal server error");
  }
}