"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/hooks/useAuth";
import { useAgentOverview } from "@/hooks/useAgentOverview";

function clockTime(value: string): string {
  if (!value) return "—";
  return String(value).slice(11, 16) || String(value).slice(0, 5);
}

function formatHours(hours: number): string {
  if (!hours || hours <= 0) return "—";
  return Number(hours).toFixed(2);
}

function initials(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function AgentDashboard() {
  return (
    <RequireAuth roles={["Agent"]}>
      <AgentContent />
    </RequireAuth>
  );
}

function AgentContent() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useAgentOverview(user);

  return (
    <DashboardShell
      title="Agent Dashboard"
      description="Your shifts, hours, leave, and credits at a glance."
    >
      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ProfileCard data={data} loading={loading} className="lg:col-span-2" />
          <TodayScheduleCard data={data} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Hours Today" value={loading ? "…" : formatHours(data?.hoursToday ?? 0)} />
          <StatCard label="Hours This Week" value={loading ? "…" : formatHours(data?.hoursWeek ?? 0)} />
          <StatCard label="Hours This Month" value={loading ? "…" : formatHours(data?.hoursMonth ?? 0)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Leave Taken" value={loading ? "…" : data?.leave.leaveTaken ?? "—"} />
          <StatCard label="Leave Remaining" value={loading ? "…" : data?.leave.remaining ?? "—"} />
          <StatCard label="Absent Days (Month)" value={loading ? "…" : data?.absentDays ?? "—"} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LeaveForm onSubmitted={refresh} />
          <AttendanceCard data={data} loading={loading} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <CreditsCard data={data} loading={loading} />
      </section>
    </DashboardShell>
  );
}

function ProfileCard({
  data,
  loading,
  className = "",
}: {
  data: ReturnType<typeof useAgentOverview>["data"];
  loading: boolean;
  className?: string;
}) {
  const statusLabel = data?.onLeaveToday
    ? "On Leave"
    : data?.clockStatus === "clocked_in"
      ? "Clocked In"
      : "Clocked Out";

  return (
    <Card className={className}>
      {loading || !data ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
            {initials(data.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-white">{data.name}</h2>
              <StatusBadge status={statusLabel} />
              {!data.onLeaveToday && data.lateToday && (
                <span className="text-xs font-semibold text-yellow-400">
                  Arrived late
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-400">
              {data.employeeId} · {data.department || "Agent"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-500">Extension</p>
                <p className="text-gray-200">{data.extension || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Group</p>
                <p className="text-gray-200">{data.group?.name || "—"}</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-gray-500">Today</p>
                <p className="text-gray-200">
                  {data.hoursToday > 0 ? `${formatHours(data.hoursToday)}h` : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function TodayScheduleCard({
  data,
  loading,
}: {
  data: ReturnType<typeof useAgentOverview>["data"];
  loading: boolean;
}) {
  const schedule = data?.todaySchedule;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm text-gray-400">Today&apos;s Schedule</h2>
        <Link href="/leave" className="text-xs text-blue-400 hover:text-blue-300">
          Request leave →
        </Link>
      </div>
      {loading || !data ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !schedule ? (
        <p className="text-sm text-gray-500">No group assigned yet.</p>
      ) : schedule.slots.length === 0 ? (
        <div>
          <p className="text-3xl font-bold text-gray-600">Off</p>
          <p className="mt-1 text-sm text-gray-500">
            No shifts scheduled for today.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2">
            {schedule.slots.map((slot) => (
              <span
                key={slot}
                className="rounded-full border border-blue-600/40 bg-blue-950/40 px-3 py-1.5 text-sm font-semibold text-blue-300"
              >
                {slot}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Group · {data.group?.name || "—"}
          </p>
          <div className="mt-4">
            {schedule.onShift ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-green-600/20 px-3 py-1.5 text-xs font-semibold text-green-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                On shift now
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-400">
                Not on shift
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

function LeaveForm({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setMessage(null);

    if (!startDate || !endDate) {
      setMessage({ text: "Pick both a start and end date", tone: "error" });
      return;
    }
    if (endDate < startDate) {
      setMessage({ text: "End date cannot be before the start date", tone: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: user?.employeeId,
          startDate,
          endDate,
          reason,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage({ text: payload.error || "Request failed", tone: "error" });
        return;
      }
      setMessage({
        text: `Leave request ${payload.requestId} submitted`,
        tone: "success",
      });
      setStartDate("");
      setEndDate("");
      setReason("");
      await onSubmitted();
    } catch {
      setMessage({ text: "Something went wrong. Please try again.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Apply for Leave" className="h-fit">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="leave-start" className="mb-1 block text-sm">
              Start Date
            </label>
            <input
              id="leave-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="leave-end" className="mb-1 block text-sm">
              End Date
            </label>
            <input
              id="leave-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <div>
          <label htmlFor="leave-reason" className="mb-1 block text-sm">
            Reason
          </label>
          <textarea
            id="leave-reason"
            rows={3}
            placeholder="e.g. Family emergency, sick leave…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={INPUT_CLASS}
          ></textarea>
        </div>
        <Button type="submit" disabled={submitting || !user} className="w-full">
          {submitting ? "Submitting…" : "Submit Request"}
        </Button>
      </form>
      {message && (
        <p
          className={
            message.tone === "success" ? "mt-4 text-sm text-green-500" : "mt-4 text-sm text-red-500"
          }
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}

function AttendanceCard({
  data,
  loading,
}: {
  data: ReturnType<typeof useAgentOverview>["data"];
  loading: boolean;
}) {
  return (
    <Card title="Attendance History · Last 14 Days" className="min-w-0">
      {loading || !data ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : data.attendance.length === 0 ? (
        <p className="text-sm text-gray-500">No attendance in the last two weeks.</p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-left text-gray-400">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Clock In</th>
                <th className="pb-2 pr-4">Clock Out</th>
                <th className="pb-2 pr-4">Hours</th>
                <th className="pb-2">Late</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.attendance.map((entry) => (
                <tr key={entry.date}>
                  <td className="py-2 pr-4">{entry.date || "—"}</td>
                  <td className="py-2 pr-4">{clockTime(entry.clockIn)}</td>
                  <td className="py-2 pr-4">{clockTime(entry.clockOut)}</td>
                  <td className="py-2 pr-4">{formatHours(entry.hoursWorked)}</td>
                  <td className="py-2">
                    {entry.late ? (
                      <span className="font-semibold text-yellow-400">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CreditsCard({
  data,
  loading,
}: {
  data: ReturnType<typeof useAgentOverview>["data"];
  loading: boolean;
}) {
  const updatedAt = data?.creditsUpdatedAt
    ? String(data.creditsUpdatedAt).replace("T", " ").slice(0, 16)
    : "—";

  return (
    <Card title="Credits">
      {loading || !data ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-bold text-green-400">{data.credits}</p>
            <p className="text-xs text-gray-500">Current credits</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-200">{data.credits > 0 ? "Active" : "No credits yet"}</p>
            <p className="text-xs text-gray-500">Last updated · {updatedAt}</p>
          </div>
        </div>
      )}
    </Card>
  );
}