"use client";

import { Fragment, useState } from "react";
import Card from "@/components/Card";
import type { AdminHoursByGroup } from "@/hooks/useAdminDashboard";

function formatHours(hours: number): string {
  return `${Number(hours ?? 0).toFixed(2)}h`;
}

/** Hours worked this month per group, expandable down to employees. */
export default function HoursByGroup({
  data,
  loading,
}: {
  data?: AdminHoursByGroup;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(groupId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const groups = data?.groups ?? [];
  const total = data?.totalHours ?? 0;

  return (
    <Card
      title="Hours by Group · This Month"
      action={<span className="text-xs text-gray-500">{formatHours(total)} total</span>}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">No attendance recorded this month.</p>
      ) : (
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="pb-2 pr-4">Group</th>
              <th className="pb-2 pr-4">Workers</th>
              <th className="pb-2">Total Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {groups.map((group) => {
              const isOpen = expanded.has(group.groupId);
              return (
                <Fragment key={group.groupId}>
                  <tr
                    className="cursor-pointer hover:bg-gray-800/50"
                    onClick={() => toggle(group.groupId)}
                  >
                    <td className="py-2.5 pr-4">
                      <span className="mr-2 inline-block w-4 text-center text-xs text-blue-400">
                        {isOpen ? "▼" : "▶"}
                      </span>
                      <span className="font-medium text-gray-200">
                        {group.name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">
                      {group.employees.length}
                    </td>
                    <td className="py-2.5 font-semibold text-gray-200">
                      {formatHours(group.monthHours)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={3} className="bg-gray-950/50 py-3 pl-8">
                        {group.employees.length === 0 ? (
                          <p className="text-sm text-gray-600">No employees.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                            {group.employees.map((employee) => (
                              <div
                                key={employee.employeeId}
                                className="flex items-center justify-between gap-4 py-0.5"
                              >
                                <span className="text-sm text-gray-300">
                                  {employee.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatHours(employee.monthHours)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}