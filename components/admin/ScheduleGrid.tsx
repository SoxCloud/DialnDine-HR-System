"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { businessToday } from "@/lib/time";
import type { AdminGroup } from "@/hooks/useAdminDashboard";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

/** Hourly slots 08:00..22:00 (15 per day). */
const SLOT_HOURS = Array.from({ length: 15 }, (_, index) => index + 8);

const pad2 = (value: number) => String(value).padStart(2, "0");
const timeLabel = (hour: number) => `${pad2(hour)}:00`;

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type Grid = Map<string, Set<number>>; // groupId -> active hours

/** Admin time-slot grid: rows = hours, columns = groups, toggle cells. */
export default function ScheduleGrid({
  groups,
  loading,
  onChanged,
}: {
  groups: AdminGroup[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [date, setDate] = useState(() => businessToday());
  const [grid, setGrid] = useState<Grid>(new Map());
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [copyTo, setCopyTo] = useState(() => businessToday());
  const [bulkMonth, setBulkMonth] = useState(() => businessToday().slice(0, 7));
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set([1, 2, 3, 4, 5]));

  const load = useCallback(async () => {
    setFetching(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/schedule?date=${encodeURIComponent(date)}`
      );
      if (!res.ok) throw new Error("Failed to load schedule");
      const payload = (await res.json()) as {
        groups: { groupId: string; hours: number[] }[];
      };
      const next: Grid = new Map();
      for (const group of payload.groups) {
        next.set(group.groupId, new Set(group.hours));
      }
      setGrid(next);
    } catch {
      setMessage("Unable to load schedule");
    } finally {
      setFetching(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(groupId: string, hour: number) {
    setGrid((prev) => {
      const next = new Map(prev);
      const hours = new Set(next.get(groupId) || []);
      if (hours.has(hour)) hours.delete(hour);
      else hours.add(hour);
      next.set(groupId, hours);
      return next;
    });
  }

  const activeCount = useMemo(() => {
    let count = 0;
    for (const hours of grid.values()) count += hours.size;
    return count;
  }, [grid]);

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const cells: { groupId: string; hour: number }[] = [];
      for (const [groupId, hours] of grid) {
        for (const hour of hours) cells.push({ groupId, hour });
      }
      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, cells }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setMessage(`Saved ${payload.cells} slot(s) for ${date}`);
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDay() {
    if (busy || !copyTo) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/schedule/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: date, toDate: copyTo }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setMessage(`Copied ${payload.copied} slot(s) to ${copyTo}`);
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function toggleWeekday(value: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function bulkApply() {
    if (busy || weekdays.size === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/schedule/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: date, month: bulkMonth, weekdays: [...weekdays] }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setMessage(
        `Applied ${payload.cells} slot(s) to ${payload.applied} day(s) in ${bulkMonth}`
      );
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Schedule Grid"
      action={
        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-gray-400">{message}</span>}
          <Button
            variant="success"
            size="md"
            className="px-4 py-2 text-sm"
            onClick={save}
            disabled={busy || fetching || groups.length === 0}
          >
            {busy ? "Saving…" : "Save Day"}
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">
          No groups yet. Add a group before scheduling time slots.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm text-gray-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Copy to</label>
              <input
                type="date"
                value={copyTo}
                onChange={(event) => setCopyTo(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              className="px-4 py-2.5 text-sm"
              onClick={copyDay}
              disabled={busy}
            >
              Copy Day
            </Button>
            <Button
              variant="danger"
              size="md"
              className="px-4 py-2.5 text-sm"
              onClick={() => setGrid(new Map())}
              disabled={busy}
            >
              Clear Day
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm text-gray-400">Apply to month</label>
              <input
                type="month"
                value={bulkMonth}
                onChange={(event) => setBulkMonth(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pb-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const active = weekdays.has(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <Button
              variant="primary"
              size="md"
              className="px-4 py-2.5 text-sm"
              onClick={bulkApply}
              disabled={busy || weekdays.size === 0}
            >
              Apply to Month
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            {fetching
              ? "Loading…"
              : `${activeCount} active slot(s) on ${date}. Click a cell to toggle it (filled = active). Blank slots are off.`}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-gray-900 p-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Time
                  </th>
                  {groups.map((group) => (
                    <th
                      key={group.groupId}
                      className="min-w-24 p-1.5 text-center text-xs font-semibold text-gray-300"
                    >
                      <span className="block">{group.name}</span>
                      <span className="block text-[10px] font-normal text-gray-600">
                        {group.groupId}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOT_HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="sticky left-0 bg-gray-900 p-1.5 text-xs text-gray-400">
                      {timeLabel(hour)}
                    </td>
                    {groups.map((group) => {
                      const active = grid.get(group.groupId)?.has(hour) ?? false;
                      return (
                        <td key={group.groupId} className="p-1.5">
                          <button
                            type="button"
                            onClick={() => toggle(group.groupId, hour)}
                            className={`h-9 w-full rounded-lg border text-xs font-semibold transition-colors ${
                              active
                                ? "border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
                                : "border-gray-700 bg-gray-800/60 text-gray-500 hover:border-gray-600 hover:bg-gray-800"
                            }`}
                            aria-label={`${group.groupId} ${timeLabel(hour)} ${active ? "active" : "inactive"}`}
                            aria-pressed={active}
                          >
                            {active ? "On" : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}