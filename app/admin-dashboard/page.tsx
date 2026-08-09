"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";

interface DashboardData {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  totalHoursToday: number;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then((json: DashboardData) => {
        if (active) setData(json);
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
    <RequireAuth roles={["Admin"]}>
      <DashboardShell
        title="Admin Dashboard"
        description="Manage employees, approve leave, and monitor attendance."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Employees" value={loading ? "…" : data?.totalEmployees} />
          <StatCard label="Present Today" value={loading ? "…" : data?.presentToday} />
          <StatCard label="Late Today" value={loading ? "…" : data?.lateToday} />
          <StatCard label="Hours Today" value={loading ? "…" : data?.totalHoursToday} />
        </div>
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </DashboardShell>
    </RequireAuth>
  );
}

function StatCard({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-3xl font-bold mt-1">{value ?? "—"}</p>
    </div>
  );
}