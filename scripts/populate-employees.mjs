/**
 * scripts/populate-employees.mjs
 *
 * One-time import of the predefined agent roster into the Employees sheet.
 * - Adds a "Group" header column if missing (appended after the last column).
 * - Appends one row per agent, filling ONLY Full_Name and Group; all other
 *   columns are left empty.
 * - Never overwrites existing data. Names already present in the sheet are
 *   skipped (case-insensitive, tolerant of minor spelling variants).
 *
 * Usage:
 *   node scripts/populate-employees.mjs            # dry run, prints plan
 *   node scripts/populate-employees.mjs --write     # apply changes
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

const AGENTS = {
  "Perm 1": [
    "Tshepiso Moletsane",
    "Nelson Mngomezulu",
    "Thandi Macwele",
    "Zanele Hlope",
    "Ntswaki Mokoena",
    "Nkosazane Chitwayo",
    "Mbali Tshabangu",
    "Thato Mokoena",
  ],
  "Perm 2": [
    "Thembi Msibi",
    "Nthabeleng Rathaba",
    "Itumeleng Masopha",
    "Faith Monyane",
    "Hercilia Dlamini",
    "Sharon Mangena",
    "Ntokonzo Xulu",
  ],
  "Group 1": [
    "Ntando Ntlabati",
    "Lidinga Qhetshele",
    "Takalani Davhana",
    "Merciline Mpofu",
    "Mapaseka Mpofu",
  ],
  "Group 2": [
    "Mbuso Thamaha",
    "Mpho Tshabalala",
    "Nomgcibelo Mkhonza",
    "Dineo Thabisi",
    "Refiloe Molaba",
    "Thobeka Maqungo",
    "Boitumelo Moutloatse",
  ],
  "Group 3": [
    "Jade Swarts",
    "Courtney Slabbert",
    "Mathapelo Moloi",
    "Shemica Patel",
    "Hope Masha",
    "Thato Mokoena",
    "Busisiwe Mokoena",
  ],
  "Group 4": [
    "Lungile Madubela",
    "Nokuzola Buthelezi",
    "Gugulakhe Methula",
    "Nonkululelo Ngubeni",
    "Martha Sithole",
    "Khanyinkosi Nkosi",
    "Lerato Koza",
  ],
  "Group 5": [
    "Unarine Ramapulana",
    "Busisiwe Ndhlovu",
    "Thokozile Ndhlovu",
    "Frank Jabu Phiri",
    "Nomfundo Ngwenya",
  ],
  "Group 6": [
    "Zamambo Mkhize",
    "Thabiso Mokhesi",
    "Fanele Xulu",
    "Asanda Tyabula",
    "Nokwanda Maleka",
  ],
  "Group 7": [
    "Keitumetse Mokoena",
    "Noluthando Mtshali",
    "Mfundo Makanda",
    "Asande Mngoma",
    "Enamandla Matsepe",
    "Yolanda Myakayaka",
  ],
  "Group 8": [
    "Lutendo Luvhengo",
    "Thulani Mavhungu",
    "Godfrey Suping",
    "Nompumelelo Mapela",
    "Seipati Molefe",
    "Boitumelo Moutloatse",
  ],
  "Group 9": [
    "Khensani Ntlatlampo",
    "Lebohang Dlamini",
    "Likhona Mtwebana",
    "Charmaine Mkhwanazi",
    "Amkitha Sihamba",
    "Gugulethu Radebe",
  ],
  "Yes A": [
    "Bulhebendalo Mabizela",
    "Bavumile Shembe",
    "Sanele Bidi",
    "Unity Khunou",
    "Noluthando Loko",
  ],
  "Yes B": [
    "Khabonina Mahlangu",
    "Mpho Rathaba",
    "Emaculate Chauke",
    "Prudence Ngobeni",
    "Matshidiso Tebele",
    "Andile Khumalo",
  ],
  "Yes C": [
    "Ofentse Mashigo",
    "Nkamoheleng Lehana",
    "Nomagugu Mazeka",
    "Keitumetsi Mogotsi",
    "Lindokuhle Ndhlovu",
    "Mpho Moalosi",
  ],
  "Casualties 1": [
    "Karabelo Cele",
    "Nomathuba Ncube",
    "Tholoana Molaba",
    "Keyonne Bluemeyer",
    "Noko Ramahlodi",
    "Kim-Lee Kriel",
  ],
  "Online Agents": ["Lerato Mpofu"],
};

const normalize = (name) => String(name ?? "").toLowerCase().replace(/\s+/g, "");

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[n];
}

/** Closest existing name within 2 edits (normalized), or null. */
function findExistingMatch(norm, existingList) {
  let best = null;
  for (const entry of existingList) {
    const distance = norm === entry.norm ? 0 : levenshtein(norm, entry.norm);
    if (distance <= 2) {
      if (!best || distance < best.distance) best = { raw: entry.raw, distance };
      if (distance === 0) break;
    }
  }
  return best;
}

