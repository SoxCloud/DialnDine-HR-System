"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "./Modal";
import type {
  AdminEmployeeOption,
  AdminGroup,
} from "@/hooks/useAdminDashboard";

type ModalState =
  | { type: "create" }
  | { type: "edit"; group: AdminGroup }
  | { type: "members"; group: AdminGroup };

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

/** Group management: cards per group with add / edit / assign / delete. */
export default function GroupsSection({
  groups,
  employees,
  loading,
  onChanged,
}: {
  groups: AdminGroup[];
  employees: AdminEmployeeOption[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function openCreate() {
    setName("");
    setStartTime("");
    setEndTime("");
    setMessage(null);
    setModal({ type: "create" });
  }

  function openEdit(group: AdminGroup) {
    setName(group.name);
    setStartTime(group.startTime);
    setEndTime(group.endTime);
    setMessage(null);
    setModal({ type: "edit", group });
  }

  function openMembers(group: AdminGroup) {
    setSelected(new Set(group.memberIds));
    setMessage(null);
    setModal({ type: "members", group });
  }

  function toggleMember(employeeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  async function submit() {
    if (busy || !modal) return;
    setBusy(true);
    setMessage(null);

    let res: Response | null = null;
    try {
      if (modal.type === "create") {
        res = await fetch("/api/admin/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), startTime, endTime }),
        });
      } else if (modal.type === "edit") {
        res = await fetch("/api/admin/groups", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: modal.group.groupId,
            name: name.trim(),
            startTime,
            endTime,
          }),
        });
      } else {
        res = await fetch("/api/admin/groups", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: modal.group.groupId,
            members: [...selected],
          }),
        });
      }

      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Request failed");
        return;
      }
      setModal(null);
      await onChanged();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup(group: AdminGroup) {
    if (!window.confirm(`Delete group "${group.name}"? Employees will not be removed.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.groupId }),
      });
      if (res.ok) await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Group Management"
      action={<Button onClick={openCreate} disabled={busy}>Add Group</Button>}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">
          No groups yet. Add a group to schedule shifts and organize workers.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.groupId}
              className="flex flex-col rounded-xl border border-gray-800 bg-gray-950/60 p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-200">{group.name}</h3>
                <span className="text-xs text-gray-500">{group.groupId}</span>
              </div>
              <div className="mb-3 space-y-1 text-sm text-gray-400">
                <p>
                  <span className="text-gray-500">Start:</span>{" "}
                  {group.startTime || "—"} · <span className="text-gray-500">End:</span>{" "}
                  {group.endTime || "—"}
                </p>
                <p>
                  <span className="text-gray-500">Members:</span>{" "}
                  <span className="text-gray-300">{group.members.length}</span>
                </p>
              </div>
              {group.members.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {group.members.map((member) => (
                    <span
                      key={member.employeeId}
                      className="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"
                    >
                      {member.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mb-4 text-xs text-gray-600">No members assigned.</p>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="md"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => openEdit(group)}
                  disabled={busy}
                >
                  Edit
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => openMembers(group)}
                  disabled={busy}
                >
                  Assign / Remove
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  className="ml-auto px-3 py-1.5 text-xs"
                  onClick={() => removeGroup(group)}
                  disabled={busy}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={
            modal.type === "create"
              ? "Add Group"
              : modal.type === "edit"
                ? `Edit ${modal.group.name}`
                : `Assign Members · ${modal.group.name}`
          }
          onClose={() => !busy && setModal(null)}
        >
          {modal.type === "members" ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Check the employees that belong to this group.
              </p>
              <div className="max-h-72 space-y-1 overflow-auto pr-1">
                {employees.length === 0 && (
                  <p className="text-sm text-gray-500">No active employees.</p>
                )}
                {employees.map((employee) => (
                  <label
                    key={employee.employeeId}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(employee.employeeId)}
                      onChange={() => toggleMember(employee.employeeId)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span className="text-sm text-gray-200">{employee.name}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {employee.extension || "—"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm">Group Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Morning Shift"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          )}

          {message && <p className="mt-4 text-sm text-red-500">{message}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="danger" size="md" className="px-4 py-2 text-sm" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={modal.type === "members" ? "primary" : "success"}
              size="md"
              className="px-4 py-2 text-sm"
              onClick={submit}
              disabled={busy || (modal.type !== "members" && !name.trim())}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}