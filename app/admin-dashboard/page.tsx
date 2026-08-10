"use client";

import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/hooks/useAuth";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import SummaryCards from "@/components/admin/SummaryCards";
import LiveAttendance from "@/components/admin/LiveAttendance";
import GroupsSection from "@/components/admin/GroupsSection";
import LeaveSection from "@/components/admin/LeaveSection";
import LeaveTodayCard from "@/components/admin/LeaveTodayCard";
import CreditsSection from "@/components/admin/CreditsSection";
import HoursByGroup from "@/components/admin/HoursByGroup";

export default function AdminDashboard() {
  return (
    <RequireAuth roles={["Admin"]}>
      <AdminContent />
    </RequireAuth>
  );
}

function AdminContent() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useAdminDashboard(30000);

  return (
    <DashboardShell
      title="Admin Dashboard"
      description="Attendance, leave, groups, and operational control."
    >
      <section className="space-y-6">
        {error && <p className="text-sm text-red-500">{error}</p>}

        <SummaryCards data={data?.summary} loading={loading} />

        <LiveAttendance
          entries={data?.attendance.entries ?? []}
          employees={data?.groups.employees ?? []}
          today={data?.date ?? ""}
          loading={loading}
          onChanged={refresh}
        />

        <GroupsSection
          groups={data?.groups.groups ?? []}
          employees={data?.groups.employees ?? []}
          loading={loading}
          onChanged={refresh}
        />

        <LeaveSection
          requests={data?.leave.requests ?? []}
          employees={data?.groups.employees ?? []}
          loading={loading}
          adminName={user?.name ?? "Admin"}
          onChanged={refresh}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LeaveTodayCard
            agents={data?.leaveToday.agents ?? []}
            loading={loading}
          />
          <CreditsSection
            rows={data?.credits.credits ?? []}
            loading={loading}
            onChanged={refresh}
          />
        </div>

        <HoursByGroup data={data?.hours} loading={loading} />
      </section>
    </DashboardShell>
  );
}