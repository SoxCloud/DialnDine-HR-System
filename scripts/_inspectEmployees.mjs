/**
 * One-off script: list employees (Employee_ID, Full_Name, role, status, current password length).
 * Run: node --env-file=.env.local scripts/_inspectEmployees.mjs
 */
import { COLS, SHEETS, getSheetData } from "../lib/googleSheets.js";

const rows = await getSheetData(SHEETS.employees, "A1:I");
for (const row of rows) {
  const name = String(row[COLS.employees.fullName] ?? "").trim();
  console.log(
    JSON.stringify({
      employeeId: String(row[COLS.employees.employeeId] ?? "").trim(),
      name,
      role: String(row[COLS.employees.role] ?? "").trim(),
      status: String(row[COLS.employees.status] ?? "").trim(),
      hasPassword: Boolean(String(row[COLS.employees.password] ?? "").trim()),
    })
  );
}
console.log(`TOTAL ${rows.length}`);
