/**
 * scripts/add-employee.mjs
 *
 * Add an employee row to the Employees sheet, ensuring the auth columns
 * (Password, Extension_Number) exist first.
 *
 * Usage:
 *   node scripts/add-employee.mjs <employeeId> <fullName> <email> <department> <startDate> <role> <status> <password> [extension]
 *
 * Example:
 *   node scripts/add-employee.mjs E001 "HR Manager" hr@dialndine.com "Management" 2026-01-01 HR Active secret123 101
 */
import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env.local loader (no dotenv dependency).
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

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

function requireArgs(args) {
  if (args.length < 8) {
    console.error(
      "Usage: node scripts/add-employee.mjs <employeeId> <fullName> <email> <department> <startDate> <role> <status> <password> [extension]"
    );
    process.exit(1);
  }
}

const [employeeId, fullName, email, department, startDate, role, status, password, extension = ""] =
  process.argv.slice(2);

requireArgs([
  employeeId,
  fullName,
  email,
  department,
  startDate,
  role,
  status,
  password,
]);

if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error("Missing GOOGLE_SHEET_ID / GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY in environment");
  process.exit(1);
}

const auth = new google.auth.JWT({ email: CLIENT_EMAIL, key: PRIVATE_KEY, scopes: SCOPES });
const sheets = google.sheets({ version: "v4", auth });

const SHEET = "Employees";

async function main() {
  // Read current headers so we can extend them without clobbering data.
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET}!A1:I1`,
  });
  const headers = (headerRes.data.values?.[0] ?? []).map((h) => String(h ?? "").trim());
  const addHeader = async (name) => {
    if (!headers.includes(name)) {
      headers.push(name);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET}!${String.fromCharCode(64 + headers.length)}1`,
        valueInputOption: "RAW",
        resource: { values: [[name]] },
      });
    }
  };

  await addHeader("Password");
  await addHeader("Extension_Number");

  // Build a full row aligned to the (possibly extended) headers.
  const row = headers.map((header) => {
    switch (header) {
      case "Employee_ID":
        return employeeId;
      case "Full_Name":
        return fullName;
      case "Email":
        return email;
      case "Department":
        return department;
      case "Start_Date":
        return startDate;
      case "Role":
        return role;
      case "Status":
        return status;
      case "Password":
        return password;
      case "Extension_Number":
        return extension;
      default:
        return "";
    }
  });

  // Guard against duplicate employee IDs / emails.
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET}!A2:C1000`,
  });
  const rows = existing.data.values ?? [];
  const dup =
    rows.find((r) => String(r[0] ?? "").trim() === employeeId) ||
    rows.find((r) => String(r[2] ?? "").trim().toLowerCase() === email.toLowerCase());
  if (dup) {
    console.error("Duplicate Employee_ID or Email already present — aborting.");
    process.exit(1);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET}!A1`,
    valueInputOption: "RAW",
    resource: { values: [row] },
  });

  console.log(
    `Added ${role} employee ${employeeId} (${fullName}) <${email}>` +
      (extension ? ` ext ${extension}` : "")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
