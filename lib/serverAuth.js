/**
 * lib/serverAuth.js
 *
 * Server-side authorization for API routes. Verifies the signed `hr_role`
 * cookie (see lib/cookieAuth.js) and checks the caller's role.
 * Node-runtime only (route handlers).
 */
import { readRoleCookie, verifyRole } from "./cookieAuth";

/**
 * Resolve the authenticated role for a request, or null when unauthenticated.
 * Throws when AUTH_SECRET is missing.
 */
export async function getAuthenticatedRole(request) {
  const raw = readRoleCookie(request);
  if (!raw) return null;
  return verifyRole(raw);
}

/**
 * Require the caller to hold one of `allowedRoles`.
 * Returns the role string on success; otherwise returns null.
 */
export async function requireRole(request, allowedRoles) {
  const role = await getAuthenticatedRole(request);
  if (!role || !allowedRoles.includes(role)) return null;
  return role;
}

/** Convenience: only Admin may pass. */
export async function requireAdmin(request) {
  return requireRole(request, ["Admin"]);
}

/** Convenience: Admin or Manager may pass (manager read-only pages). */
export async function requireAdminOrManager(request) {
  return requireRole(request, ["Admin", "Manager"]);
}

/** Convenience: any signed-in employee (Admin/Manager/Agent/HR). */
export async function requireAnyUser(request) {
  return requireRole(request, ["Admin", "Manager", "Agent", "HR"]);
}