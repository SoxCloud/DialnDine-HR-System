/**
 * scripts/update-settings.mjs
 * Read or update a row in the Settings sheet.
 *
 * Usage:
 *   node scripts/update-settings.mjs            -> list all settings
 *   node scripts/update-settings.mjs <Setting> <Value>   -> set (updates or appends)
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

const args = process.argv.slice(2);

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: "Settings!A1:B",
});
const values = res.data.values ?? [];

if (args.length === 0) {
  for (const [index, row] of values.entries()) {
    if (index === 0) continue;
    console.log(`${String(row[0] ?? "").trim()}=${String(row[1] ?? "").trim()}`);
  }
  process.exit(0);
}

if (args.length !== 2) {
  console.error("Usage: node scripts/update-settings.mjs [<Setting> <Value>]");
  process.exit(1);
}

const [setting, value] = args;
let matchedRow = null;
for (let r = 1; r < values.length; r++) {
  const name = String(values[r][0] ?? "").trim().toLowerCase();
  if (name === setting.toLowerCase()) {
    matchedRow = r + 1;
    break;
  }
}

if (matchedRow) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Settings!B${matchedRow}`,
    valueInputOption: "RAW",
    resource: { values: [[value]] },
  });
  console.log(`Updated row ${matchedRow} (${setting}) = ${value}`);
} else {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Settings!A1",
    valueInputOption: "RAW",
    resource: { values: [[setting, value]] },
  });
  console.log(`Appended (${setting}) = ${value}`);
}
