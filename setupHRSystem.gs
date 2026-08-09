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
    headers: ["Employee_ID", "Full_Name", "Email", "Department", "Start_Date", "Role", "Status"]
  },
  {
    name: "Attendance_Log",
    headers: ["Date", "Employee_ID", "Clock_In", "Clock_Out", "Hours_Worked", "Late", "Notes"]
  },
  {
    name: "Leave_Requests",
    headers: ["Request_ID", "Employee_ID", "Start_Date", "End_Date", "Days", "Status", "Approved_By"]
  },
  {
    name: "Leave_Balance",
    headers: ["Employee_ID", "Total_Leave", "Used_Leave", "Remaining_Leave"]
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
}