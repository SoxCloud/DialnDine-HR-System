"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/hooks/useAuth";

type LeaveStatus = "Pending" | "Approved" | "Rejected";

interface LeaveRequest {
  requestId: string;
  startDate: string;
  endDate: string;
  days: number | string;
  status: LeaveStatus;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

export default function LeavePage() {
  return (
    <RequireAuth roles={["Agent"]}>
      <LeaveContent />
    </RequireAuth>
  );
}

function LeaveContent() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/leave-requests?employeeId=${encodeURIComponent(user.employeeId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch {
      // keep last known list
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || submitting) return;
    setMessage(null);

    if (!startDate || !endDate) {
      setMessage({ text: "Pick both a start and end date", tone: "error" });
      return;
    }
    if (endDate < startDate) {
      setMessage({
        text: "End date cannot be before the start date",
        tone: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: user.employeeId,
          startDate,
          endDate,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.error || "Request failed", tone: "error" });
        return;
      }

      setMessage({
        text: `Leave request ${data.requestId} submitted`,
        tone: "success",
      });
      setStartDate("");
      setEndDate("");
      await refresh();
    } catch {
      setMessage({
        text: "Something went wrong. Please try again.",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell
      title="Leave Requests"
      description="Request time off and track its status."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="New Request" className="h-fit">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="start-date" className="mb-1 block text-sm">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="end-date" className="mb-1 block text-sm">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full py-3">
              {submitting ? "Submitting…" : "Submit Request"}
            </Button>
          </form>
          {message && (
            <p
              className={
                message.tone === "success" ? "mt-4 text-green-500" : "mt-4 text-red-500"
              }
            >
              {message.text}
            </p>
          )}
        </Card>

        <Card title="My Requests" className="min-w-0">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500">No leave requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="pb-2 pr-4">Start</th>
                    <th className="pb-2 pr-4">End</th>
                    <th className="pb-2 pr-4">Days</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {requests.map((request) => (
                    <tr key={request.requestId}>
                      <td className="py-2 pr-4">{request.startDate || "—"}</td>
                      <td className="py-2 pr-4">{request.endDate || "—"}</td>
                      <td className="py-2 pr-4">{request.days ?? "—"}</td>
                      <td className="py-2">
                        <StatusBadge status={request.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}