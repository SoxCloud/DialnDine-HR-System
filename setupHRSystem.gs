/**
 * Dial n Dine HR System
 *
 * Run setupHRSystem() to build the complete HR spreadsheet.
 */

const VERSION = "1.0";

const SPREADSHEET_NAME = "Dial n Dine HR System";

const DATA_ROWS = 200;

const SHEETS_CONFIG = [
  {
    name: "Employees",
    headers: ["Employee_ID", "Full_Name", "Email", "Department", "Start_Date", "Role", "Status", "Password", "Extension_Number"]
  },
  {
    name: "Attendance_Log",
    headers: ["Date", "Employee_ID", "Clock_In", "Clock_Out", "Hours_Worked", "Late", "Notes"]
  },
  {
    name: "Leave_Requests",
    headers: ["Request_ID", "Employee_ID", "Start_Date", "End_Date", "Days", "Status", "Approved_By", "Reason"]
  },
  {
    name: "Leave_Balance",
    headers: ["Employee_ID", "Total_Leave", "Used_Leave", "Remaining_Leave"]
  },
  {
    name: "Groups",
    headers: ["Group_ID", "Group_Name", "Start_Time", "End_Time", "Members"]
  },
  {
    name: "Credits",
    headers: ["Employee_ID", "Credits", "Updated_At"]
  },
  {
    name: "Schedule",
    headers: ["Group_ID", "Date", "Start_Time", "End_Time"]
  },
  {
    name: "Dashboard",
    headers: ["Metric", "Value"]
  },
  {
    name: "Settings",
    headers: ["Setting", "Value"]
  }
];

const SHEET_NAMES = SHEETS_CONFIG.map((config) => config.name);

let targetSpreadsheet = null;

function setupHRSystem() {
  targetSpreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);

  for (const config of SHEETS_CONFIG) {
    createSheet(config.name, config.headers);
  }

  removePlaceholderSheets(targetSpreadsheet);

  for (const sheetName of SHEET_NAMES) {
    const sheet = targetSpreadsheet.getSheetByName(sheetName);
    insertFormulas(sheet);
    setupValidation(sheet);
    applyFormatting(sheet);
  }

  insertSettings();

  const spreadsheetId = targetSpreadsheet.getId();
  const spreadsheetUrl = targetSpreadsheet.getUrl();

  Logger.log("Spreadsheet created: %s", spreadsheetUrl);

  return {
    spreadsheetId,
    spreadsheetUrl
  };
}

/**
 * Migrate an EXISTING "Dial n Dine HR System" spreadsheet that predates the
 * auth columns. Adds the "Password" and "Extension_Number" columns to the
 * Employees sheet (only when missing) so email/password login and
 * extension-based clock in/out work without recreating the file.
 */
function addEmployeeAuthColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Employees");
  if (!sheet) return;

  let lastColumn = sheet.getLastColumn() || 1;
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  if (!headers.includes("Password")) {
    lastColumn += 1;
    sheet.getRange(1, lastColumn).setValue("Password").setFontWeight("bold");
  }
  if (!headers.includes("Extension_Number")) {
    lastColumn += 1;
    sheet.getRange(1, lastColumn).setValue("Extension_Number").setFontWeight("bold");
  }
}

function createSheet(name, headers) {
  const sheet = targetSpreadsheet.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function removePlaceholderSheets(ss) {
  for (const sheet of ss.getSheets()) {
    if (!SHEET_NAMES.includes(sheet.getName())) {
      ss.deleteSheet(sheet);
    }
  }
}

function applyFormatting(sheet) {
  const lastColumn = sheet.getLastColumn();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastColumn).setFontWeight("bold");
  try {
    sheet.autoResizeColumns(1, lastColumn);
  } catch (error) {
    Logger.log("Auto-resize skipped for '%s': %s", sheet.getName(), error.message);
  }
}

function insertFormulas(sheet) {
  switch (sheet.getName()) {
    case "Attendance_Log":
      sheet
        .getRange(2, 5, DATA_ROWS, 1)
        .setFormula('=IF(AND(C2<>"",D2<>""),(D2-C2)*24,"")');
      sheet
        .getRange(2, 6, DATA_ROWS, 1)
        .setFormula('=IF(C2="","",IF(C2>TIME(8,0,0),"Late","On Time"))');
      break;

    case "Leave_Requests":
      sheet
        .getRange(2, 5, DATA_ROWS, 1)
        .setFormula('=IF(AND(C2<>"",D2<>""),D2-C2+1,"")');
      break;

    case "Leave_Balance":
      sheet
        .getRange(2, 2, DATA_ROWS, 1)
        .setFormula('=IF(DATEDIF(VLOOKUP(A2,Employees!A:E,5,FALSE),TODAY(),"Y")>=3,30,0)');
      sheet
        .getRange(2, 3, DATA_ROWS, 1)
        .setFormula('=SUMIFS(Leave_Requests!E:E,Leave_Requests!B:B,A2,Leave_Requests!F:F,"Approved")');
      sheet
        .getRange(2, 4, DATA_ROWS, 1)
        .setFormula("=B2-C2");
      break;

    case "Dashboard":
      sheet.getRange(2, 1).setValue("Total Employees");
      sheet.getRange(2, 2).setFormula("=COUNTA(Employees!A2:A)");

      sheet.getRange(3, 1).setValue("Present Today");
      sheet.getRange(3, 2).setFormula("=COUNTIF(Attendance_Log!A:A,TODAY())");

      sheet.getRange(4, 1).setValue("Late Today");
      sheet.getRange(4, 2).setFormula('=COUNTIFS(Attendance_Log!A:A,TODAY(),Attendance_Log!F:F,"Late")');

      sheet.getRange(5, 1).setValue("Total Hours Today");
      sheet.getRange(5, 2).setFormula("=SUMIF(Attendance_Log!A:A,TODAY(),Attendance_Log!E:E)");
      break;
  }
}

