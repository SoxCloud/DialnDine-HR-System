/**
 * lib/googleSheets.js
 *
 * Reusable Google Sheets "database" layer for the Dial n Dine HR backend.
 * - Authenticates with a service account (env vars only, never the client).
 * - Exposes a cached Sheets client.
 * - Provides row helpers used by every API route.
 *
 * Only used server-side (Next.js API routes).
 */
import { google } from "googleapis";

/* ------------------------------------------------------------------ */
/* Schema (kept in sync with the HR spreadsheet)                       */
/* ------------------------------------------------------------------ */

export const SHEETS = {
  employees: "Employees",
  attendanceLog: "Attendance_Log",
  leaveRequests: "Leave_Requests",
  leaveBalance: "Leave_Balance",
  dashboard: "Dashboard",
  settings: "Settings",
  groups: "Groups",
  credits: "Credits",
};

export const COLS = {
  employees: {
    employeeId: "Employee_ID",
    fullName: "Full_Name",
    email: "Email",
    department: "Department",
    startDate: "Start_Date",
    role: "Role",
    status: "Status",
    password: "Password",
    extension: "Extension_Number",
  },
  attendance: {
    date: "Date",
    employeeId: "Employee_ID",
    clockIn: "Clock_In",
    clockOut: "Clock_Out",
    hoursWorked: "Hours_Worked",
    late: "Late",
    notes: "Notes",
  },
  leaveRequests: {
    requestId: "Request_ID",
    employeeId: "Employee_ID",
    startDate: "Start_Date",
    endDate: "End_Date",
    days: "Days",
    status: "Status",
    approvedBy: "Approved_By",
    reason: "Reason",
  },
  leaveBalance: {
    employeeId: "Employee_ID",
    totalLeave: "Total_Leave",
    usedLeave: "Used_Leave",
    remainingLeave: "Remaining_Leave",
  },
  groups: {
    groupId: "Group_ID",
    name: "Group_Name",
    startTime: "Start_Time",
    endTime: "End_Time",
    members: "Members",
  },
  credits: {
    employeeId: "Employee_ID",
    credits: "Credits",
    updatedAt: "Updated_At",
  },
  settings: {
    setting: "Setting",
    value: "Value",
  },
};

// Column letters used when updating single cells.
export const COLUMN_LETTERS = {
  attendance: { clockIn: "C", clockOut: "D", hoursWorked: "E", late: "F" },
  leaveRequests: { startDate: "C", endDate: "D", days: "E", status: "F", approvedBy: "G", reason: "H" },
  groups: { name: "B", startTime: "C", endTime: "D", members: "E" },
  credits: { credits: "B", updatedAt: "C" },
};

/* ------------------------------------------------------------------ */
/* Auth + client (read from environment, cached between requests)      */
/* ------------------------------------------------------------------ */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

let cachedAuth = null;
let cachedSheets = null;

function requireCredentials() {
  const missing = [];
  if (!SPREADSHEET_ID) missing.push("GOOGLE_SHEET_ID");
  if (!CLIENT_EMAIL) missing.push("GOOGLE_CLIENT_EMAIL");
  if (!PRIVATE_KEY) missing.push("GOOGLE_PRIVATE_KEY");
  if (missing.length) {
    throw new Error(`Missing Google Sheets credentials: ${missing.join(", ")}`);
  }
}

/** Authenticated JWT client (service account). Cached across calls. */
export function getAuthClient() {
  if (!cachedAuth) {
    requireCredentials();
    cachedAuth = new google.auth.JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: SCOPES,
    });
  }
  return cachedAuth;
}

/** Reusable, cached google.sheets API client. */
export function getSheetsClient() {
  if (!cachedSheets) {
    cachedSheets = google.sheets({ version: "v4", auth: getAuthClient() });
  }
  return cachedSheets;
}

/* ------------------------------------------------------------------ */
/* Clocking enable switch                                              */
/* ------------------------------------------------------------------ */

