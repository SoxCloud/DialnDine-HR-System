/**
 * POST /api/login
 *
 * Two modes:
 *  - KIOSK:  { extension }           -> identify an agent by extension number
 *             (no password, no session cookie) for the time-clock kiosk.
 *  - WEB:    { email, password }     -> full credential login for Admin/HR/Agent.
 * Returns { employeeId, name, role, extension } or an error status.
 */
import { COLS } from "../../../lib/googleSheets";
import { findEmployeeByEmail, findEmployeeByExtension } from "../../../lib/employees";
import { fail, ok, readBody } from "../../../lib/utils";

export async function POST(request) {
  try {
    const { email, password, extension } = await readBody(request);

    // Kiosk login — extension only, never creates a session cookie.
    if (extension) {
      const employee = await findEmployeeByExtension(extension);
      if (!employee) {
        return fail("Invalid extension", 404);
      }
      if (
        String(employee[COLS.employees.status] ?? "").trim().toLowerCase() ===
        "inactive"
      ) {
        return fail("This account is inactive", 403);
      }
      return ok({
        employeeId: employee[COLS.employees.employeeId],
        name: employee[COLS.employees.fullName],
        role: employee[COLS.employees.role],
        extension: String(employee[COLS.employees.extension] ?? "").trim(),
      });
    }

    const emailQuery = typeof email === "string" ? email.trim() : "";
    const passwordQuery = typeof password === "string" ? password : "";

    if (!emailQuery || !passwordQuery) {
      return fail("Email and password are required", 400);
    }

    const employee = await findEmployeeByEmail(emailQuery);

    if (!employee) {
      return fail("No account found with that email", 404);
    }

    if (
      String(employee[COLS.employees.status] ?? "").trim().toLowerCase() ===
      "inactive"
    ) {
      return fail("This account is inactive", 403);
    }

    const storedPassword = String(employee[COLS.employees.password] ?? "");
    if (storedPassword.trim() === "" || storedPassword !== passwordQuery) {
      return fail("Incorrect password", 401);
    }

    // Persist the role in an httpOnly cookie so proxy.ts can gate protected
    // pages even on a hard refresh. The full session stays in localStorage.
    const response = ok({
      employeeId: employee[COLS.employees.employeeId],
      name: employee[COLS.employees.fullName],
      role: employee[COLS.employees.role],
      extension: String(employee[COLS.employees.extension] ?? "").trim(),
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