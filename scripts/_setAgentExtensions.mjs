import { COLS, SHEETS, readRange, updateRow } from "../lib/googleSheets.js";

// Curated mapping: list name (as provided) -> exact Full_Name in the sheet.
// Built from the sheet's actual names (which often differ in spelling from the list).
const MAP = [
  ["Amkhitha Sibamba", "Amkitha Sihamba"],
  ["Andiile Khumalo", "Andile Khumalo"],
  ["Asanda Tyabula", "Asanda Tyabula"],
  ["Asande Mngoma", "Asande Mngoma"],
  ["Bavumile Shembe", "Bavumile Shembe"],
  ["Boitumelo Moutloatse", "Boitumelo Moutloatse"],
  ["Buhlebendalo Mabizela", "Bulhebendalo Mabizela"],
  ["Busisiwe Mokoena", "Busisiwe Mokoena"],
  ["Busisiwe Ndlhovu", "Busisiwe Ndhlovu"],
  ["Chamain Mkwanazi", "Charmaine Mkhwanazi"],
  ["Cortney Slabbert", "Courtney Slabbert"],
  ["Dineo Thabisi", "Dineo Thabisi"],
  ["Emaculate Chauke", "Emaculate Chauke"],
  ["Enamandla Matsepa", "Enamandla Matsepe"],
  ["Faith Monyane", "Faith Monyane"],
  ["Fanele Xulu", "Fanele Xulu"],
  ["Frank Phiri", "Frank Jabu Phiri"],
  ["Godfrey Suping", "Godfrey Suping"],
  ["Gugulakhe Methula", "Gugulakhe Methula"],
  ["Gugulethu Radebe", "Gugulethu Radebe"],
  ["Hercilia Dlamini", "Hercilia Dlamini"],
  ["Hope Masha", "Hope Masha"],
  ["Itumeleng Masopha", "Itumeleng Masopha"],
  ["Jade Swarts", "Jade Swarts"],
  ["Karabelo Cele", "Karabelo Cele"],
  ["Keitumetsi Mogotse", "Keitumetsi Mogotsi"],
  ["Keitumetsi Mokoena", "Keitumetse Mokoena"],
  ["Keyonne Bluemeyer", "Keyonne Bluemeyer"],
  ["Khabonina Mahlangu", "Khabonina Mahlangu"],
  ["Khanyinkosi Nkosi", "Khanyinkosi Nkosi"],
  ["Khensani Ntlatlapo", "Khensani Ntlatlampo"],
  ["Kim-Lee Kriel", "Kim-Lee Kriel"],
  ["Lebohang Dhlamini", "Lebohang Dlamini"],
  ["Lerato Koza", "Lerato Koza"],
  ["Lerato Mpofu", "Lerato Mpofu"],
  ["Lidinga Qhetsele", "Lidinga Qhetshele"],
  ["Likhona Mtwebana", "Likhona Mtwebana"],
  ["Lindokuhle Ndhlovu", "Lindokuhle Ndhlovu"],
  ["Lungile Madubela", "Lungile Madubela"],
  ["Lutendo Luvhengo", "Lutendo Luvhengo"],
  ["Mapaseka Mpofu", "Mapaseka Mpofu"],
  ["Martha Sithole", "Martha Sithole"],
  ["Mathapelo Moloi", "Mathapelo Moloi"],
  ["Matshidiso Tebele", "Matshidiso Tebele"],
  ["Mbali Tshabangu", "Mbali Tshabangu"],
  ["Mbuso Thamaha", "Mbuso Thamaha"],
  ["Mercelline Mpofu", "Merciline Mpofu"],
  ["Mfundo Makanda", "Mfundo Makanda"],
  ["Mpho Moalosi", "Mpho Moalosi"],
  ["Mpho Rathaba", "Mpho Rathaba"],
  ["Mpho Tshabalala", "Mpho Tshabalala"],
  ["Nkamoheleng Lehana", "Nkamoheleng Lehana"],
  ["Nkosazane Chitwayo", "Nkosazana Chitwayo"],
  ["Noko Ramahlodi", "Noko Ramahlodi"],
  ["Nokuzola Buthelezi", "Nokuzola Buthelezi"],
  ["Nokwanda Maleka", "Nokwanda Maleka"],
  ["Noluthando Loko", "Noluthando Loko"],
  ["Noluthando Mtshali", "Noluthando Mtshali"],
  ["Nomagugu Mazeka", "Nomagugu Mazeka"],
  ["Nomathuba Ncube", "Nomathuba Ncube"],
  ["Nomfundo Ngwenya", "Nomfundo Ngwenya"],
  ["Nomgqibelo Mkhonza", "Nomgcibelo Mkhonza"],
  ["Nonkululeko Ngubeni", "Nonkululelo Ngubeni"],
  ["Ntando Ntlabati", "Ntando Ntlabati"],
  ["Nthabeleng Rathaba", "Nthabeleng Rathaba"],
  ["Ntokozo Xulu", "Ntokonzo Xulu"],
  ["Ntombi Hlatshwayo", "Ntombi"],
  ["Ntswaki Mokoena", "Nstwaki Mokoena"],
  ["Prudence Ngobeni", "Prudence Ngobeni"],
  ["Refiloe Molaba", "Refiloe Molaba"],
  ["Sanele Bidi", "Sanele Bidi"],
  ["Seipati Molefe", "Seipati Molefe"],
  ["Shamica Patel", "Shemica Patel"],
  ["Sharon Mangena", "Sharon Mangena"],
  ["Takalani Davhana", "Takalani Davhana"],
  ["Thabiso Mokhesi", "Thabiso Mokhesi"],
  ["Thandi Macwele", "Thandi Macwele"],
  ["Thato Mokoena", "Thato Mokoena"],
  ["Thembi Msibi", "Thembi Msibi"],
  ["Thobeka Maqungo", "Thobeka Maqungo"],
  ["Thokozile Ndhlovu", "Thokozile Ndhlovu"],
  ["Tholoana Molaba", "Tholoana Molaba"],
  ["Thulani Mavhungu", "Thulani Mavhungu"],
  ["Tshepiso Moletsane", "Tshepiso Moletsane"],
  ["Unarine Ramapulana", "Unarine Ramapulana"],
  ["Unity Khunou", "Unity Khunou"],
  ["Yolanda Myakayaka", "Yolanda Myakayaka"],
  ["Zamambo Mkize", "Zamambo Mkhize"],
  ["Zanele Hlophe", "Zanele Hlophe"],
];

