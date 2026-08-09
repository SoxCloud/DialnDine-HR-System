import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value?: ReactNode;
}

export default function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-lg shadow-black/40">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value ?? "—"}</p>
    </div>
  );
}