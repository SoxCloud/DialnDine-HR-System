"use client";

import { useMemo, useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import Modal from "./Modal";
import type { AdminAttendanceEntry } from "@/hooks/useAdminDashboard";
import type { AdminEmployeeOption } from "@/hooks/useAdminDashboard";

const ROW_TINT: Record<string, string> = {
  Present: "bg-green-500/5",
  Late: "bg-yellow-500/10",
  Absent: "bg-red-500/10",
  "On Leave": "bg-blue-500/10",
  Early: "bg-yellow-500/15",
  Overtime: "bg-green-500/15",
};

function clockTime(value: string): string {
  if (!value) return "—";
  return String(value).slice(11, 16) || String(value).slice(0, 5);
}

function formatHours(hours: number): string {
  if (!hours || hours <= 0) return "—";
  return Number(hours).toFixed(2);
}

/** Extract HH:mm from a stored timestamp or time cell. */
function toTimeInput(value: string): string {
  const text = String(value ?? "");
  if (!text) return "";
  if (text.length >= 16) return text.slice(11, 16);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  return "";
}

/** Today's live attendance table with search, edit/add and override actions. */
export default function LiveAttendance({
  entries,
  employees,
  today,
  loading,
  onChanged,
}: {
  entries: AdminAttendanceEntry[];
  employees: AdminEmployeeOption[];
  today: string;
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<{
    employeeId: string;
    name: string;
    hasRecord: boolean;
    status: string;
  } | null>(null);
  const [date, setDate] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.extension.toLowerCase().includes(query)
    );
  }, [entries, search]);

  function getGroupStartTime(employeeId: string): string | null {
    const emp = employees.find((e) => e.employeeId === employeeId);
    return emp?.startTime ?? null;
  }

  function getGroupEndTime(employeeId: string): string | null {
    const emp = employees.find((e) => e.employeeId === employeeId);
    return emp?.endTime ?? null;
  }

  function getIsEarly(employeeId: string): boolean {
    const start = getGroupStartTime(employeeId);
    if (!start) return false;
    const ci = typeof entries.find((e) => e.employeeId === employeeId)?.clockIn ?? "";
    return toTimeInput(ci) < start;
  }

  function getIsOvertime(employeeId: string): boolean {
    const end = getGroupEndTime(employeeId);
    if (!end) return false;
    const co = typeof entries.find((e) => e.employeeId === employeeId)?.clockOut ?? "";
    return toTimeInput(co) > end;
  }

  function openEdit(entry: AdminAttendanceEntry) {
    setDraft({
      employeeId: entry.employeeId,
      name: entry.name,
      hasRecord: Boolean(entry.clockIn),
      status: entry.status,
    });
    setDate(today);
    setClockIn(toTimeInput(entry.clockIn));
    setClockOut(toTimeInput(entry.clockOut));
    setMessage(null);
  }

  function openAdd() {
    setDraft({ employeeId: "", name: "", hasRecord: false, status: "" });
    setDate(today);
    setClockIn("");
    setClockOut("");
    setMessage(null);
  }

  async function save() {
    if (!draft || busy) return;
    if (!draft.employeeId) {
      setMessage("Pick an employee");
      return;
    }
    if (!clockIn) {
      setMessage("Set a clock-in time");
      return;
    }
    if (clockOut && clockOut <= clockIn) {
      setMessage("Clock-out must be after clock-in");
      return;
    }
    if (!date) {
      setMessage("Pick a date");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const body = JSON.stringify({
        date,
        employeeId: draft.employeeId,
        clockIn: `${date}T${clockIn}`,
        clockOut: clockOut ? `${date}T${clockOut}` : "",
      });
      const method = draft.hasRecord ? "PUT" : "POST";
      const res = await fetch("/api/admin/attendance", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setDraft(null);
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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
          <Button
            size="md"
            className="px-3 py-1.5 text-xs"
            onClick={openAdd}
            disabled={busy}
          >
            Add Attendance
          </Button>
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
                <th className="pb-2 pr-4">Hours Worked</th>
                <th className="pb-2">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((entry) => {
                const employeeId = entry.employeeId;
                const groupStart = getGroupStartTime(employeeId);
                const groupEnd = getGroupEndTime(employeeId);
                const isEarly = getIsEarly(employeeId);
                const isOvertime = getIsOvertime(employeeId);
                const tint = {
                  Present: "ROW_TINT.Present",
                  Late: "ROW_TINT.Late",
                  Absent: "ROW_TINT.Absent",
                  "On Leave": "ROW_TINT["On Leave"]",
                }[entry.status] ?? "";
                const earlyFlag = isEarly ? "Early" : "";
                const overtimeFlag = isOvertime ? "Overtime" : "";
                const flags = [earlyFlag, overtimeFlag].filter(Boolean).join(" ");
                return (
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
                    <td className="py-2.5 pr-4">{formatHours(entry.hoursWorked)}</td>
                    <td className="py-2.5">
                      <span className="capitalize text-xs font-medium text-blue-600">
                        {flags || ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal
          title={
            draft.employeeId
              ? draft.hasRecord
                ? `Edit Attendance · ${draft.name}`
                : `Override Absence · ${draft.name}`
              : "Add Manual Attendance"
          }
          onClose={() => !busy && setDraft(null)}
        >
          <div className="space-y-4">
            {!draft.employeeId && (
              <div>
                <label className="mb-1 block text-sm">Employee</label>
                <select
                  value={draft.employeeId}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, employeeId: event.target.value } : prev
                    )
                  }
                  className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select an employee…</option>
                  {employees.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.name} · {employee.employeeId}
                    </option>
                  ))
                }
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm">Date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm">Clock In</label>
                <input
                  type="time"
                  value={clockIn}
                  onChange={(event) => setClockIn(event.target.value)}
                  className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">Clock Out</label>
                <input
                  type="time"
                  value={clockOut}
                  onChange={(event) => setClockOut(event.target.value)}
                  className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          {message && <p className="mt-4 text-sm text-red-500">{message}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="danger"
              size="md"
              className="px-4 py-2 text-sm"
              onClick={() => setDraft(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="md"
              className="px-4 py-2 text-sm"
              onClick={save}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}