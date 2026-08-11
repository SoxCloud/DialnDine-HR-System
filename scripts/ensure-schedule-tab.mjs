/**
 * scripts/ensure-schedule-tab.mjs
 * Make sure an existing spreadsheet has the "Schedule" tab used by the
 * monthly group schedule feature. Creates it with the shared headers when
 * missing. Idempotent — safe to run repeatedly.
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

const HEADERS = ["Group_ID", "Date", "Start_Time", "End_Time"];
const SHEET_NAME = "Schedule";

const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const names = (meta.data.sheets ?? []).map((sheet) => sheet.properties.title);
console.log("Existing tabs:", names.join(", "));

if (!names.includes(SHEET_NAME)) {
  await sheets.spreadsheets.batchUpdate({
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

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:D1`,
    valueInputOption: "RAW",
    resource: { values: [HEADERS] },
  });
  console.log(`Created ${SHEET_NAME} tab.`);
} else {
  console.log(`${SHEET_NAME} already exists.`);
}

// Idempotent formatting: frozen header row + bold, matching the other tabs.
const after = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const scheduleMeta = (after.data.sheets ?? []).find(
  (sheet) => sheet.properties.title === SHEET_NAME
);
if (!scheduleMeta) {
  console.error("Could not locate the newly created sheet id. Aborting.");
  process.exit(1);
}

await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SHEET_ID,
  requestBody: {
    requests: [
      {
        updateSheetProperties: {
          properties: { sheetId: scheduleMeta.properties.sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: scheduleMeta.properties.sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: HEADERS.length,
          },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: "userEnteredFormat.textFormat",
        },
      },
    ],
  },
});

console.log(`${SHEET_NAME} tab ready with headers: ${HEADERS.join(", ")}`);