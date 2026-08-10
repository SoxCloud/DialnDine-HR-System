"use client";

import Card from "@/components/Card";
import type { AdminLeaveAgent } from "@/hooks/useAdminDashboard";

/** Simple list of agents currently on approved leave. */
export default function LeaveTodayCard({
  agents,
  loading,
}: {
  agents: AdminLeaveAgent[];
  loading: boolean;
}) {
  return (
    <Card title="Agents on Leave Today">
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-gray-500">No one is on leave today.</p>
      ) : (
        <ul className="divide-y divide-gray-800">
          {agents.map((agent) => (
            <li
              key={agent.employeeId}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <div>
                <p className="text-sm text-gray-200">{agent.name}</p>
                <p className="text-xs text-gray-500">{agent.leaveType}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Returns</p>
                <p className="text-sm font-semibold text-blue-400">
                  {agent.returnDate}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}