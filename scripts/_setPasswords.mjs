/**
 * One-off migration: set every employee's password to
 * "callcenter" + first initial of first name + first initial of last name,
 * all lowercase. e.g. "Lerato Lucy Twala" -> "callcenterlt".
 * Skips employees whose password is already set correctly.
 *
 * Run: node --env-file=.env.local scripts/_setPasswords.mjs
 * Processes ALL employees with a name, regardless of employeeId.
 */
import { COLS, SHEETS, readRange, updateRow } from "../lib/googleSheets.js";

const RANGE = "A1:I";
const raw = await readRange(SHEETS.employees, RANGE);
if (!raw || !raw.length) {
  console.error("No data");
  process.exit(1);
}

const headers = raw[0].map((h) => String(h ?? "").trim());
const idIdx = headers.indexOf(COLS.employees.employeeId);
const nameIdx = headers.indexOf(COLS.employees.fullName);
const passwordIdx = "H";

function initials(fullName) {
  const words = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const first = words[0]?.[0] ?? "";
  const last = words[words.length - 1]?.[0] ?? "";
  return (first + last).toLowerCase();
}

// Build map of row number -> name and compute desired password for every row with a name
const employeeRows = [];
let totalWithName = 0;
for (let i = 1; i < raw.length; i++) {
  const row = raw[i];
  const name = String(raw[i][nameIdx] ?? "").trim();
  if (!name) continue;
  totalWithName++;
  const desiredPwd = `callcenter${initials(name)}`;
  employeeRows.push({ row: i + 1, name, desiredPwd });
}

// Build map of current passwords (lowercase) for all rows with a name
const currentPasswords = new Map();
for (let i = 1; i < raw.length; i++) {
  const row = raw[i];
  const name = String(raw[i][nameIdx] ?? "").trim();
  if (!name) continue;
  const cpwd = String(raw[i][passwordIdx] ?? "").trim().toLowerCase();
  // Use row number as key since employeeId may be duplicate/empty
  currentPasswords.set(i + 1, cpwd);
}

let updated = 0;
let skipped = 0;

// Process all employees with names, with 1-second delays between writes (Google Sheets API quota: 60 writes/min)
for (const info of employeeRows) {
  const rowNumber = info.row;
  const name = info.name;
  const desiredPwd = info.desiredPwd;
  const currentPwd = currentPasswords.get(info.row);

  if (currentPwd === desiredPwd) {
    skipped++;
    continue;
  }

  try {
    await updateRow(SHEETS.employees, info.row, { [passwordIdx]: desiredPwd });
    updated++;
    // 1-second delay to respect 60 writes/min quota
    await new Promise(r => setTimeout(r, 1000));
  } catch (err) {
    console.error(`Failed to update row ${info.row} (${name}):`, err.message);
    skipped++;
  }
}

console.log(`UPDATED ${updated} | SKIPPED ${skipped} (already correct)`);
console.log(`Total employees with a name: ${employeeRows.length}`);