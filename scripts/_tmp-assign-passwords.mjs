/**
 * scripts/_tmp-assign-passwords.mjs
 *
 * Assigns a deterministic password to every employee in the Employees sheet:
 *   password = "callcenter" + lowercase(<first-initial><surname-initial>)
 * with the initials taken from the first character of the first word and the
 * first character of the last word of Full_Name.
 *
 * Overwrites ALL existing Password values (per user instruction).
 *
 * Usage:
 *   node scripts/_tmp-assign-passwords.mjs          # dry run
 *   node scripts/_tmp-assign-passwords.mjs --write   # apply
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

function buildPassword(fullName) {
  const words = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0];
  const last = words[words.length - 1][0];
  const initials = (first + last).toLowerCase();
  return `callcenter${initials}`;
}

// Read current Employees sheet.
const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: "Employees!A1:H2000",
  valueRenderOption: "UNFORMATTED_VALUE",
});
const values = res.data.values ?? [];
const header = values[0] ?? [];
const fullIdx = header.indexOf("Full_Name");
const passIdx = header.indexOf("Password");
if (fullIdx === -1) throw new Error('No "Full_Name" header');
if (passIdx === -1) throw new Error('No "Password" header (column H)');

const PASSWORD_COL = String.fromCharCode(65 + passIdx); // "H"

const updates = [];
const unchanged = [];
let total = 0;

for (let i = 1; i < values.length; i++) {
  const row = values[i];
  const name = String(row[fullIdx] ?? "").trim();
  if (!name) continue; // skip blank rows
  total++;
  const rowNumber = i + 1; // 1-based, header is row 1
  const newPassword = buildPassword(name);
  const oldPassword = String(row[passIdx] ?? "").trim();
  updates.push({ rowNumber, name, newPassword, oldPassword });
  if (oldPassword === newPassword) unchanged.push({ rowNumber, name, password: newPassword });
}

const changed = updates.filter((u) => u.oldPassword !== u.newPassword).length;
console.log(`Total employees (with a name): ${total}`);
console.log(`Passwords that will CHANGE: ${changed}`);
console.log(`Passwords already matching (unchanged): ${total - changed}`);
console.log(`Password column: ${PASSWORD_COL}`);

// Show a sample including the example name if present.
const sampleNames = new Set(["Thembi Msibi", "Mbali Makhubu", "Sogcinwa Nkala", "Ntombi", "Neo Shabalala", "Lerato Lucy Twala", "Frank Jabu Phiri"]);
console.log("\nSample mappings:");
for (const u of updates) {
  if (sampleNames.has(u.name)) {
    console.log(`  r${u.rowNumber} ${u.name.padEnd(20)} ${JSON.stringify(u.oldPassword).padEnd(28)} -> ${u.newPassword}`);
  }
}
// Show first 5 and the Thembi example explicitly
const ex = updates.find((u) => u.name === "Thembi Msibi");
if (ex) console.log(`  (example) Thembi Msibi -> ${ex.newPassword} (expect callcentertm)`);

if (!WRITE) {
  console.log("\nDRY RUN - run with --write to apply.");
  process.exit(0);
}

// Apply via batchUpdate: one updateCells-style request per row is wasteful;
// instead use values.update on the column range H2:H<n> with RAW.
const last = updates[updates.length - 1].rowNumber;
const colVals = updates.map((u) => [u.newPassword]);
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: `Employees!${PASSWORD_COL}2:${PASSWORD_COL}${last}`,
  valueInputOption: "RAW",
  resource: { values: colVals },
});
console.log(`\nWrote passwords to ${PASSWORD_COL}2:${PASSWORD_COL}${last}.`);

// Verify
const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `Employees!${PASSWORD_COL}2:${PASSWORD_COL}${last}`,
  valueRenderOption: "UNFORMATTED_VALUE",
});
const got = (verify.data.values ?? []).map((r) => String(r[0] ?? ""));
let matched = 0;
let mismatched = 0;
for (const u of updates) {
  const actual = got[u.rowNumber - 2] ?? "";
  if (actual === u.newPassword) matched++;
  else {
    mismatched++;
    console.log(`  MISMATCH r${u.rowNumber} ${u.name}: expected ${u.newPassword} got ${actual}`);
  }
}
console.log(`Verified: ${matched} match, ${mismatched} mismatched.`);
console.log(mismatched === 0
  ? `SUCCESS: assigned passwords to ${total} employees (rule: callcenter<first><last>).`
  : "WARNING: verification mismatch.");