// ID -> list name, preserving the exact IDs from the user's list.
const IDS = {
  AmkhithaSibamba: "1206",
  AndiileKhumalo: "220",
  AsandaTyabula: "116",
  AsandeMngoma: "176",
  BavumileShembe: "139",
  BoitumeloMoutloatse: "233",
  BuhlebendaloMabizela: "211",
  BusisiweMokoena: "1196",
  BusisiweNdlhovu: "2016",
  ChamainMkwanazi: "249",
  CortneySlabbert: "2018",
  DineoThabisi: "150",
  EmaculateChauke: "250",
  EnamandlaMatsepa: "194",
  FaithMonyane: "191",
  FaneleXulu: "247",
  FrankPhiri: "172",
  GodfreySuping: "110",
  GugulakheMethula: "213",
  GugulethuRadebe: "127",
  HerciliaDlamini: "108",
  HopeMasha: "2023",
  ItumelengMasopha: "197",
  JadeSwarts: "158",
  KarabeloCele: "1192",
  KeitumetsiMogotse: "140",
  KeitumetsiMokoena: "2026",
  KeyonneBluemeyer: "2022",
  KhaboninaMahlangu: "124",
  KhanyinkosiNkosi: "2014",
  KhensaniNtlatlapo: "125",
  KimLeeKriel: "2028",
  LebohangDhlamini: "144",
  LeratoKoza: "101",
  LeratoMpofu: "204",
  LidingaQhetsele: "1201",
  LikhonaMtwebana: "11184",
  LindokuhleNdhlovu: "209",
  LungileMadubela: "166",
  LutendoLuvhengo: "258",
  MapasekaMpofu: "161",
  MarthaSithole: "252",
  MathapeloMoloi: "179",
  MatshidisoTebele: "11185",
  MbaliTshabangu: "1193",
  MbusoThamaha: "103",
  MercellineMpofu: "205",
  MfundoMakanda: "175",
  MphoMoalosi: "130",
  MphoRathaba: "174",
  MphoTshabalala: "217",
  NkamohelengLehana: "170",
  NkosazaneChitwayo: "190",
  NokoRamahlodi: "181",
  NokuzolaButhelezi: "186",
  NokwandaMaleka: "104",
  NoluthandoLoko: "222",
  NoluthandoMtshali: "173",
  NomaguguMazeka: "208",
  NomathubaNcube: "180",
  NomfundoNgwenya: "215",
  NomgqibeloMkhonza: "199",
  NonkululekoNgubeni: "237",
  NtandoNtlabati: "114",
  NthabelengRathaba: "2025",
  NtokozoXulu: "2024",
  NtombiHlatshwayo: "133",
  NtswakiMokoena: "238",
  PrudenceNgobeni: "106",
  RefiloeMolaba: "255",
  SaneleBidi: "11180",
  SeipatiMolefe: "223",
  ShamicaPatel: "195",
  SharonMangena: "1194",
  TakalaniDavhana: "113",
  ThabisoMokhesi: "129",
  ThandiMacwele: "145",
  ThatoMokoena: "240",
  ThembiMsibi: "1202",
  ThobekaMaqungo: "1204",
  ThokozileNdhlovu: "2017",
  TholoanaMolaba: "137",
  ThulaniMavhungu: "11183",
  TshepisoMoletsane: "131",
  UnarineRamapulana: "102",
  UnityKhunou: "11182",
  YolandaMyakayaka: "2015",
  ZamamboMkize: "149",
  ZaneleHlophe: "171",
};

