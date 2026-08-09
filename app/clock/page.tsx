"use client";

import { useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/hooks/useAuth";

export default function ClockPage() {
  return (
    <RequireAuth roles={["HR"]}>
      <ClockContent />
    </RequireAuth>
  );
}

function ClockContent() {
  const { user } = useAuth();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [working, setWorking] = useState(false);

  async function postClock(endpoint: string) {
    if (!user || working) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: user.employeeId }),
      });
      const data = await res.json();
      setMessage({
        text: res.ok ? (data.message || "Done") : (data.error || "Request failed"),
        tone: res.ok ? "ok" : "error",
      });
    } catch {
      setMessage({ text: "Something went wrong. Please try again.", tone: "error" });
    } finally {
      setWorking(false);
    }
  }

  if (!user) return <p className="text-white p-6">Loading…</p>;

  return (
    <DashboardShell title="Time Clock" description="Clock in and out for your shift.">
      <p className="text-gray-300 mb-6">
        Signed in as <span className="font-semibold text-white">{user.name}</span>
      </p>

      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          disabled={working}
          onClick={() => postClock("/api/clock-in")}
          className="rounded bg-green-600 px-6 py-3 font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          Clock In
        </button>
        <button
          type="button"
          disabled={working}
          onClick={() => postClock("/api/clock-out")}
          className="rounded bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          Clock Out
        </button>
      </div>

      {message && (
        <p
          className={
            message.tone === "ok" ? "mt-6 text-green-500" : "mt-6 text-red-500"
          }
        >
          {message.text}
        </p>
      )}
    </DashboardShell>
  );
}