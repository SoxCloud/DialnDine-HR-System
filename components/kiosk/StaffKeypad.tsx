"use client";

interface StaffKeypadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onDelete: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

const NUM_CLASS =
  "flex select-none touch-manipulation items-center justify-center rounded-xl border border-gray-300 bg-white text-xl font-bold text-slate-800 shadow-sm transition-all duration-150 hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

const UTIL_CLASS =
  "flex select-none touch-manipulation items-center justify-center rounded-xl border border-gray-300 bg-gray-100 text-sm font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-all duration-150 hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Touchscreen PIN keypad:
 *   7 8 9 | clear (tall)
 *   4 5 6 | clear
 *   1 2 3 | enter (tall)
 *   0(wide) del | enter
 */
export default function StaffKeypad({
  onDigit,
  onClear,
  onDelete,
  onEnter,
  disabled,
}: StaffKeypadProps) {
  return (
    <div className="grid w-full max-w-sm auto-rows-[56px] grid-cols-4 gap-3">
      {["7", "8", "9"].map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
          className={NUM_CLASS}
        >
          {digit}
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={onClear}
        className={`${UTIL_CLASS} row-span-2`}
      >
        clear
      </button>

      {["4", "5", "6"].map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
          className={NUM_CLASS}
        >
          {digit}
        </button>
      ))}

      {["1", "2", "3"].map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
          className={NUM_CLASS}
        >
          {digit}
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={onEnter}
        className="row-span-2 flex select-none touch-manipulation items-center justify-center rounded-xl bg-blue-600 text-sm font-bold uppercase tracking-widest text-white shadow-md shadow-blue-950/40 transition-all duration-150 hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Enter
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit("0")}
        className={`${NUM_CLASS} col-span-2`}
      >
        0
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className={UTIL_CLASS}
      >
        del
      </button>
    </div>
  );
}
