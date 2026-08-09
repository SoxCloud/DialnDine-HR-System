"use client";

import { useCallback, useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceStatus {
  employeeId: string;
  date: string;
  clockIn: string | number;
  clockOut: string | number;
  status: "none" | "clocked_in" | "completed";
}

/** "2026-07-09T08:30:00" | "HH:mm:ss" | Sheets serial -> "HH:mm" */
function formatClockTime(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  return String(value).slice(0, 5);
}

function localISODate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ClockPage() {
  return (
    <RequireAuth roles={["HR"]}>
      <ClockContent />
    </RequireAuth>
  );
}

function ClockContent() {
  const { user } = useAuth();
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/attendance-status?employeeId=${encodeURIComponent(user.employeeId)}`
      );
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // keep the last known status
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function postClock(endpoint: "clock-in" | "clock-out") {
    if (!user || working) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: user.employeeId }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          text:
            endpoint === "clock-in"
              ? "Clocked in successfully"
              : "Clocked out successfully",
          tone: "success",
        });
      } else {
        setMessage({
          text: data.error || "Request failed",
          tone: "error",
        });
      }

      await refreshStatus();
    } catch {
      setMessage({
        text: "Something went wrong. Please try again.",
        tone: "error",
      });
    } finally {
      setWorking(false);
    }
  }

  if (!user) {
    return <p className="text-white p-6">Loading…</p>;
  }

  const clockedIn = Boolean(status?.clockIn);
  const clockedOut = Boolean(status?.clockOut);

  const statusLabel =
    status?.status === "completed"
      ? "Shift completed"
      : status?.status === "clocked_in"
        ? "Clocked in"
        : "Not clocked in yet";

  return (
    <DashboardShell title="Time Clock" description="Clock in and out for your shift.">
      <div className="max-w-md space-y-6">
        <div>
          <p className="text-lg text-white">
            Signed in as <span className="font-semibold">{user.name}</span>
          </p>
          <p className="text-sm text-gray-400">
            Employee ID: {user.employeeId} · Today: {status?.date ?? localISODate()}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => postClock("clock-in")}
            disabled={working || loading || clockedIn}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {clockedIn ? "Already Clocked In" : "Clock In"}
          </button>
          <button
            type="button"
            onClick={() => postClock("clock-out")}
            disabled={working || loading || !clockedIn || clockedOut}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {clockedOut ? "Clocked Out" : "Clock Out"}
          </button>
        </div>

        {message && (
          <p
            className={
              message.tone === "success" ? "text-green-500" : "text-red-500"
            }
          >
            {message.text}
          </p>
        )}

        <div className="rounded-lg bg-gray-900 border border-gray-800 p-5">
          <h2 className="text-sm text-gray-400 mb-4">Today&apos;s Status</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Clocked in</span>
              <span className="font-semibold">
                {formatClockTime(status?.clockIn) || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Clocked out</span>
              <span className="font-semibold">
                {formatClockTime(status?.clockOut) || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <span className="text-gray-400">Status</span>
              <span className="font-semibold text-blue-400">{statusLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}