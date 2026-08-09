"use client";

import Card from "@/components/Card";
import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/hooks/useUserData";

export default function AgentDashboard() {
  return (
    <RequireAuth roles={["Agent"]}>
      <AgentContent />
    </RequireAuth>
  );
}

function AgentContent() {
  const { user } = useAuth();
  const { data, loading, error } = useUserData(user);

  return (
    <DashboardShell
      title="Agent Dashboard"
      description="Your attendance, hours, and leave at a glance."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Shifts Logged" value={loading ? "…" : data?.attendance.length} />
        <StatCard label="Total Hours" value={loading ? "…" : data?.totalHours} />
        <StatCard label="Leave Used" value={loading ? "…" : data?.leaveBalance.usedLeave} />
        <StatCard label="Leave Remaining" value={loading ? "…" : data?.leaveBalance.remainingLeave} />
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Recent Shifts" className="min-w-0">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : data && data.attendance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Clock In</th>
                    <th className="pb-2 pr-4">Clock Out</th>
                    <th className="pb-2">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data.attendance.slice(0, 8).map((entry, index) => (
                    <tr key={`${entry.date}-${index}`}>
                      <td className="py-2 pr-4">{entry.date || "—"}</td>
                      <td className="py-2 pr-4">{String(entry.clockIn).slice(0, 5) || "—"}</td>
                      <td className="py-2 pr-4">{String(entry.clockOut).slice(0, 5) || "—"}</td>
                      <td className="py-2">
                        {Number(entry.hoursWorked) > 0 ? entry.hoursWorked : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No attendance yet.</p>
          )}
        </Card>

        <Card title="Leave Status" className="min-w-0">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : data && data.leave.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {data.leave.slice(0, 8).map((request) => (
                <li
                  key={request.requestId}
                  className="flex items-center justify-between"
                >
                  <span className="text-gray-300">
                    {request.startDate} → {request.endDate} ({request.days}d)
                  </span>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No leave requests yet.</p>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}