/**
 * POST /api/login
 *
 * Two modes:
 *  - KIOSK:  { extension }           -> identify an agent by extension number
 *             (no password, no session cookie) for the time-clock kiosk.
 *  - WEB:    { email, password }     -> full credential login for Admin/HR/Agent.
 * Returns { employeeId, name, role, extension } or an error status.
 *
 * Security: WEB login is rate-limited per IP (in-memory sliding window),
 * passwords are verified via scrypt hash (with legacy plaintext fallback),
 * and the session role cookie is HMAC-signed (AUTH_SECRET).
 */
import { COLS } from "../../../lib/googleSheets";
import { findEmployeeByEmail, findEmployeeByExtension } from "../../../lib/employees";
import { verifyPassword } from "../../../lib/passwords";
import { signRole } from "../../../lib/cookieAuth";
import { fail, ok, readBody } from "../../../lib/utils";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

// In-memory sliding window: ip -> [timestamps]. Best-effort rate limit
// (per server instance) to blunt brute-force attempts.
const attempts = new Map();

function ipOf(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((ts) => now - ts < WINDOW_MS);
  attempts.set(ip, recent);
  if (recent.length >= MAX_ATTEMPTS) return true;
  recent.push(now);
  return false;
}

function resetRateLimit(ip) {
  attempts.delete(ip);
}

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

    const ip = ipOf(request);
    if (isRateLimited(ip)) {
      return fail("Too many attempts. Please try again later.", 429);
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
    if (
      storedPassword.trim() === "" ||
      !verifyPassword(passwordQuery, storedPassword)
    ) {
      return fail("Incorrect password", 401);
    }

    resetRateLimit(ip);

    const role = String(employee[COLS.employees.role]);
    const signedRole = await signRole(role);

    // Persist the signed role in an httpOnly cookie so proxy.ts can gate
    // protected pages even on a hard refresh. The full session stays in
    // localStorage.
    const response = ok({
      employeeId: employee[COLS.employees.employeeId],
      name: employee[COLS.employees.fullName],
      role,
      extension: String(employee[COLS.employees.extension] ?? "").trim(),
    });

    response.cookies.set("hr_role", signedRole, {
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