const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-yellow-500/20 text-yellow-400",
  Approved: "bg-green-500/20 text-green-400",
  Rejected: "bg-red-500/20 text-red-400",
  completed: "bg-green-500/20 text-green-400",
  clocked_in: "bg-blue-500/20 text-blue-400",
  none: "bg-gray-500/20 text-gray-400",
  Present: "bg-green-500/20 text-green-400",
  Late: "bg-yellow-500/20 text-yellow-400",
  Absent: "bg-red-500/20 text-red-400",
  "On Leave": "bg-blue-500/20 text-blue-400",
  "Clocked In": "bg-green-500/20 text-green-400",
  "Clocked Out": "bg-gray-500/20 text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  clocked_in: "Clocked In",
  none: "Not Clocked In",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_STYLES[status] ?? "bg-gray-500/20 text-gray-400"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}