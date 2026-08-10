"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/auth";

export interface AgentOverview {
  employeeId: string;
  name: string;
  extension: string;
  department: string;
  group: { name: string; startTime: string; endTime: string } | null;
  clockStatus: "clocked_in" | "clocked_out";
  onLeaveToday: boolean;
  lateToday: boolean;
  hoursToday: number;
  hoursWeek: number;
  hoursMonth: number;
  leave: { totalLeave: number; leaveTaken: number; remaining: number };
  absentDays: number;
  credits: number;
  creditsUpdatedAt: string;
  nextShift: { date: string; startTime: string; endTime: string } | null;
  attendance: {
    date: string;
    clockIn: string;
    clockOut: string;
    hoursWorked: number;
    late: boolean;
  }[];
}

/**
 * Fetch the signed-in agent's own overview from /api/user-data.
 * Expose `refresh()` so leave submissions can update the dashboard.
 */
export function useAgentOverview(user: User | null) {
  const [data, setData] = useState<AgentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/user-data?employeeId=${encodeURIComponent(user.employeeId)}`
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const payload = (await res.json()) as AgentOverview;
      setData(payload);
    } catch {
      setError("Unable to load your dashboard");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}