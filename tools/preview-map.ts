/**
 * Draws the baked map (src/map/france.ts) as a flat PNG, to eyeball a bake (B-008).
 * Run by hand:
 *
 *   node --experimental-strip-types tools/preview-map.ts [out.png] [fine]
 *
 * Coarse grid by default (one pixel per 4 km cell, scaled ×3): each region in its own
 * hue, darker with altitude; foreign land grey; sea blue. With `fine`, the 1 km region
 * grid instead. These colours are for checking only, not the art palette (B-009).
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { COARSE_ROWS_RLE, ELEVATION_ROWS_HEX, FINE_ROWS_RLE } from "../src/map/france.ts";
import {
  COARSE_COLUMNS,
  decodeHex,
  decodeRuns,
  FINE_COLUMNS,
  FOREIGN,
  SEA,
} from "../src/map/grid.ts";

const out = process.argv[2] ?? "map-preview.png";
const useFine = process.argv[3] === "fine";
const columns = useFine ? FINE_COLUMNS : COARSE_COLUMNS;
const kinds = decodeRuns(useFine ? FINE_ROWS_RLE : COARSE_ROWS_RLE, columns);
const elevation = useFine ? null : decodeHex(ELEVATION_ROWS_HEX, COARSE_COLUMNS);
const rows = kinds.length / columns;
const scale = useFine ? 1 : 3;

const REGION_RGB: readonly (readonly [number, number, number])[] = [
  [214, 196, 120],
  [170, 200, 120],
  [200, 160, 110],
  [140, 190, 150],
  [210, 180, 160],
  [180, 170, 210],
  [150, 200, 200],
  [200, 210, 150],
  [220, 170, 130],
  [230, 200, 150],
  [160, 180, 130],
  [210, 150, 150],
  [190, 190, 190],
];

function rgb(kind: number, cls: number): readonly [number, number, number] {
  if (kind === SEA) return useFine ? [255, 255, 255] : [60, 90, 140];
  if (kind === FOREIGN) return [150, 150, 140];
  const base = REGION_RGB[kind - 2] ?? [0, 0, 0];
  const shade = 1 - cls * 0.045;
  return [base[0] * shade, base[1] * shade, base[2] * shade];
}

const width = columns * scale;
const height = rows * scale;
const raw = Buffer.alloc((width * 3 + 1) * height);
for (let y = 0; y < height; y++) {
  raw[y * (width * 3 + 1)] = 0;
  for (let x = 0; x < width; x++) {
    const i = Math.floor(y / scale) * columns + Math.floor(x / scale);
    const [r, g, b] = rgb(kinds[i] ?? 0, elevation?.[i] ?? 0);
    const o = y * (width * 3 + 1) + 1 + x * 3;
    raw[o] = r;
    raw[o + 1] = g;
    raw[o + 2] = b;
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, sum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8; // bit depth
header[9] = 2; // RGB
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
console.log(`${out}: ${width} × ${height}`);
