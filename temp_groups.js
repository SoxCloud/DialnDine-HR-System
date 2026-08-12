import { COLS, SHEETS, getSheetData } from "./lib/googleSheets.js";

const groups = await getSheetData(SHEETS.groups, "A1:D");
console.log("Groups:", JSON.stringify(groups.slice(0, 5)));