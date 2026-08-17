"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "./Modal";
import type {
  AdminCreditLogEntry,
  AdminCreditRow,
  AdminEmployeeOption,
  AdminMonthEndCandidate,
} from "@/hooks/useAdminDashboard";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

const MONTHS_AGO = Array.from({ length: 12 }, (_, index) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - index);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
});

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Credits: wrong-order credit log (Store, Customer Details, Reason, Amount)
 *  plus month-end absconded-hours crediting for the following month. */
export default function CreditsSection({
  rows,
  log,
  employees,
  loading,
  canEdit = true,
  onChanged,
}: {
  rows: AdminCreditRow[];
  log: AdminCreditLogEntry[];
  employees: AdminEmployeeOption[];
  loading: boolean;
  canEdit?: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<"summary" | "log" | "month-end">("summary");

  // Wrong-order credit form
  const [adding, setAdding] = useState(false);
  const [creditEmployee, setCreditEmployee] = useState("");
  const [store, setStore] = useState("");
  const [customerDetails, setCustomerDetails] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  // Month-end view
  const [month, setMonth] = useState(() => currentMonth());
  const [candidates, setCandidates] = useState<AdminMonthEndCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [monthLoaded, setMonthLoaded] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  async function openCreditForm() {
    setCreditEmployee("");
    setStore("");
    setCustomerDetails("");
    setReason("");
    setAmount("");
    setMessage(null);
    setAdding(true);
  }

  async function submitWrongOrder() {
    if (busy) return;
    if (!creditEmployee) {
      setMessage("Select an employee");
      return;
    }
    if (!reason.trim()) {
      setMessage("Reason is required");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Enter a positive amount");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: creditEmployee,
          store: store.trim(),
          customerDetails: customerDetails.trim(),
          reason: reason.trim(),
          amount: value,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setAdding(false);
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMonth() {
    setMonthLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/credits/month-end?month=${month}`);
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setCandidates(payload.candidates ?? []);
      setSelected(new Set());
      setMonthLoaded(true);
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setMonthLoading(false);
    }
  }

  function toggleCandidate(employeeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  async function creditAbsconded() {
    if (busy) return;
    if (selected.size === 0) {
      setMessage("Select at least one employee");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits/month-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, employeeIds: [...selected] }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setMessage(
        `Credited ${payload.applied.length} employee(s) with ${payload.applied.reduce(
          (sum, entry) => sum + entry.hours,
          0
        )}h into ${payload.creditMonth}`
      );
      setMonthLoaded(false);
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);

  return (
    <Card
      title="Credits Management"
      action={
        <div className="flex items-center gap-3">
          {view === "summary" && (
            <span className="text-xs text-gray-500">
              {totalAmount.toFixed(2)} amount · {totalHours.toFixed(2)}h
            </span>
          )}
          <div className="flex items-center gap-1">
            {(["summary", "log", "month-end"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setView(tab)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  view === tab
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab === "summary" ? "Summary" : tab === "log" ? "Log" : "Month-End"}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {view === "summary" && (
        <>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No employees found.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="text-left text-gray-400">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Amount Credits</th>
                    <th className="pb-2 pr-4">Hour Credits</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((row) => (
                    <tr key={row.employeeId}>
                      <td className="py-2.5 pr-4">
                        <span className="text-gray-200">{row.name}</span>
                        <span className="ml-2 text-xs text-gray-600">
                          {row.employeeId}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-200">
                        {row.amount > 0 ? row.amount.toFixed(2) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-200">
                        {row.hours > 0 ? `${row.hours.toFixed(2)}h` : "—"}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`font-semibold ${
                            row.credits > 0 ? "text-green-400" : "text-gray-500"
                          }`}
                        >
                          {row.credits.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canEdit && (
            <div className="mt-4">
              <Button
                variant="success"
                size="md"
                className="px-4 py-2 text-sm"
                onClick={openCreditForm}
                disabled={busy}
              >
                + Wrong Order Credit
              </Button>
            </div>
          )}
        </>
      )}

      {view === "log" && (
        <div className="max-h-96 overflow-auto">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : log.length === 0 ? (
            <p className="text-sm text-gray-500">No credits recorded yet.</p>
          ) : (
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="text-left text-gray-400">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Employee</th>
                  <th className="pb-2 pr-3">Store</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Reason</th>
                  <th className="pb-2">Amount / Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {log.map((entry, index) => (
                  <tr key={`${entry.createdAt}-${index}`}>
                    <td className="py-2.5 pr-3 text-gray-400">{entry.date}</td>
                    <td className="py-2.5 pr-3 text-gray-200">{entry.name}</td>
                    <td className="py-2.5 pr-3 text-gray-400">
                      {entry.store || "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400">
                      {entry.customerDetails || "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400">
                      {entry.reason || "—"}
                    </td>
                    <td className="py-2.5 text-gray-200">
                      {entry.type === "absconded_hours"
                        ? `${entry.hours.toFixed(2)}h`
                        : entry.amount > 0
                          ? entry.amount.toFixed(2)
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === "month-end" && (
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Month</label>
              <select
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  setMonthLoaded(false);
                }}
                className={INPUT_CLASS}
              >
                {MONTHS_AGO.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {canEdit ? (
              <Button
                variant="primary"
                size="md"
                className="px-4 py-2 text-sm"
                onClick={loadMonth}
                disabled={busy || monthLoading}
              >
                {monthLoading ? "Loading…" : "Load after 25th"}
              </Button>
            ) : (
              <span className="text-xs text-gray-600">Read-only</span>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Hours paid to the end of {month} assuming attendance. Employees
            below worked after the 25th; if they absconded, credit those hours
            the following month.
          </p>

          {monthLoaded && (
            <>
              {candidates.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No employees worked after the 25th in {month}.
                </p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-auto pr-1">
                  {candidates.map((candidate) => (
                    <label
                      key={candidate.employeeId}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                        canEdit ? "hover:bg-gray-800" : "opacity-70"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(candidate.employeeId)}
                        onChange={() => toggleCandidate(candidate.employeeId)}
                        disabled={!canEdit}
                        className="h-4 w-4 accent-blue-600"
                      />
                      <span className="text-sm text-gray-200">
                        {candidate.name}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">
                        {candidate.hoursAfter25th.toFixed(2)}h after 25th
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {canEdit && candidates.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    variant="success"
                    size="md"
                    className="px-4 py-2 text-sm"
                    onClick={creditAbsconded}
                    disabled={busy || selected.size === 0}
                  >
                    {busy ? "Crediting…" : `Credit ${selected.size} employee(s)`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {message && (
        <p className="mt-4 text-sm text-red-500">{message}</p>
      )}

      {adding && (
        <Modal
          title="Wrong Order Credit"
          onClose={() => !busy && setAdding(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">Employee</label>
              <select
                value={creditEmployee}
                onChange={(event) => setCreditEmployee(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Select employee…</option>
                {employees.map((employee) => (
                  <option key={employee.employeeId} value={employee.employeeId}>
                    {employee.name} · {employee.extension}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">Store</label>
              <input
                value={store}
                onChange={(event) => setStore(event.target.value)}
                placeholder="e.g. Store 1"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Customer Details</label>
              <input
                value={customerDetails}
                onChange={(event) => setCustomerDetails(event.target.value)}
                placeholder="Order / customer reference"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Reason</label>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Wrong order delivered"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Amount</label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          {message && <p className="mt-4 text-sm text-red-500">{message}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="danger"
              size="md"
              className="px-4 py-2 text-sm"
              onClick={() => setAdding(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="md"
              className="px-4 py-2 text-sm"
              onClick={submitWrongOrder}
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
