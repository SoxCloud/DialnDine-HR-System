"use client";

interface ClockFaceProps {
  dateLine: string;
  time: string;
  ampm: string;
  staffName?: string;
}

/** Left-column clock: date, 12-hour time + am/pm, divider, welcome. */
export default function ClockFace({
  dateLine,
  time,
  ampm,
  staffName,
}: ClockFaceProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-lg font-medium text-cyan-400">{dateLine}</p>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-5xl font-bold tabular-nums leading-none text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.25)] sm:text-6xl">
          {time}
        </span>
        <span className="text-2xl font-semibold text-white/85 sm:text-3xl">
          {ampm}
        </span>
      </div>

      <div className="mt-4 h-px w-2/3 max-w-xs bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <p className="mt-4 text-xl font-semibold text-white">Welcome!</p>
      <p className="mt-0.5 text-base text-white/75">
        {staffName || "Please enter your Staff Code"}
      </p>
    </div>
  );
}
