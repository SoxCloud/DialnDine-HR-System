"use client";

interface ActionButtonsProps {
  onClockIn: () => void;
  onClockOut: () => void;
  disabled?: boolean;
}

function LoginDoorIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M6 21V7a2 2 0 0 1 2-2h3" />
      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M12 12h8" />
      <path d="M16 9l-4 3 4 3" />
    </svg>
  );
}

function LogoutDoorIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M6 21V7a2 2 0 0 1 2-2h3" />
      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M11 12h9" />
      <path d="M17 9l4 3-4 3" />
    </svg>
  );
}

const BUTTON_CLASS =
  "flex h-12 select-none touch-manipulation items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:text-sm";

/** Compact Clock In / Clock Out buttons. */
export default function ActionButtons({
  onClockIn,
  onClockOut,
  disabled,
}: ActionButtonsProps) {
  return (
    <div className="grid w-full grid-cols-2 gap-4">
      <button
        type="button"
        onClick={onClockIn}
        disabled={disabled}
        className={`${BUTTON_CLASS} bg-blue-600 shadow-blue-950/40 hover:bg-blue-500`}
      >
        <LoginDoorIcon />
        Clock In
      </button>
      <button
        type="button"
        onClick={onClockOut}
        disabled={disabled}
        className={`${BUTTON_CLASS} bg-red-600 shadow-red-950/40 hover:bg-red-500`}
      >
        <LogoutDoorIcon />
        Clock Out
      </button>
    </div>
  );
}
