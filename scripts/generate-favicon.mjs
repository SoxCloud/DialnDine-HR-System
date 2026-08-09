import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "app", "icon.svg");

const svg = await readFile(svgPath);

const png16 = await sharp(svg).resize(16, 16).png().toBuffer();
const png32 = await sharp(svg).resize(32, 32).png().toBuffer();

await writeFile(path.join(root, "app", "icon.png"), png32);
await writeFile(path.join(root, "app", "icon1.png"), png16);

function toIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + entrySize * images.length;
  const entries = [];
  const blobs = [];
  for (const { size, data } of images) {
    entries.push(
      Buffer.from([
        size === 256 ? 0 : size,
        size === 256 ? 0 : size,
        0,
        0,
        1,
        0,
        32,
        0,
      ]),
    );
    const len = Buffer.alloc(4);
    len.writeUInt32LE(data.length, 0);
    const off = Buffer.alloc(4);
    off.writeUInt32LE(offset, 0);
    offset += data.length;
    blobs.push(data);
    entries.push(Buffer.concat([len, off]));
  }
  const header = Buffer.from([0, 0, 1, 0, images.length, 0]);
  return Buffer.concat([header, ...entries, ...blobs]);
}

const ico = toIco([
  { size: 32, data: png32 },
  { size: 16, data: png16 },
]);
await writeFile(path.join(root, "app", "favicon.ico"), ico);

console.log("Wrote app/icon.svg → app/icon.png (32), app/icon1.png (16), app/favicon.ico (16+32)");
