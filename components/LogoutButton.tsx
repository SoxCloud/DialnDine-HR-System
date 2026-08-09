"use client";

import { logout } from "@/lib/auth";

/** Logout button used across all dashboards. */
export default function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={logout} className={className}>
      Logout
    </button>
  );
}