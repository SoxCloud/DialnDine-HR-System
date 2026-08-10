"use client";

import StatCard from "@/components/StatCard";
import type { AdminSummary } from "@/hooks/useAdminDashboard";

/** Top-row counts: Total Workers, Present, Absent and On Leave today. */
export default function SummaryCards({
  data,
  loading,
}: {
  data?: AdminSummary;
  loading: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Workers" value={loading ? "…" : data?.totalWorkers} />
        <StatCard label="Present Today" value={loading ? "…" : data?.presentToday} />
        <StatCard label="Absent Today" value={loading ? "…" : data?.absentToday} />
        <StatCard label="On Leave Today" value={loading ? "…" : data?.onLeaveToday} />
      </div>
    </div>
  );
}