"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/auth";

export interface AttendanceEntry {
  date: string;
  clockIn: string;
  clockOut: string;
  hoursWorked: string | number;
  late: string;
  notes: string;
}

export interface LeaveEntry {
  requestId: string;
  startDate: string;
  endDate: string;
  days: string | number;
  status: string;
}

export interface LeaveBalance {
  totalLeave: number;
  usedLeave: number;
  remainingLeave: number;
}

export interface UserData {
  employeeId: string;
  attendance: AttendanceEntry[];
  leave: LeaveEntry[];
  totalHours: number;
  leaveBalance: LeaveBalance;
}

/**
 * Fetch an employee's personal data from /api/user-data.
 * Refreshed automatically when the user changes; expose `refresh()` for
 * after clock-in/out or leave submissions.
 */
export function useUserData(user: User | null) {
  const [data, setData] = useState<UserData | null>(null);
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
      const payload = (await res.json()) as UserData;
      setData(payload);
    } catch {
      setError("Unable to load your data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}