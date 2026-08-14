/**
 * lib/roles.ts
 *
 * Role -> landing route mapping used after login and on the root page.
 */
import type { UserRole } from "./auth";

export const ROLE_REDIRECTS: Record<UserRole, string> = {
  Admin: "/admin-dashboard",
  Manager: "/admin-dashboard",
  Agent: "/agent-dashboard",
  HR: "/clock",
};

/** Resolve the landing path for a role (falls back to /login). */
export function redirectPathForRole(role: string | null | undefined): string {
  if (role && role in ROLE_REDIRECTS) {
    return ROLE_REDIRECTS[role as UserRole];
  }
  return "/login";
}