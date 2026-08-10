"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "./Modal";
import type { AdminCreditRow } from "@/hooks/useAdminDashboard";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

/** Credits table with add / deduct / manual adjust actions. */
export default function CreditsSection({
  rows,
  loading,
  onChanged,
}: {
  rows: AdminCreditRow[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCreditRow | null>(null);
  const [action, setAction] = useState<"add" | "deduct" | "set">("add");
  const [amount, setAmount] = useState("");

  function openAdjust(row: AdminCreditRow) {
    setEditing(row);
    setAction("add");
    setAmount("");
    setMessage(null);
  }

  async function submit() {
    if (!editing || busy) return;
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
          employeeId: editing.employeeId,
          action,
          amount: value,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setEditing(null);
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Credits Management"
      action={
        <span className="text-xs text-gray-500">
          {rows.reduce((sum, row) => sum + row.credits, 0)} total
        </span>
      }
    >
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
                <th className="pb-2 pr-4">Current Credits</th>
                <th className="pb-2">Actions</th>
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
                  <td className="py-2.5 pr-4">
                    <span
                      className={`font-semibold ${
                        row.credits > 0 ? "text-green-400" : "text-gray-500"
                      }`}
                    >
                      {row.credits}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <Button
                      variant="primary"
                      size="md"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => openAdjust(row)}
                      disabled={busy}
                    >
                      Adjust
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={`Adjust Credits · ${editing.name}`}
          onClose={() => !busy && setEditing(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">Action</label>
              <div className="grid grid-cols-3 gap-2">
                {(["add", "deduct", "set"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAction(option)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                      action === option
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm">
                {action === "set" ? "New value" : "Amount"}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-gray-500">
                Current credits: {editing.credits}
              </p>
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
              onClick={submit}
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