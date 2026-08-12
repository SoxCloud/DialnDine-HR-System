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
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: "Employees!A1:J2000",
  valueRenderOption: "UNFORMATTED_VALUE",
});
const values = res.data.values ?? [];
const header = values[0] ?? [];
console.log("header length:", header.length, JSON.stringify(header));

let dataRows = 0;
let leftoverGroupJ = 0; // rows whose last cell (idx 9) still has a value
let nameMissing = 0;
for (let i = 1; i < values.length; i++) {
  const row = values[i];
  if (row.some((c) => String(c ?? "").trim() !== "")) dataRows++;
  const lastJ = String(row[9] ?? "").trim();
  if (lastJ) leftoverGroupJ++;
  const name = String(row[1] ?? "").trim();
  if (!name) nameMissing++;
}
console.log("data rows:", dataRows);
console.log("rows with leftover Group value in column J:", leftoverGroupJ);
console.log("rows with empty Full_Name:", nameMissing);

console.log("\nsample first 4 data rows:");
for (let i = 1; i < Math.min(5, values.length); i++) console.log(`r${i + 1}: ${JSON.stringify(values[i])}`);
console.log("\nsample last 3 data rows:");
for (let i = values.length - 3; i < values.length; i++) if (i >= 1) console.log(`r${i + 1}: ${JSON.stringify(values[i])}`);
