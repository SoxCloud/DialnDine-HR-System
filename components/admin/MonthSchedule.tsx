"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { businessToday } from "@/lib/time";
import type { AdminGroup } from "@/hooks/useAdminDashboard";

type Shift = { startTime: string; endTime: string };
type Model = Record<string, Shift>; // date "YYYY-MM-DD" -> shift (missing = off)

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

const WEEK_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const pad2 = (value: number) => String(value).padStart(2, "0");

/** Normalize a stored time ("09:00:00" | "9:00") to an <input type="time"> value. */
function toHHMM(value: string): string {
  const match = /(\d{1,2}):(\d{2})/.exec(value || "");
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

/** First N cells: leading nulls pad the first week to a Monday start. */
function monthCells(month: string): (string | null)[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const offsets = (firstDow + 6) % 7; // Monday-first
  const cells: (string | null)[] = Array(offsets).fill(null);
  for (let day = 1; day <= total; day++) {
    cells.push(`${month}-${pad2(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function todayMonday(label: string): boolean {
  return label === "Mo";
}

/** Weekly / monthly group schedule editor. */
export default function MonthSchedule({
  groups,
  loading,
  onChanged,
}: {
  groups: AdminGroup[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [month, setMonth] = useState(() => businessToday().slice(0, 7));
  const [model, setModel] = useState<Model>({});
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPattern, setShowPattern] = useState(false);
  const [weekdays, setWeekdays] = useState<Set<number>>(
    () => new Set([1, 2, 3, 4, 5])
  );
  const [patternStart, setPatternStart] = useState("09:00");
  const [patternEnd, setPatternEnd] = useState("21:00");

  const days = useMemo(() => monthCells(month), [month]);

  // Default to the first group once groups load.
  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].groupId);
    }
  }, [groups, selectedGroupId]);

  const load = useCallback(async () => {
    if (!selectedGroupId) return;
    setFetching(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/schedule?groupId=${encodeURIComponent(selectedGroupId)}&month=${encodeURIComponent(month)}`
      );
      if (!res.ok) throw new Error("Failed to load schedule");
      const payload = (await res.json()) as {
        days: { date: string; off?: boolean; startTime?: string; endTime?: string }[];
      };
      const next: Model = {};
      for (const day of payload.days) {
        if (!day.off && day.startTime) {
          next[day.date] = {
            startTime: toHHMM(day.startTime),
            endTime: day.endTime ? toHHMM(day.endTime) : "",
          };
        }
      }
      setModel(next);
    } catch {
      setMessage("Unable to load schedule");
    } finally {
      setFetching(false);
    }
  }, [selectedGroupId, month]);

  useEffect(() => {
    load();
  }, [load]);

  function setShift(date: string, startTime: string, endTime: string) {
    setModel((prev) => {
      const next = { ...prev };
      if (startTime) next[date] = { startTime, endTime };
      else if (!endTime) delete next[date];
      else next[date] = { startTime, endTime };
      return next;
    });
  }

  function clearDay(date: string) {
    setModel((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }

  function toggleWeekday(value: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function fillWeekdays() {
    setModel((prev) => {
      const next = { ...prev };
      for (const date of days) {
        if (!date) continue;
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
        if (weekdays.has(dow)) {
          next[date] = { startTime: patternStart, endTime: patternEnd };
        }
      }
      return next;
    });
  }

  function clearMonth() {
    setModel({});
    setMessage(null);
  }

  const scheduledCount = Object.values(model).filter((shift) => shift.startTime).length;

  async function save() {
    if (busy || !selectedGroupId) return;
    setBusy(true);
    setMessage(null);
    try {
      const overrides = Object.entries(model)
        .filter(([, shift]) => shift.startTime)
        .map(([date, shift]) => ({
          date,
          startTime: toHHMM(shift.startTime),
          endTime: shift.endTime ? toHHMM(shift.endTime) : "",
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId, month, overrides }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      const next: Model = {};
      for (const day of payload.days as { date: string; off?: boolean; startTime?: string; endTime?: string }[]) {
        if (!day.off && day.startTime) {
          next[day.date] = {
            startTime: toHHMM(day.startTime),
            endTime: day.endTime ? toHHMM(day.endTime) : "",
          };
        }
      }
      setModel(next);
      setMessage("Schedule saved");
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Monthly Schedule"
      action={
        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-gray-400">{message}</span>}
          <Button
            variant="success"
            size="md"
            className="px-4 py-2 text-sm"
            onClick={save}
            disabled={busy || !selectedGroupId}
          >
            {busy ? "Saving…" : "Save Schedule"}
          </Button>
        </div>
      }
    >
      {loading || (groups.length === 0 && loading) ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">
          No groups yet. Add a group before scheduling monthly shifts.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="mb-1 block text-sm text-gray-400">Group</label>
              <select
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
                className={INPUT_CLASS}
              >
                {groups.map((group) => (
                  <option key={group.groupId} value={group.groupId}>
                    {group.name} · {group.groupId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Month</label>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              className="px-4 py-2.5 text-sm"
              onClick={() => setShowPattern((prev) => !prev)}
              disabled={busy}
            >
              {showPattern ? "Hide" : "Fill Weekdays"}
            </Button>
            <Button
              variant="danger"
              size="md"
              className="px-4 py-2.5 text-sm"
              onClick={clearMonth}
              disabled={busy}
            >
              Set All Off
            </Button>
          </div>

          {showPattern && (
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
              <p className="mb-3 text-xs text-gray-500">
                Apply a repeating shift to the selected weekdays of {month}. You
                can still change individual days below afterwards.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1.5">
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
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={patternStart}
                    onChange={(event) => setPatternStart(event.target.value)}
                    className={`${INPUT_CLASS} w-32 px-3 py-1.5 text-sm`}
                    aria-label="Pattern start time"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={patternEnd}
                    onChange={(event) => setPatternEnd(event.target.value)}
                    className={`${INPUT_CLASS} w-32 px-3 py-1.5 text-sm`}
                    aria-label="Pattern end time"
                  />
                </div>
                <Button
                  variant="primary"
                  size="md"
                  className="px-4 py-1.5 text-sm"
                  onClick={fillWeekdays}
                  disabled={weekdays.size === 0}
                >
                  Fill
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            {fetching ? "Loading…" : `${scheduledCount} day(s) scheduled in ${month}. Blank days are off / not working.`}
          </p>

          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 gap-1.5">
                {WEEK_LABELS.map((label) => (
                  <div
                    key={label}
                    className={`text-center text-[11px] font-semibold uppercase tracking-wide ${
                      todayMonday(label) ? "text-blue-400" : "text-gray-500"
                    }`}
                  >
                    {label}
                  </div>
                ))}
                {days.map((date, index) => {
                  if (!date) return <div key={`pad-${index}`} />;
                  const shift = model[date];
                  const dayNumber = Number(date.slice(8, 10));
                  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
                  const weekend = dow === 0 || dow === 6;
                  return (
                    <div
                      key={date}
                      className={`rounded-lg border p-1.5 ${
                        shift?.startTime
                          ? "border-blue-600/40 bg-blue-950/40"
                          : weekend
                            ? "border-gray-800/60 bg-gray-950/30"
                            : "border-gray-800 bg-gray-950/60"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`text-[11px] font-semibold ${
                            weekend ? "text-gray-500" : "text-gray-300"
                          }`}
                        >
                          {dayNumber}
                        </span>
                        {shift?.startTime && (
                          <button
                            type="button"
                            onClick={() => clearDay(date)}
                            className="rounded px-1 text-[11px] leading-none text-gray-500 hover:text-red-400"
                            aria-label={`Clear ${date}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        <input
                          type="time"
                          value={shift?.startTime ?? ""}
                          onChange={(event) =>
                            setShift(
                              date,
                              event.target.value,
                              shift?.endTime ?? ""
                            )
                          }
                          className="w-full rounded border border-gray-700/70 bg-gray-800 px-1 py-0.5 text-[11px] text-white outline-none focus:border-blue-500"
                          aria-label={`Start ${date}`}
                        />
                        <input
                          type="time"
                          value={shift?.endTime ?? ""}
                          onChange={(event) =>
                            setShift(
                              date,
                              shift?.startTime ?? "",
                              event.target.value
                            )
                          }
                          className="w-full rounded border border-gray-700/70 bg-gray-800 px-1 py-0.5 text-[11px] text-white outline-none focus:border-blue-500"
                          aria-label={`End ${date}`}
                        />
                      </div>
                      {!shift?.startTime && (
                        <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-gray-600">
                          Off
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}