// Read the full Employees grid to locate rows by Full_Name.
const values = await readRange(SHEETS.employees, "A1:I");
const headers = values[0];
const nameCol = headers.indexOf(COLS.employees.fullName);

// Build name -> [row numbers] (there can be duplicates in the sheet)
const nameRows = new Map();
for (let i = 1; i < values.length; i++) {
  const row = values[i];
  const name = String(row[nameCol] ?? "").trim();
  if (!name) continue;
  if (!nameRows.has(name)) nameRows.set(name, []);
  nameRows.get(name).push(i + 1); // 1-based sheet row
}

let willUpdate = 0;
const problems = [];

const plans = [];
for (const [listName, sheetName] of MAP) {
  const id = IDS[listName.replace(/[^a-zA-Z]/g, "")];
  const rows = nameRows.get(sheetName) || [];
  if (!id) {
    problems.push(`NO ID mapped for list name "${listName}"`);
    continue;
  }
  if (!rows.length) {
    problems.push(`NO sheet row for "${sheetName}" (list: "${listName}", id ${id})`);
    continue;
  }
  const rowNumber = rows[0];
  const currentId = String(values[rowNumber - 1][0] ?? "").trim();
  const currentExt = String(values[rowNumber - 1][8] ?? "").trim();
  const rowLabel = rows.length > 1 ? ` (dup name, using row ${rowNumber})` : "";
  plans.push({
    rowNumber,
    listName,
    sheetName,
    id,
    currentId,
    currentExt,
    rowLabel,
  });
  willUpdate++;
}

console.log(`Planned updates: ${willUpdate}`);
console.log(`Problems: ${problems.length}`);
problems.forEach((p) => console.log("  " + p));

console.log("\n--- Plan (with existing values) ---");
plans.forEach((p) => {
  const idChange = p.currentId !== p.id ? `ID ${p.currentId || "EMPTY"} -> ${p.id}` : `ID ok`;
  const extChange = p.currentExt !== p.id ? `EXT ${p.currentExt || "EMPTY"} -> ${p.id}` : `EXT ok`;
  console.log(`  r${p.rowNumber} ${p.listName.padEnd(22)} "${p.sheetName}" ${p.rowLabel} [${idChange} | ${extChange}]`);
});

// Detect duplicate target IDs across the plan
const idOwners = new Map();
plans.forEach((p) => {
  if (!idOwners.has(p.id)) idOwners.set(p.id, []);
  idOwners.get(p.id).push(`${p.sheetName} (r${p.rowNumber})`);
});
console.log("\n--- IDs assigned to more than one row ---");
idOwners.forEach((owners, id) => {
  if (owners.length > 1) console.log(`  ${id}: ${owners.join(", ")}`);
});

// Apply
if (process.argv.includes("--apply")) {
  let applied = 0;
  for (const p of plans) {
    await updateRow(SHEETS.employees, p.rowNumber, { A: p.id, I: p.id });
    applied++;
    console.log(`  APPLIED r${p.rowNumber} ${p.sheetName} -> ID/EXT ${p.id}`);
    await new Promise((r) => setTimeout(r, 1100)); // stay under 60 writes/min
  }
  console.log(`\nDone. Applied ${applied} updates.`);
} else {
  console.log("\nDry run only. Re-run with --apply to write to the sheet.");
}