function columnLetter(index) {
  let n = index;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

// --- Read current Employees sheet ---
const read = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: "Employees!A1:J2000",
  valueRenderOption: "UNFORMATTED_VALUE",
});
const values = read.data.values ?? [];
const header = values[0] ?? [];
const fullNameIdx = header.indexOf("Full_Name");
if (fullNameIdx === -1) throw new Error("No Full_Name header in Employees sheet");

const existingList = [];
for (const row of values.slice(1)) {
  const raw = String(row[fullNameIdx] ?? "").trim();
  if (raw) existingList.push({ raw, norm: normalize(raw) });
}

let lastRow = 1;
values.forEach((row, i) => {
  if (i > 0 && row.some((cell) => String(cell ?? "").trim() !== "")) lastRow = i + 1;
});

// --- Build rows to insert ---
const toInsert = [];
const skipped = [];
let total = 0;
for (const [groupName, names] of Object.entries(AGENTS)) {
  for (const rawName of names) {
    total++;
    const name = String(rawName ?? "").trim();
    if (!name) {
      skipped.push({ name: "<blank>", group: groupName, reason: "empty name" });
      continue;
    }
    const match = findExistingMatch(normalize(name), existingList);
    if (match) {
      skipped.push({
        name,
        group: groupName,
        reason: `already in sheet as "${match.raw}"`,
      });
      continue;
    }
    toInsert.push([name, groupName]);
  }
}

console.log(`Total names in data: ${total}`);
console.log(`Skipped (already in sheet): ${skipped.length}`);
for (const s of skipped) console.log(`  SKIP "${s.name}" [${s.group}] -> ${s.reason}`);
console.log(`To insert: ${toInsert.length} rows`);
if (toInsert.length) {
  const byGroup = {};
  for (const [name, group] of toInsert) byGroup[group] = (byGroup[group] || 0) + 1;
  console.log("Per group:", JSON.stringify(byGroup));
}

if (!WRITE) {
  console.log("\nDRY RUN - run with --write to apply changes.");
  process.exit(0);
}

// --- Add "Group" header if missing ---
let groupIdx = header.indexOf("Group");
if (groupIdx === -1) {
  groupIdx = header.length;
  const letter = columnLetter(groupIdx + 1);
  if (header[groupIdx] && String(header[groupIdx]).trim() !== "") {
    throw new Error(`Column ${letter}1 already has "${header[groupIdx]}"; refusing to overwrite.`);
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Employees!${letter}1`,
    valueInputOption: "RAW",
    resource: { values: [["Group"]] },
  });
  console.log(`Added "Group" header at Employees!${letter}1`);
}

// --- Append rows (Full_Name in B, Group in its column, everything else empty) ---
if (toInsert.length) {
  const width = groupIdx + 1;
  const rows = toInsert.map(([name, group]) => {
    const row = new Array(width).fill("");
    row[fullNameIdx] = name;
    row[groupIdx] = group;
    return row;
  });

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `Employees!A${lastRow + 1}`,
    valueInputOption: "RAW",
    resource: { values: rows },
  });
  console.log("Append range:", appendRes.data.updates?.updatedRange);
}

// --- Verify ---
const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `Employees!A1:J${lastRow + toInsert.length + 5}`,
  valueRenderOption: "UNFORMATTED_VALUE",
});
const vvals = verify.data.values ?? [];
const vHeader = vvals[0] ?? [];
const vFull = vHeader.indexOf("Full_Name");
const vGroup = vHeader.indexOf("Group");

let newRows = 0;
let emptyRows = 0;
let missingGroup = 0;
for (let i = 1; i < vvals.length; i++) {
  if (i + 1 <= lastRow) continue;
  const row = vvals[i];
  const name = String(row[vFull] ?? "").trim();
  const group = String(row[vGroup] ?? "").trim();
  if (name) {
    newRows++;
    if (!group) missingGroup++;
  } else if (row.some((cell) => String(cell ?? "").trim() !== "")) {
    emptyRows++;
  }
}

console.log(`Verified new rows with Full_Name: ${newRows}`);
console.log(`Verified new rows missing Group: ${missingGroup}`);
console.log(`Verified empty rows inserted: ${emptyRows}`);
console.log(
  `SUCCESS: inserted ${newRows} employees into the Employees sheet (Full_Name + Group only).`
);
