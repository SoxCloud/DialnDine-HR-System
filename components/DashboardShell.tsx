"use client";

import { useAuth } from "@/hooks/useAuth";
import LogoutButton from "./LogoutButton";

interface DashboardShellProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/** Shared layout for protected dashboards: header + logout + content. */
export default function DashboardShell({
  title,
  description,
  children,
}: DashboardShellProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {user && (
            <p className="text-sm text-gray-400">
              {user.name} · {user.role} · {user.employeeId}
            </p>
          )}
        </div>
        <LogoutButton className="rounded bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700" />
      </header>
      {description && <p className="px-6 pt-4 text-sm text-gray-400">{description}</p>}
      <main className="p-6">{children}</main>
    </div>
  );
}