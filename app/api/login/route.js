/**
 * POST /api/login
 *
 * Authenticate an employee by email OR employee ID.
 * Returns { employeeId, name, role } or a 404 when no match is found.
 */
import { COLS, SHEETS, getSheetData } from "../../../lib/googleSheets";
import { fail, ok, readBody } from "../../../lib/utils";

export async function POST(request) {
  try {
    const { email, employeeId } = await readBody(request);

    const emailQuery = typeof email === "string" ? email.trim().toLowerCase() : "";
    const idQuery = typeof employeeId === "string" ? employeeId.trim() : "";

    if (!emailQuery && !idQuery) {
      return fail("Provide an email or an employeeId", 400);
    }

    // Only the columns we need: ID, name, email, role.
    const employees = await getSheetData(SHEETS.employees, "A1:F");

    const employee = employees.find((row) => {
      const rowId = String(row[COLS.employees.employeeId] ?? "").trim();
      const rowEmail = String(row[COLS.employees.email] ?? "").trim().toLowerCase();
      return (idQuery && rowId === idQuery) || (emailQuery && rowEmail === emailQuery);
    });

    if (!employee) {
      return fail("User not found", 404);
    }

    // Persist the role in an httpOnly cookie so proxy.ts can gate protected
    // pages even on a hard refresh. The full session stays in localStorage.
    const response = ok({
      employeeId: employee[COLS.employees.employeeId],
      name: employee[COLS.employees.fullName],
      role: employee[COLS.employees.role],
    });

    response.cookies.set("hr_role", String(employee[COLS.employees.role]), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error) {
    console.error("[POST /api/login]", error);
    return fail("Internal server error");
  }
}