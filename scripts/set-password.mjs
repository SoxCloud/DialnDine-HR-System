/**
 * scripts/set-password.mjs
 * Set the Password (and optionally Extension_Number) for employee rows
 * matching an email, optionally constrained by role.
 *
 * Usage:
 *   node scripts/set-password.mjs <email> <password> [role]
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

const [email, password, roleFilter] = process.argv.slice(2);
if (!email || password === undefined) {
  console.error("Usage: node scripts/set-password.mjs <email> <password> [role]");
  process.exit(1);
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: "Employees!A1:I200",
});
const values = res.data.values ?? [];

const headerIndex = new Map(values[0].map((h, i) => [String(h ?? "").trim(), i]));

let updated = 0;
for (let r = 1; r < values.length; r++) {
  const row = values[r];
  const rowEmail = String(row[headerIndex.get("Email")] ?? "").trim().toLowerCase();
  const rowRole = String(row[headerIndex.get("Role")] ?? "").trim();
  if (rowEmail !== email.toLowerCase()) continue;
  if (roleFilter && rowRole !== roleFilter) continue;

  const colLetter = String.fromCharCode(65 + headerIndex.get("Password"));
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Employees!${colLetter}${r + 1}`,
    valueInputOption: "RAW",
    resource: { values: [[password]] },
  });
  updated++;
  console.log(`Updated Password for row ${r + 1} (${row[headerIndex.get("Full_Name")]}, ${rowRole})`);
}

if (updated === 0) {
  console.error("No matching employee rows found.");
  process.exit(1);
}
