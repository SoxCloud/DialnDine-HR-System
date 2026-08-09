"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, type User } from "@/lib/auth";

/**
 * React hook exposing the current localStorage session.
 * `loading` is true until the session has been read.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getCurrentUser());
    setLoading(false);
  }, []);

  const refresh = useCallback(() => setUser(getCurrentUser()), []);

  return { user, loading, refresh };
}