import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection for role-scoped pages.
 *
 * The role is read from the `hr_role` cookie set by /api/login.
 * To keep proxy edge-safe we only check the role value stored there;
 * localStorage (used by the UI) cannot be read by proxy.
 */

const SESSION_ROLE_COOKIE = "hr_role";

const PROTECTED_ROUTES: Record<string, string[]> = {
  "/admin-dashboard": ["Admin"],
  "/agent-dashboard": ["Agent"],
  "/leave": ["Agent"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const route = Object.entries(PROTECTED_ROUTES).find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Public path (/, /login, /api/*, static files) — let it through.
  if (!route) {
    return NextResponse.next();
  }

  const allowedRoles = route[1];
  const role = request.cookies.get(SESSION_ROLE_COOKIE)?.value;

  // No session, or the session role is not allowed for this page.
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