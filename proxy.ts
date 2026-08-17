import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readRoleCookie, verifyRole } from "@/lib/cookieAuth";

/**
 * Route protection for role-scoped pages.
 *
 * The role is read from the `hr_role` cookie set by /api/login and verified
 * against an HMAC signature (AUTH_SECRET) so it cannot be forged.
 * To keep proxy edge-safe we only check the verified role value stored there;
 * localStorage (used by the UI) cannot be read by proxy.
 */

// Everyone (any logged-in role) can reach the kiosk-independent employee
// views (own stats / leave). Admin dashboard is view-only for Managers.
const ALL_ROLES = ["Admin", "Manager", "Agent", "HR"];

const PROTECTED_ROUTES: Record<string, string[]> = {
  "/admin-dashboard": ["Admin", "Manager"],
  "/agent-dashboard": ALL_ROLES,
  "/leave": ALL_ROLES,
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const route = Object.entries(PROTECTED_ROUTES).find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Public path (/, /login, /api/*, static files) — let it through.
  if (!route) {
    return NextResponse.next();
  }

  const allowedRoles = route[1];
  let role: string | null = null;
  try {
    role = await verifyRole(readRoleCookie(request));
  } catch {
    role = null; // AUTH_SECRET missing/unset -> treat as unauthenticated.
  }

  // No verified session, or the session role is not allowed for this page.
  if (!role || !allowedRoles.includes(role)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin-dashboard/:path*",
    "/agent-dashboard/:path*",
    "/leave/:path*",
  ],
};