const CLOCK_ENABLED_VALUES = ["yes", "true", "1", "enabled", "on"];
const CLOCK_DISABLED_VALUES = ["no", "false", "0", "disabled", "off"];
const CLOCK_LOCKED_VALUES = ["yes", "true", "locked", "1"];

/**
 * Single source of truth for whether clock in/out is currently allowed.
 *
 * Reads the Settings sheet:
 *  1. "Clock Enabled"  — canonical switch (No / false / 0 / disabled / off = disabled).
 *  2. "Clock Locked"    — legacy inverse switch (Yes / true / locked / 1 = disabled).
 *  3. neither present   — fails open (enabled).
 *
 * Used by /api/clock-in, /api/clock-out (server-side guard) and
 * /api/clock-status (kiosk UI) so the UI can never disagree with the
 * enforcement and a disabled state cannot be bypassed via the API.
 */
export async function getClockEnabled() {
  const settings = await getSheetData(SHEETS.settings, "A1:B");

  const findSetting = (name) =>
    settings.find(
      (entry) =>
        String(entry[COLS.settings.setting] ?? "").trim().toLowerCase() === name
    );

  // Canonical switch: explicit "No"/false/0/disabled/off disables.
  const enabledRow = findSetting("clock enabled");
  if (enabledRow) {
    const value = String(enabledRow[COLS.settings.value] ?? "").trim().toLowerCase();
    if (CLOCK_DISABLED_VALUES.includes(value)) return false;
  }

  // Legacy inverse switch: "Yes"/true/locked/1 also disables.
  const lockedRow = findSetting("clock locked");
  if (lockedRow) {
    const value = String(lockedRow[COLS.settings.value] ?? "").trim().toLowerCase();
    if (CLOCK_LOCKED_VALUES.includes(value)) return false;
  }

  return true; // neither switch says disabled -> enabled
}

/* ------------------------------------------------------------------ */
/* Low-level range reader                                              */
/* ------------------------------------------------------------------ */

/**
 * Read a raw 2D grid of values for a sheet range.
 * @param {string} sheetName e.g. "Employees"
 * @param {string} range     e.g. "A1:F" (columns are limited to keep fetches small)
 * @returns {Promise<string[][]>}
 */
export async function readRange(sheetName, range) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return response.data.values || [];
}

/* ------------------------------------------------------------------ */
/* Public helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch a sheet as an array of objects keyed by the header row.
 * Blank rows (day formula placeholders) are dropped.
 * @param {string} sheetName
 * @param {string} [range] e.g. "A1:F" — pass only the columns/rows you need.
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function getSheetData(sheetName, range = "A1:Z") {
  const values = await readRange(sheetName, range);

  if (!values.length) return [];

  const headers = values[0].map((header) => String(header ?? "").trim());

  return values
    .slice(1)
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    })
    .filter((record) =>
      Object.values(record).some((value) => String(value).trim() !== "")
    );
}

/**
 * Like getSheetData, but returns [] when the sheet does not exist yet.
 * Used for optional admin sheets (Groups, Credits) that are added to an
 * existing spreadsheet via the setup script migration.
 * @param {string} sheetName
 * @param {string} [range] e.g. "A1:E"
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function getOptionalSheetData(sheetName, range = "A1:Z") {
  try {
    return await getSheetData(sheetName, range);
  } catch (error) {
    const message = String(error?.message ?? "");
    if (/unable to parse range/i.test(message) || /not found/i.test(message)) {
      return [];
    }
    throw error;
  }
}

/**
 * Like getSheetData, but also returns each match with its 1-based sheet row
 * number so the row can be updated afterwards. Useful for clock-out / approve.
 *
 * @param {string} sheetName
 * @param {string} range
 * @param {(record: Record<string, any>) => boolean} predicate
 * @returns {Promise<Array<{ rowNumber: number, record: Record<string, any> }>>}
 */
