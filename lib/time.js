/**
 * lib/time.js
 *
 * Dial n Dine operates in South Africa (UTC+02:00, no DST). The Next.js
 * server runtime (Vercel) defaults to UTC, so timestamps written with the
 * process-local clock drift two hours from real wall-time. Every date/time
 * that represents "business local time" flows through the helpers here.
 */
export const BUSINESS_TIME_ZONE = "Africa/Johannesburg"; // UTC+02:00, no DST

const pad2 = (value) => String(value).padStart(2, "0");

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Calendar + clock fields of `date` expressed in the business time zone. */
export function businessParts(date = new Date()) {
  const map = {};
  for (const part of formatter.formatToParts(date)) {
    map[part.type] = Number(part.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour % 24, // some engines emit "24" for midnight
    minute: map.minute,
    second: map.second,
  };
}

/** "YYYY-MM-DD" of `date` in the business time zone (default: now). */
export function businessToday(date = new Date()) {
  const p = businessParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** "YYYY-MM-DDTHH:mm:ss" of `date` in the business time zone (default: now). */
export function businessNow(date = new Date()) {
  const p = businessParts(date);
  return `${businessToday(date)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}

/**
 * Fixed offset (ms) of the business time zone for `instant`. SAST never
 * observes DST, so a single round-trip is exact.
 */
export function businessOffsetMs(instant) {
  const p = businessParts(instant);
  const utcGuess = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return utcGuess - instant.getTime();
}

/** Date instant for the given business-local calendar date & time. */
export function businessDateToInstant(dateKey, hour = 0, minute = 0, second = 0) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(utc - businessOffsetMs(new Date(utc)));
}

/**
 * Business-local date that is `days` days after `dateKey` ("YYYY-MM-DD").
 * `days` may be negative. Uses UTC calendar math (TZ-independent).
 */
export function shiftBusinessDate(dateKey, days) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`;
}

/** The Monday (week start) for the business-local week containing `dateKey`. */
export function businessWeekStart(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  return shiftBusinessDate(dateKey, -back);
}