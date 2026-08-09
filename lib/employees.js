/**
 * lib/employees.js
 *
 * Employee lookups shared by login, clock-in, clock-out and status routes.
 * Reads only the Employees columns these features need (A..I).
 */
import { COLS, SHEETS, getSheetData } from "./googleSheets";

const EMPLOYEE_COLS = "A1:I";

/** Fetch an employee row by email (case-insensitive). Returns null when absent. */
export async function findEmployeeByEmail(email) {
  const target = String(email ?? "").trim().toLowerCase();
  if (!target) return null;
  const rows = await getSheetData(SHEETS.employees, EMPLOYEE_COLS);
  return (
    rows.find(
      (row) =>
        String(row[COLS.employees.email] ?? "").trim().toLowerCase() === target
    ) || null
  );
}

/** Fetch an employee row by extension number. Returns null when absent. */
export async function findEmployeeByExtension(extension) {
  const target = String(extension ?? "").trim();
  if (!target) return null;
  const rows = await getSheetData(SHEETS.employees, EMPLOYEE_COLS);
  return (
    rows.find(
      (row) =>
        String(row[COLS.employees.extension] ?? "").trim() === target
    ) || null
  );
}

/** Fetch an employee row by Employee_ID. Returns null when absent. */
export async function findEmployeeById(employeeId) {
  const target = String(employeeId ?? "").trim();
  if (!target) return null;
  const rows = await getSheetData(SHEETS.employees, EMPLOYEE_COLS);
  return (
    rows.find(
      (row) =>
        String(row[COLS.employees.employeeId] ?? "").trim() === target
    ) || null
  );
}