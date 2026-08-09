"use client";

import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";

export default function AgentDashboard() {
  return (
    <RequireAuth roles={["Agent"]}>
      <DashboardShell title="Agent Dashboard" description="Your schedule and leave summary.">
        <div className="rounded-lg bg-gray-900 border border-gray-800 p-5">
          <p className="text-sm text-gray-400">Next steps</p>
          <ul className="mt-2 space-y-2 text-sm">
            <li>· Clock in/out for your shift</li>
            <li>· Submit a leave request</li>
            <li>· Check your leave balance</li>
          </ul>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}