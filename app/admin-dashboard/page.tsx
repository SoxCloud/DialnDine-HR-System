"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

interface DashboardData {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  totalHoursToday: number;
}

interface AttendanceEntry {
  date: string;
  employeeId: string;
  name: string;
  extension: string;
  clockIn: string;
  clockOut: string;
  hoursWorked: string;
  late: string;
  status: "none" | "clocked_in" | "completed";
}

function clockTime(value: string): string {
  if (!value) return "—";
  return String(value).slice(11, 16) || String(value).slice(0, 5);
}

export default function AdminDashboard() {
  return (
    <RequireAuth roles={["Admin"]}>
      <AdminContent />
    </RequireAuth>
  );
}

function AdminContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/dashboard").then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed"))
      ),
      fetch("/api/attendance-log").then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed"))
      ),
    ])
      .then(([dashboardJson, logJson]) => {
        if (!active) return;
        setData(dashboardJson as DashboardData);
        setEntries((logJson as { entries: AttendanceEntry[] }).entries ?? []);
      })
      .catch(() => {
        if (active) setError("Unable to load dashboard data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardShell
      title="Admin Dashboard"
      description="Monitor who clocked in, when, and when they clocked out."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Employees" value={loading ? "…" : data?.totalEmployees} />
        <StatCard label="Present Today" value={loading ? "…" : data?.presentToday} />
        <StatCard label="Late Today" value={loading ? "…" : data?.lateToday} />
        <StatCard label="Hours Today" value={loading ? "…" : data?.totalHoursToday} />
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <Card title="Attendance Log" className="mt-6">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">No attendance recorded yet.</p>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="text-left text-gray-400">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Employee</th>
                  <th className="pb-2 pr-4">Extension</th>
                  <th className="pb-2 pr-4">Clock In</th>
                  <th className="pb-2 pr-4">Clock Out</th>
                  <th className="pb-2 pr-4">Hours</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {entries.map((entry, index) => (
                  <tr key={`${entry.date}-${entry.employeeId}-${index}`}>
                    <td className="py-2 pr-4">{entry.date || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className="text-gray-300">{entry.name}</span>
                      {entry.employeeId && (
                        <span className="ml-2 text-xs text-gray-600">
                          {entry.employeeId}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {entry.extension || "—"}
                    </td>
                    <td className="py-2 pr-4">{clockTime(entry.clockIn)}</td>
                    <td className="py-2 pr-4">{clockTime(entry.clockOut)}</td>
                    <td className="py-2 pr-4">
                      {Number(entry.hoursWorked) > 0 ? entry.hoursWorked : "—"}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={entry.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}