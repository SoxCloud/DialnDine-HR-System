"use client";

import { useCallback, useEffect, useState } from "react";

export interface AdminSummary {
  totalWorkers: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
}

export interface AdminAttendanceEntry {
  employeeId: string;
  name: string;
  extension: string;
  group: string;
  status: "Present" | "Late" | "Absent" | "On Leave";
  clockIn: string;
  clockOut: string;
  hoursWorked: number;
}

export interface AdminAttendance {
  entries: AdminAttendanceEntry[];
  summary: { present: number; late: number; absent: number; onLeave: number };
}

export interface AdminGroup {
  groupId: string;
  name: string;
  startTime: string;
  endTime: string;
  memberIds: string[];
  members: { employeeId: string; name: string }[];
}

export interface AdminEmployeeOption {
  employeeId: string;
  name: string;
  extension: string;
  startTime?: string;
  endTime?: string;
}

export interface AdminLeaveRequest {
  requestId: string;
  employeeId: string;
  name: string;
  startDate: string;
  endDate: string;
  days: number | string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  approvedBy: string;
}

export interface AdminLeaveAgent {
  employeeId: string;
  name: string;
  leaveType: string;
  returnDate: string;
}

export interface AdminCreditRow {
  employeeId: string;
  name: string;
  amount: number;
  hours: number;
  credits: number;
  updatedAt: string | null;
}

export interface AdminCreditLogEntry {
  date: string;
  employeeId: string;
  name: string;
  type: string;
  store: string;
  customerDetails: string;
  reason: string;
  amount: number;
  hours: number;
  createdAt: string;
}

export interface AdminMonthEndCandidate {
  employeeId: string;
  name: string;
  hoursAfter25th: number;
}

export interface AdminHoursEmployee {
  employeeId: string;
  name: string;
  monthHours: number;
}

export interface AdminHoursGroup {
  groupId: string;
  name: string;
  monthHours: number;
  employees: AdminHoursEmployee[];
}

export interface AdminHoursByGroup {
  groups: AdminHoursGroup[];
  totalHours: number;
}

export interface AdminDashboardData {
  date: string;
  summary: AdminSummary;
  attendance: AdminAttendance;
  groups: { groups: AdminGroup[]; employees: AdminEmployeeOption[] };
  leave: { requests: AdminLeaveRequest[] };
  leaveToday: { agents: AdminLeaveAgent[] };
  credits: { credits: AdminCreditRow[]; log: AdminCreditLogEntry[] };
  hours: AdminHoursByGroup;
}

/**
 * Fetch the consolidated Admin dashboard payload from /api/dashboard.
 * Optionally polls on an interval (milliseconds); pass `refreshIntervalMs` to
 * keep the live attendance table up to date. Expose `refresh()` for after
 * mutations (groups, leave, credits).
 */
export function useAdminDashboard(refreshIntervalMs?: number) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const payload = (await res.json()) as AdminDashboardData;
      setData(payload);
      setError(null);
    } catch {
      setError("Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!refreshIntervalMs) return;
    const timer = window.setInterval(refresh, refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [refresh, refreshIntervalMs]);

  return { data, loading, error, refresh };
}