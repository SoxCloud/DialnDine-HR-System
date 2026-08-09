"use client";

function CircularArrowIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/** Dark navy footer: brand on the left, "Powered by TimePro" on the right. */
export default function TimeClockFooter() {
  return (
    <footer className="flex h-full w-full items-center justify-between bg-gradient-to-t from-[#0a1128] to-[#0d1730] px-6 sm:px-10">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-white/70">
          <CircularArrowIcon />
        </div>
        <span className="text-sm font-medium text-white/85">
          Dial n Dine HR System
        </span>
      </div>
    </footer>
  );
}