export async function findRows(sheetName, range, predicate) {
  const values = await readRange(sheetName, range);
  if (!values.length) return [];

  const headers = values[0].map((header) => String(header ?? "").trim());
  const matches = [];

  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    const record = {};
    headers.forEach((header, columnIndex) => {
      record[header] = row[columnIndex] ?? "";
    });

    if (predicate(record)) {
      matches.push({ rowNumber: index + 1, record }); // header = row 1
    }
  }

  return matches;
}

/**
 * Append one row (or several rows) to a sheet.
 * Values are written as RAW strings so timestamps/dates are never re-parsed
 * by Google Sheets.
 *
 * @param {string} sheetName
 * @param {any[]} rowData — array of cell values, or array of such arrays.
 * @returns {Promise<{ sheetRange: string, rowNumber: number | null }>}
 */
export async function appendRow(sheetName, rowData) {
  const sheets = getSheetsClient();
  const rows = Array.isArray(rowData[0]) ? rowData : [rowData];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    resource: { values: rows },
  });

  const updatedRange = response.data.updates?.updatedRange || "";
  const rowMatch = /(\d+)$/.exec(updatedRange);

  return {
    sheetRange: updatedRange,
    rowNumber: rowMatch ? Number(rowMatch[1]) : null,
  };
}

function columnToIndex(letter) {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

function indexToColumn(index) {
  return String.fromCharCode(65 + index);
}

/**
 * Update one row of the sheet.
 *
 * Two signatures:
 *  - updateRow(sheetName, rowNumber, [a, b, c])   -> replace the full row from column A.
 *  - updateRow(sheetName, rowNumber, { D: "...", F: "..." }) -> update specific cells,
 *    merging with existing values so untouched columns are preserved.
 *
 * @param {string} sheetName
 * @param {number} rowNumber 1-based row in the sheet (see findRows).
 * @param {any[] | Record<string, any>} rowData
 * @returns {Promise<{ rowNumber: number }>}
 */
export async function updateRow(sheetName, rowNumber, rowData) {
  const sheets = getSheetsClient();

  if (!Number.isInteger(rowNumber) || rowNumber < 1) {
    throw new Error("updateRow expects a 1-based integer rowNumber");
  }

  // Full-row replacement.
  if (Array.isArray(rowData)) {
    const endColumn = indexToColumn(Math.max(0, rowData.length - 1));
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowNumber}:${endColumn}${rowNumber}`,
      valueInputOption: "RAW",
      resource: { values: [rowData] },
    });
    return { rowNumber };
  }

  // Partial cell update keyed by column letter, e.g. { D: "18:00:00" }.
  const updates = Object.keys(rowData).map((letter) => ({
    columnIndex: columnToIndex(letter),
    value: rowData[letter],
  }));

  const firstColumnIndex = Math.min(...updates.map((u) => u.columnIndex));
  const lastColumnIndex = Math.max(...updates.map((u) => u.columnIndex));

  const startColumn = indexToColumn(firstColumnIndex);
  const endColumn = indexToColumn(lastColumnIndex);

  // Merge into existing cells so columns outside the update are untouched.
  const existing = await readRange(
    sheetName,
    `${startColumn}${rowNumber}:${endColumn}${rowNumber}`
  );

  const merged = Array.from(
    { length: lastColumnIndex - firstColumnIndex + 1 },
    (_, offset) => existing?.[0]?.[offset] ?? ""
  );

  updates.forEach(({ columnIndex, value }) => {
    merged[columnIndex - firstColumnIndex] = value;
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${startColumn}${rowNumber}:${endColumn}${rowNumber}`,
    valueInputOption: "RAW",
    resource: { values: [merged] },
  });

  return { rowNumber };
}

/**
 * Clear an entire row (cells become empty, the row itself stays in place so
 * appended rows keep their position). Reads treat it as deleted because
 * getSheetData drops rows with no non-empty values.
 *
 * @param {string} sheetName
 * @param {number} rowNumber 1-based row in the sheet (see findRows).
 * @param {string} [endColumn] last column to clear (default "E").
 */
export async function clearRow(sheetName, rowNumber, endColumn = "E") {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowNumber}:${endColumn}${rowNumber}`,
  });
  return { rowNumber };
}