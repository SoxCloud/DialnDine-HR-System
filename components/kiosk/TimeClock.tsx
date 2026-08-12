"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import TimeClockHeader from "./TimeClockHeader";
import TimeClockFooter from "./TimeClockFooter";
import ClockFace from "./ClockFace";
import ActionButtons from "./ActionButtons";
import StaffKeypad from "./StaffKeypad";

type Phase = "loading" | "locked" | "ready";

interface Employee {
  employeeId: string;
  name: string;
  role: string;
  extension: string;
}

interface Toast {
  id: number;
  type: "success" | "info" | "error";
  message: string;
}

const MAX_CODE_LENGTH = 6;
const TOAST_DURATION_MS = 3200;
const IDLE_TIMEOUT_MS = 10_000;
const IDLE_CHECK_MS = 1_000;

/** Live 12-hour clock (HH:MM am/pm) plus the date line. */
function useClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours = now.getHours();
  return {
    time: `${hours % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`,
    ampm: hours >= 12 ? "pm" : "am",
    dateLine: now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

/** "2026-08-09T08:30:00" -> "08:30" */
function clockTime(value: string | undefined): string {
  if (!value) return "";
  return String(value).slice(11, 16) || String(value).slice(0, 5);
}

const TOAST_STYLES: Record<Toast["type"], string> = {
  success: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  info: "border-blue-400/40 bg-blue-500/15 text-blue-300",
  error: "border-red-400/40 bg-red-500/15 text-red-300",
};

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-4 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-toast-in w-full rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-lg shadow-black/40 backdrop-blur ${TOAST_STYLES[toast.type]}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default function TimeClock() {
  const { time, ampm, dateLine } = useClock();
  const [phase, setPhase] = useState<Phase>("loading");
  const [input, setInput] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const pushToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, type, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  // Any touch/pointer/keyboard activity resets the idle timer.
  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const checkIdle = () => {
      if (phase !== "ready") return;
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        if (employee || input || busy) {
          setEmployee(null);
          setInput("");
          setBusy(false);
        }
      }
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("touchstart", onActivity);
    window.addEventListener("keydown", onActivity);
    const id = setInterval(checkIdle, IDLE_CHECK_MS);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("keydown", onActivity);
      clearInterval(id);
    };
  }, [phase, employee, input, busy]);

  // Lock check runs once; the server also rejects clock actions with 403.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/clock-status");
        const body = await res.json();
        setPhase(body.locked ? "locked" : "ready");
      } catch {
        setPhase("ready");
      }
    })();
  }, []);

  function handleKey(key: string) {
    if (busy) return;
    if (key === "back") {
      setInput((value) => value.slice(0, -1));
      return;
    }
    if (key === "clear") {
      setInput("");
      return;
    }
    if (/^\d$/.test(key) && input.length < MAX_CODE_LENGTH) {
      setInput((value) => value + key);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (busy) return;
    const next = event.target.value.replace(/[^\d]/g, "").slice(0, MAX_CODE_LENGTH);
    setInput(next);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitCode();
    }
  }

  async function submitCode() {
    if (busy) return;
    if (!input) {
      pushToast("error", "Enter your Staff Code first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension: input }),
      });
      const body = await res.json();

      if (res.ok) {
        const resolvedEmployee = {
          employeeId: String(body.employeeId),
          name: body.name,
          role: body.role,
          extension: String(body.extension),
        };
        setEmployee(resolvedEmployee);
        setInput("");
        pushToast("success", `Welcome, ${resolvedEmployee.name}`);
      } else {
        pushToast("error", body.error || "Invalid staff code");
      }
    } catch {
      pushToast("error", "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function postClock(endpoint: "clock-in" | "clock-out") {
    if (busy) return;
    if (!employee) {
      pushToast("error", "Enter your Staff Code first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.employeeId }),
      });
      const body = await res.json();

      if (res.ok) {
        if (endpoint === "clock-in") {
          pushToast("success", `Clocked in at ${clockTime(body.clockIn)}`);
          if (body.unscheduled) {
            pushToast("info", "Unscheduled — no active time slot this hour");
          }
        } else {
          pushToast("info", `Clocked out at ${clockTime(body.clockOut)}`);
        }
      } else {
        pushToast("error", body.error || "Request failed");
      }
    } catch {
      pushToast("error", "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Hardware keyboard: digits / Backspace / Enter. When the numeric input is
  // focused (e.g. the device's on-screen keyboard is open), let the input
  // handle keystrokes itself so digits are never entered twice.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== "ready") return;
      if (inputRef.current && document.activeElement === inputRef.current) return;
      if (/^[0-9]$/.test(event.key)) {
        handleKey(event.key);
      } else if (event.key === "Backspace") {
        handleKey("back");
      } else if (event.key === "Enter" && input) {
        submitCode();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, input]);

  // --- Locked -----------------------------------------------------------
  if (phase === "locked") {
    return (
      <div className="kiosk-fade relative flex min-h-screen items-center justify-center bg-[#070c18] px-6 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/15 blur-3xl"
        />
        <div className="relative">
          <h1 className="text-6xl font-bold text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]">
            Clocking Locked
          </h1>
          <p className="mt-5 text-2xl text-gray-300">Contact HR</p>
        </div>
      </div>
    );
  }

  // --- Loading ----------------------------------------------------------
  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070c18]">
        <p className="text-lg text-slate-400">Loading…</p>
      </div>
    );
  }

  // --- Kiosk ------------------------------------------------------------
  return (
    <div className="flex h-screen w-screen touch-manipulation select-none items-center justify-center overflow-hidden overscroll-none bg-[#04070d] p-2">
      <ToastStack toasts={toasts} />

      {/* Outer application container */}
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/70">
        {/* Header ~10% */}
        <div className="h-[10%] min-h-12 shrink-0">
          <TimeClockHeader />
        </div>

        {/* Main two-column content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left column: clock info + action buttons */}
          <div className="relative isolate flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#0c2250] via-[#0a1a3d] to-[#081331]">
            <div className="flex flex-1 items-center justify-center px-6 py-4">
              <ClockFace
                dateLine={dateLine}
                time={time}
                ampm={ampm}
                staffName={employee?.name}
              />
            </div>

            <div className="px-6 pb-4">
              <ActionButtons
                onClockIn={() => postClock("clock-in")}
                onClockOut={() => postClock("clock-out")}
                disabled={busy}
              />
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px shrink-0 bg-white/25" />

          {/* Right column: input + keypad */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-[#0f1a35] via-[#0c1428] to-[#0a101f] px-6 py-4">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={MAX_CODE_LENGTH}
              aria-label="Staff Code"
              placeholder="Enter Staff Code"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              className="h-14 w-full max-w-sm select-text rounded-xl border border-gray-300 bg-white text-center font-mono text-xl font-bold tracking-[0.12em] text-slate-900 shadow-md shadow-black/25 placeholder:font-sans placeholder:text-lg placeholder:font-light placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
            />

            <StaffKeypad
              onDigit={(digit) => handleKey(digit)}
              onClear={() => handleKey("clear")}
              onDelete={() => handleKey("back")}
              onEnter={submitCode}
              disabled={busy}
            />
          </div>
        </div>

        {/* Footer ~9% */}
        <div className="h-[9%] min-h-10 shrink-0">
          <TimeClockFooter />
        </div>
      </div>
    </div>
  );
}
