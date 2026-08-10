"use client";

import { useMemo, useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import Modal from "./Modal";
import type {
  AdminEmployeeOption,
  AdminLeaveRequest,
} from "@/hooks/useAdminDashboard";

type Tab = "Pending" | "Approved" | "Rejected";

const TABS: Tab[] = ["Pending", "Approved", "Rejected"];

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

/** Leave management with Pending / Approved / Rejected tabs and admin actions. */
export default function LeaveSection({
  requests,
  employees,
  loading,
  adminName,
  onChanged,
}: {
  requests: AdminLeaveRequest[];
  employees: AdminEmployeeOption[];
  loading: boolean;
  adminName: string;
  onChanged: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("Pending");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminLeaveRequest | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const visible = useMemo(
    () => requests.filter((request) => request.status === tab),
    [requests, tab]
  );

  async function runUpdate(changes: Record<string, unknown>, requestId: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/leave", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, ...changes }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setMessage(null);
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function approve(request: AdminLeaveRequest) {
    runUpdate({ status: "Approved", approvedBy: adminName }, request.requestId);
  }

  function reject(request: AdminLeaveRequest) {
    runUpdate({ status: "Rejected", approvedBy: adminName }, request.requestId);
  }

  function openAdd() {
    setAdding(true);
    setEmployeeId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setMessage(null);
  }

  async function submitAdd() {
    if (busy) return;
    if (!employeeId) {
      setMessage("Pick an employee");
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      setMessage("Pick valid start and end dates");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          startDate,
          endDate,
          reason: reason.trim(),
          approvedBy: adminName,
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

  async function remove(request: AdminLeaveRequest) {
    if (busy) return;
    if (!window.confirm(`Delete leave request ${request.requestId} for ${request.name}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/leave", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.requestId }),
      });
      if (!res.ok) {
        const payload = await res.json();
        setMessage(payload.error || "Request failed");
        return;
      }
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(request: AdminLeaveRequest) {
    setEditing(request);
    setStartDate(request.startDate);
    setEndDate(request.endDate);
    setReason(request.reason);
    setMessage(null);
  }

  async function saveEdit() {
    if (!editing || busy) return;
    runUpdate(
      { startDate, endDate, reason: reason.trim() },
      editing.requestId
    ).then(() => setEditing(null));
  }

  return (
    <Card
      title="Leave Management"
      action={
        <Button
          size="md"
          className="px-3 py-1.5 text-xs"
          onClick={openAdd}
          disabled={busy}
        >
          Add Leave
        </Button>
      }
    >
      <div className="mb-4 flex gap-2">
        {TABS.map((option) => {
          const count = requests.filter((request) => request.status === option).length;
          const active = tab === option;
          return (
            <button
              key={option}
              onClick={() => setTab(option)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {option} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {message && <p className="mb-3 text-sm text-red-500">{message}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500">No {tab.toLowerCase()} requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="pb-2 pr-4">Employee</th>
                <th className="pb-2 pr-4">Dates</th>
                <th className="pb-2 pr-4">Reason</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {visible.map((request) => (
                <tr key={request.requestId}>
                  <td className="py-2.5 pr-4">
                    <span className="text-gray-200">{request.name}</span>
                    <span className="ml-2 text-xs text-gray-600">
                      {request.employeeId}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-400">
                    {request.startDate} → {request.endDate}{" "}
                    <span className="text-gray-600">({request.days}d)</span>
                  </td>
                  <td className="max-w-sm truncate py-2.5 pr-4 text-gray-400">
                    {request.reason || "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-2">
                      {request.status === "Pending" && (
                        <>
                          <Button
                            variant="success"
                            size="md"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => approve(request)}
                            disabled={busy}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="md"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => reject(request)}
                            disabled={busy}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        variant="primary"
                        size="md"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => openEdit(request)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="md"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => remove(request)}
                        disabled={busy}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <Modal title="Add Leave Manually" onClose={() => !busy && setAdding(false)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">Employee</label>
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Select an employee…</option>
                {employees.map((employee) => (
                  <option key={employee.employeeId} value={employee.employeeId}>
                    {employee.name} · {employee.employeeId}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm">Reason</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={INPUT_CLASS}
              ></textarea>
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
              onClick={submitAdd}
              disabled={busy || !startDate || !endDate || endDate < startDate}
            >
              {busy ? "Saving…" : "Add Leave"}
            </Button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Edit Leave · ${editing.name}`}
          onClose={() => !busy && setEditing(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm">Reason</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={INPUT_CLASS}
              ></textarea>
            </div>
          </div>
          {message && <p className="mt-4 text-sm text-red-500">{message}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="danger"
              size="md"
              className="px-4 py-2 text-sm"
              onClick={() => setEditing(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="md"
              className="px-4 py-2 text-sm"
              onClick={saveEdit}
              disabled={busy || !startDate || !endDate || endDate < startDate}
            >
              {busy ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}