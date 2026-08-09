"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, type UserRole } from "@/lib/auth";

interface RequireAuthProps {
  /** Allowed roles. When omitted, any signed-in user passes. */
  roles?: UserRole[];
  children: React.ReactNode;
}

/**
 * Client-side route guard.
 * - No signed-in user  -> redirects to /login
 * - Wrong role         -> redirects to /login
 * - Otherwise renders children.
 */
export default function RequireAuth({ roles, children }: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      router.replace("/login");
      return;
    }
    setChecked(true);
  }, [router, pathname, roles]);

  if (!checked) return null;

  return <>{children}</>;
}