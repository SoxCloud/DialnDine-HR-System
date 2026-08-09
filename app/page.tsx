"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { redirectPathForRole } from "@/lib/roles";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? redirectPathForRole(user.role) : "/login");
  }, [router, user, loading]);

  return null;
}