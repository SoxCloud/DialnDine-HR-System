"use client";

import { useMemo, useState } from "react";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import type { AdminAttendanceEntry } from "@/hooks/useAdminDashboard";

const ROW_TINT: Record<string, string> = {
  Present: "bg-green-500/5",
  Late: "bg-yellow-500/10",
  Absent: "bg-red-500/10",
  "On Leave": "bg-blue-500/10",
};

function clockTime(value: string): string {
  if (!value) return "—";
  return String(value).slice(11, 16) || String(value).slice(0, 5);
}

function formatHours(hours: number): string {
  if (!hours || hours <= 0) return "—";
  return Number(hours).toFixed(2);
}

/** Today's live attendance table with search and status highlighting. */
export default function LiveAttendance({
  entries,
  loading,
}: {
  entries: AdminAttendanceEntry[];
  loading: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.extension.toLowerCase().includes(query)
    );
  }, [entries, search]);

  return (
    <Card
      title="Live Attendance · Today"
      action={
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search name or extension"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-56 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">
          {entries.length === 0 ? "No attendance recorded today yet." : "No workers match your search."}
        </p>
      ) : (
        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-left text-gray-400">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Extension</th>
                <th className="pb-2 pr-4">Group</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Clock In</th>
                <th className="pb-2 pr-4">Clock Out</th>
                <th className="pb-2">Hours Worked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((entry) => (
                <tr
                  key={entry.employeeId}
                  className={`${ROW_TINT[entry.status] ?? ""} transition-colors`}
                >
                  <td className="py-2.5 pr-4">
                    <span className="text-gray-200">{entry.name}</span>
                    <span className="ml-2 text-xs text-gray-600">{entry.employeeId}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500">{entry.extension || "—"}</td>
                  <td className="py-2.5 pr-4 text-gray-400">{entry.group}</td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="py-2.5 pr-4">{clockTime(entry.clockIn)}</td>
                  <td className="py-2.5 pr-4">{clockTime(entry.clockOut)}</td>
                  <td className="py-2.5">{formatHours(entry.hoursWorked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}