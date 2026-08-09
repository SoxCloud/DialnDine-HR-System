"use client";

import { useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/hooks/useUserData";

function localISODate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-07-09T08:30:00" | "HH:mm:ss" -> "HH:mm" */
function clockTime(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  return String(value).slice(0, 5);
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
  const { data, loading, refresh } = useUserData(user);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);

  if (!user) {
    return <p className="text-white p-6">Loading…</p>;
  }

  const today = localISODate();
  const todayEntry = data?.attendance.find((entry) => entry.date === today);
  const clockedIn = Boolean(todayEntry?.clockIn);
  const clockedOut = Boolean(todayEntry?.clockOut);

  const statusLabel = clockedOut
    ? "Shift completed"
    : clockedIn
      ? "Clocked in"
      : "Not clocked in yet";

  const recent = (data?.attendance ?? []).slice(0, 5);

  async function postClock(endpoint: "clock-in" | "clock-out") {
    if (working) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: user.employeeId }),
      });
      const body = await res.json();

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
          text: body.error || "Request failed",
          tone: "error",
        });
      }

      await refresh();
    } catch {
      setMessage({
        text: "Something went wrong. Please try again.",
        tone: "error",
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <DashboardShell title="Time Clock" description="Clock in and out for your shift.">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <p className="text-lg text-white">
            Signed in as <span className="font-semibold">{user.name}</span>
          </p>
          <p className="text-sm text-gray-500">
            Employee ID: {user.employeeId} · Today: {today}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button
            variant="success"
            onClick={() => postClock("clock-in")}
            disabled={working || loading || clockedIn}
            className="flex-1"
          >
            {clockedIn ? "Already Clocked In" : "Clock In"}
          </Button>
          <Button
            variant="primary"
            onClick={() => postClock("clock-out")}
            disabled={working || loading || !clockedIn || clockedOut}
            className="flex-1"
          >
            {clockedOut ? "Clocked Out" : "Clock Out"}
          </Button>
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

        <Card title="Today&apos;s Status">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Clocked in</span>
              <span className="font-semibold">
                {clockTime(todayEntry?.clockIn) || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Clocked out</span>
              <span className="font-semibold">
                {clockTime(todayEntry?.clockOut) || "—"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3">
              <span className="text-gray-400">Status</span>
              <span className="font-semibold text-blue-400">{statusLabel}</span>
            </div>
          </div>
        </Card>

        <Card title="Recent Shifts">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-gray-500">No shifts yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recent.map((entry, index) => (
                <li
                  key={`${entry.date}-${index}`}
                  className="flex items-center justify-between"
                >
                  <span className="text-gray-300">{entry.date}</span>
                  <span className="text-gray-500">
                    {clockTime(entry.clockIn) || "—"} –{" "}
                    {clockTime(entry.clockOut) || "…"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}