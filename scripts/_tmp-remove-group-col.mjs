/**
 * scripts/_tmp-remove-group-col.mjs
 * Removes ONLY the "Group" column from the Employees sheet (nothing else).
 * Usage: node scripts/_tmp-remove-group-col.mjs [--write]
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

const WRITE = process.argv.includes("--write");

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
const sheetMeta = meta.data.sheets.find((s) => s.properties.title === "Employees");
if (!sheetMeta) throw new Error("Employees sheet not found");
const sheetId = sheetMeta.properties.sheetId;

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: "Employees!A1:J2000",
  valueRenderOption: "UNFORMATTED_VALUE",
});
const header = (res.data.values ?? [])[0] ?? [];
console.log("Current header:", JSON.stringify(header));

const groupIdx = header.indexOf("Group");
if (groupIdx === -1) {
  console.log("No Group column present — nothing to remove.");
  process.exit(0);
}
const colLetter = String.fromCharCode(65 + groupIdx);
console.log(`Group column at ${colLetter} (index ${groupIdx}). Columns to the right of it: ${header.length - groupIdx - 1}`);
console.log("Removing ONLY column", colLetter + " (Group). All other columns preserved.");

if (!WRITE) {
  console.log("DRY RUN - run with --write to apply.");
  process.exit(0);
}

await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    requests: [
      {
        deleteDimension: {
          range: { sheetId, dimension: "COLUMNS", startIndex: groupIdx, endIndex: groupIdx + 1 },
        },
      },
    ],
  },
});
console.log(`Deleted column ${colLetter} (Group).`);

const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: "Employees!A1:J2000",
  valueRenderOption: "UNFORMATTED_VALUE",
});
const vvals = verify.data.values ?? [];
const vHeader = vvals[0] ?? [];
console.log("Verified header now:", JSON.stringify(vHeader));
console.log("Has 'Group' column:", vHeader.includes("Group"));
console.log("Column count now:", vHeader.length);
console.log("Total rows now:", vvals.length);
