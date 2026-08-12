/**
 * scripts/ensure-schedule-tab.mjs
 * Keep the "Schedule" tab in the required time-slot shape:
 *   Date | Time | Group_ID   (one row per ACTIVE slot cell)
 *
 * Migrates the legacy shape (Group_ID | Date | Start_Time | End_Time) by
 * expanding each shift into one hourly slot row per hour, then rewriting the
 * headers. Idempotent — safe to run repeatedly.
 *
 * Usage:
 *   node scripts/ensure-schedule-tab.mjs
 */
import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

for (const candidate of [resolve(".env.local"), resolve(process.cwd(), ".env.local")]) {
  if (!existsSync(candidate)) continue;
  for (const line of readFileSync(candidate, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const NEW_HEADERS = ["Date", "Time", "Group_ID"];
const OLD_HEADERS = ["Group_ID", "Date", "Start_Time", "End_Time"];
const SHEET_NAME = "Schedule";

const pad2 = (value) => String(value).padStart(2, "0");

function hourValue(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d{1,2}):/.exec(text);
  return match ? Number(match[1]) : null;
}

const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const sheet = (meta.data.sheets ?? []).find((s) => s.properties.title === SHEET_NAME);

if (!sheet) {
  // Create the tab from scratch.
  const add = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: SHEET_NAME, gridProperties: { rowCount: 1000, columnCount: 26 } },
          },
        },
      ],
    },
  });
  const added = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const addedSheet = (added.data.sheets ?? []).find((s) => s.properties.title === SHEET_NAME);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:C1`,
    valueInputOption: "RAW",
    resource: { values: [NEW_HEADERS] },
  });
  await formatHeader(sheets, SHEET_ID, addedSheet.properties.sheetId, 3);
  console.log(`Created ${SHEET_NAME} tab with headers: ${NEW_HEADERS.join(", ")}`);
  process.exit(0);
}

const sheetId = sheet.properties.sheetId;
const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: `${SHEET_NAME}!A1:D`,
});
const values = res.data.values ?? [];

if (values.length === 0) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:C1`,
    valueInputOption: "RAW",
    resource: { values: [NEW_HEADERS] },
  });
  await formatHeader(sheets, SHEET_ID, sheetId, 3);
  console.log(`${SHEET_NAME} headers set to ${NEW_HEADERS.join(", ")}`);
  process.exit(0);
}

const headerRow = (values[0] ?? []).map((h) => String(h ?? "").trim());
const isNewShape = headerRow[0] === "Date" && headerRow[1] === "Time";

if (isNewShape) {
  console.log(`${SHEET_NAME} already uses the time-slot shape.`);
  await formatHeader(sheets, SHEET_ID, sheetId, 3);
  process.exit(0);
}

// Legacy shape: expand Group_ID | Date | Start_Time | End_Time into hourly slots.
const seen = new Set();
const rows = [];
for (const row of values.slice(1)) {
  const groupId = String(row[0] ?? "").trim();
  const date = String(row[1] ?? "").trim();
  const start = hourValue(row[2]);
  const end = hourValue(row[3]);
  if (!groupId || !date || start === null || end === null || end <= start) continue;
  for (let hour = start; hour < end; hour++) {
    const key = `${date}|${hour}|${groupId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push([date, `${pad2(hour)}:00`, groupId]);
  }
}
rows.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));

// Wipe the old values and write the new shape.
await sheets.spreadsheets.values.clear({
  spreadsheetId: SHEET_ID,
  range: `${SHEET_NAME}!A1:Z1000`,
});
await sheets.spreadsheets.values.update({
  spreadsheetId: SHEET_ID,
  range: `${SHEET_NAME}!A1:C1`,
  valueInputOption: "RAW",
  resource: { values: [NEW_HEADERS] },
});
if (rows.length) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "RAW",
    resource: { values: rows },
  });
}
await formatHeader(sheets, SHEET_ID, sheetId, 3);
console.log(`Migrated ${rows.length} active slot row(s) to ${NEW_HEADERS.join(", ")}.`);

async function formatHeader(sheetsApi, spreadsheetId, sheetIdValue, columnCount) {
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: sheetIdValue, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: sheetIdValue,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: columnCount,
            },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat",
          },
        },
      ],
    },
  });
}