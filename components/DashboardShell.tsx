"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import LogoutButton from "./LogoutButton";

interface DashboardShellProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

const NAV_LINKS: { href: string; label: string; roles: string[] }[] = [
  { href: "/admin-dashboard", label: "Admin", roles: ["Admin", "Manager"] },
  { href: "/agent-dashboard", label: "My Stats", roles: ["Admin", "Manager", "Agent", "HR"] },
  { href: "/leave", label: "Leave", roles: ["Admin", "Manager", "Agent", "HR"] },
  { href: "/clock", label: "Clock In / Out", roles: ["Admin", "Manager", "Agent", "HR"] },
];

/** Shared layout for protected dashboards: header + logout + content. */
export default function DashboardShell({
  title,
  description,
  children,
}: DashboardShellProps) {
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-black/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{title}</h1>
            {user && (
              <p className="text-sm text-gray-400">
                {user.name} · {user.role} · {user.employeeId}
              </p>
            )}
          </div>
          <LogoutButton />
        </div>
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {NAV_LINKS.filter(
            (link) => user && link.roles.includes(user.role)
          ).map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {description && <p className="mb-6 text-sm text-gray-400">{description}</p>}
        {children}
      </div>
    </div>
  );
}