function setupValidation(sheet) {
  switch (sheet.getName()) {
    case "Employees":
      addDropdown(sheet, 6, ["Admin", "Agent", "HR"]);
      addDropdown(sheet, 7, ["Active", "Inactive"]);
      break;

    case "Leave_Requests":
      addDropdown(sheet, 6, ["Pending", "Approved", "Rejected"]);
      break;
  }
}

function addDropdown(sheet, column, options) {
  const range = sheet.getRange(2, column, DATA_ROWS, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function insertSettings() {
  const sheet = targetSpreadsheet.getSheetByName("Settings");

  const shiftStart = new Date(1899, 11, 30, 8, 0, 0);

  sheet.getRange(2, 1).setValue("Shift Start");
  sheet.getRange(2, 2).setValue(shiftStart);
  sheet.getRange(2, 2).setNumberFormat("hh:mm:ss");

  sheet.getRange(3, 1).setValue("Work Hours");
  sheet.getRange(3, 2).setValue(8);

  sheet.getRange(4, 1).setValue("Leave Days");
  sheet.getRange(4, 2).setValue(30);

  sheet.getRange(5, 1).setValue("Clock Locked");
  sheet.getRange(5, 2).setValue("No");

  // Canonical switch: set to "No" to disable clocking (the kiosk hides the
  // keypad and /api/clock-in + /api/clock-out reject with 403).
  sheet.getRange(6, 1).setValue("Clock Enabled");
  sheet.getRange(6, 2).setValue("Yes");
}

/**
 * Add the "Clock Locked" row to an EXISTING spreadsheet's Settings sheet
 * (only when missing). Set the value to "Yes" to freeze the time clock kiosk.
 */
function ensureClockLockSetting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  const hasRow = values.some(
    (row) => String(row[0]).trim().toLowerCase() === "clock locked"
  );
  if (hasRow) return;

  sheet.getRange(lastRow + 1, 1).setValue("Clock Locked");
  sheet.getRange(lastRow + 1, 2).setValue("No");
}

/**
 * Add the "Clock Enabled" row to an EXISTING spreadsheet's Settings sheet
 * (only when missing). This is the canonical switch used by the clocking
 * APIs; "Clock Locked" is kept as a legacy inverse fallback.
 */
function ensureClockEnabledSetting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  const hasRow = values.some(
    (row) => String(row[0]).trim().toLowerCase() === "clock enabled"
  );
  if (hasRow) return;

  sheet.getRange(lastRow + 1, 1).setValue("Clock Enabled");
  sheet.getRange(lastRow + 1, 2).setValue("Yes");
}

/**
 * Add the admin dashboard schema to an EXISTING spreadsheet:
 *  - "Reason" column on Leave_Requests (only when missing)
 *  - "Groups" sheet (only when missing)
 *  - "Credits" sheet (only when missing)
 *  - "Schedule" sheet (only when missing)
 */
function addHRAdminSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const leaveSheet = ss.getSheetByName("Leave_Requests");
  if (leaveSheet) {
    const headers = leaveSheet.getRange(1, 1, 1, leaveSheet.getLastColumn()).getValues()[0];
    if (!headers.includes("Reason")) {
      const column = leaveSheet.getLastColumn() + 1;
      leaveSheet.getRange(1, column).setValue("Reason").setFontWeight("bold");
    }
  }

  const groups = ss.getSheetByName("Groups");
  if (!groups) {
    insertAdminSheet(ss, "Groups", ["Group_ID", "Group_Name", "Start_Time", "End_Time", "Members"]);
  }

  const credits = ss.getSheetByName("Credits");
  if (!credits) {
    insertAdminSheet(ss, "Credits", ["Employee_ID", "Credits", "Updated_At"]);
  } else {
    const headers = credits.getRange(1, 1, 1, credits.getLastColumn()).getValues()[0];
    if (!headers.includes("Updated_At")) {
      const column = credits.getLastColumn() + 1;
      credits.getRange(1, column).setValue("Updated_At").setFontWeight("bold");
    }
  }

  const schedule = ss.getSheetByName("Schedule");
  if (!schedule) {
    insertAdminSheet(ss, "Schedule", ["Group_ID", "Date", "Start_Time", "End_Time"]);
  }
}

function insertAdminSheet(ss, name, headers) {
  for (const sheet of ss.getSheets()) {
    if (sheet.getName() === name) {
      ss.deleteSheet(sheet);
    }
  }
  const sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch (error) {
    Logger.log("Auto-resize skipped for '%s': %s", name, error.message);
  }
}