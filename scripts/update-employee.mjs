/**
 * scripts/update-employee.mjs
 * Update auth fields (Email, Password, Extension_Number) on an employee
 * row matched by Employee_ID. Only provided fields are changed.
 *
 * Usage:
 *   node scripts/update-employee.mjs <employeeId> [--email <email>] [--password <password>] [--extension <ext>]
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
const employeeId = args[0];
if (!employeeId) {
  console.error("Usage: node scripts/update-employee.mjs <employeeId> [--email <email>] [--password <password>] [--extension <ext>]");
  process.exit(1);
}

const flags = new Map();
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith("--") && args[i + 1] && !args[i + 1].startsWith("--")) {
    flags.set(args[i].slice(2), args[i + 1]);
    i++;
  }
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
  range: "Employees!A1:I1000",
});
const values = res.data.values ?? [];

const headerIndex = new Map(values[0].map((h, i) => [String(h ?? "").trim(), i]));
const columnLetter = (header) => String.fromCharCode(65 + headerIndex.get(header));

let found = null;
for (let r = 1; r < values.length; r++) {
  const rowId = String(values[r][headerIndex.get("Employee_ID")] ?? "").trim();
  if (rowId !== employeeId) continue;
  found = { rowNumber: r + 1, row: values[r] };
  break;
}

if (!found) {
  console.error(`No employee row found with Employee_ID "${employeeId}".`);
  process.exit(1);
}

const updates = [];
for (const [field, value] of flags) {
  const header = { email: "Email", password: "Password", extension: "Extension_Number" }[field];
  if (!header) {
    console.error(`Unknown field "${field}". Use --email, --password, or --extension.`);
    process.exit(1);
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Employees!${columnLetter(header)}${found.rowNumber}`,
    valueInputOption: "RAW",
    resource: { values: [[value]] },
  });
  updates.push(`${header}=${value}`);
}

if (updates.length === 0) {
  console.error("No fields to update. Pass --email, --password, and/or --extension.");
  process.exit(1);
}

console.log(
  `Updated row ${found.rowNumber} (${found.row[headerIndex.get("Full_Name")]}, ${found.row[headerIndex.get("Role")]}): ${updates.join(", ")}`
);
