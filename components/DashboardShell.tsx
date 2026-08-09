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
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-black/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {user && (
              <p className="text-sm text-gray-400">
                {user.name} · {user.role} · {user.employeeId}
              </p>
            )}
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {description && <p className="mb-6 text-sm text-gray-400">{description}</p>}
        {children}
      </div>
    </div>
  );
}