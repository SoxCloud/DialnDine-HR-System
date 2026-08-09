"use client";

/** Dark navy header: centered "Time Clock" title. */
export default function TimeClockHeader() {
  return (
    <header className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#0d1730] to-[#0a1128] px-6">
      <span className="text-base font-semibold text-white sm:text-lg">
        Time Clock
      </span>
    </header>
  );
}
