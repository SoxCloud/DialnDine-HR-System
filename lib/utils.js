/**
 * lib/utils.js
 *
 * Shared request/date helpers for the Dial n Dine HR backend.
 */
import { NextResponse } from "next/server";
import { businessNow, businessToday } from "./time";

const pad2 = (value) => String(value).padStart(2, "0");

/**
 * Business-local date as YYYY-MM-DD (South Africa UTC+02). Uses the business
 * time zone, never the server's own, so clock-in/out and dashboards agree.
 */
export function todayISO(date = new Date()) {
  return businessToday(date);
}

/** Business-local timestamp as YYYY-MM-DDTHH:mm:ss. */
export function nowISO(date = new Date()) {
  return businessNow(date);
}

/** Shift starts at 08:00 -> 480 minutes past midnight. */
export const SHIFT_START_MINUTES = 8 * 60;

/**
 * Convert a clock-in cell to minutes-since-midnight.
 * Handles ISO strings ("...T08:30:00"), "HH:mm" strings, and Excel serial numbers.
 * Returns null when the value is not a usable time.
 */
export function toMinutes(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  // Google Sheets serial date: days since 1899-12-30.
  if (typeof value === "number") {
    const utc = new Date((value - 25569) * 86400000);
    return utc.getUTCHours() * 60 + utc.getUTCMinutes();
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getHours() * 60 + parsed.getMinutes();
  }

  const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }

  return null;
}

/** Decimal hours elapsed between two timestamps (0 if either is missing). */
export function durationHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return (end - start) / 3600000;
}

/** True when the value looks like YYYY-MM-DD and is a real calendar date. */
export function isISODate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  return !Number.isNaN(Date.parse(`${text}T00:00:00`));
}

/** Inclusive number of days between two YYYY-MM-DD dates. */
export function daysInclusive(startDate, endDate) {
  const dayMs = 86400000;
  const start = Date.parse(`${startDate}T00:00:00`);
  const end = Date.parse(`${endDate}T00:00:00`);
  return Math.round((end - start) / dayMs) + 1;
}

/** JSON 200/whatever response. */
export function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}

/** JSON error response. */
export function fail(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/** Safely read a JSON request body ({} when it is empty/broken). */
export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}