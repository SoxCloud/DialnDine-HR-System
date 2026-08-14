/**
 * lib/auth.ts
 *
 * Client-side session helpers. The session lives in localStorage so it is
 * never sent to the server; the API routes never see credentials.
 */

export type UserRole = "Admin" | "Manager" | "Agent" | "HR";

export interface User {
  employeeId: string;
  name: string;
  role: UserRole;
}

export const STORAGE_KEY = "dialndine_hr_user";

/** Read the current user from localStorage (null when not logged in). */
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as User;
    if (!user?.employeeId || !user?.role) return null;
    return user;
  } catch {
    return null;
  }
}

/** Persist the user session from /api/login. */
export function setUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

/** Clear the session (localStorage + role cookie) and return to /login. */
export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  fetch("/api/logout", { method: "POST" }).finally(() => {
    window.location.href = "/login";
  });
}