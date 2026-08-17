/**
 * scripts/_hashPasswords.mjs
 *
 * One-off migration: hash every non-empty, non-hashed password in the
 * Employees sheet Password column using scrypt (lib/passwords.js).
 *
 * Usage: node scripts/_hashPasswords.mjs [--dry-run]
 */
import { COLS, SHEETS, readRange, updateRow } from "../lib/googleSheets.js";
import { hashPassword } from "../lib/passwords.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const PREFIX = "scrypt$";

const values = await readRange(SHEETS.employees, "A1:I");
const headers = values[0];
const idx = {};
headers.forEach((h, i) => (idx[h] = i));

let hashed = 0;
let skipped = 0;

for (let i = 1; i < values.length; i++) {
  const row = values[i];
  const name = String(row[idx[COLS.employees.fullName]] ?? "").trim();
  const password = String(row[idx[COLS.employees.password]] ?? "").trim();

  if (!password) {
    skipped++;
    continue;
  }
  if (password.startsWith(PREFIX)) {
    skipped++;
    continue;
  }

  const hashedPassword = hashPassword(password);
  if (dryRun) {
    console.log(`[dry-run] r${i + 1} ${name}: would hash (length ${password.length})`);
    hashed++;
    continue;
  }

  await updateRow(SHEETS.employees, i + 1, {
    [String.fromCharCode(64 + idx[COLS.employees.password])]: hashedPassword,
  });
  console.log(`HASHED r${i + 1} ${name}`);
  hashed++;

  // Google Sheets write quota (~60/min).
  await new Promise((resolve) => setTimeout(resolve, 1100));
}

console.log(`\nDone: ${hashed} hashed, ${skipped} skipped (${dryRun ? "dry-run" : "applied"})`);