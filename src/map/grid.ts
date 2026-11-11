/**
 * The grid of the baked map of France (ARCHITECTURE § Map): its projection, its two
 * resolutions, and the decoding of the committed file `france.ts`. Pure: no DOM, no
 * network, no clock. Only + and × turn a position into a cell, so every JS engine
 * picks the same cell (AGENTS.md § Determinism).
 */
import { REGION_CODES, type RegionCode } from "../data/eco2mix.ts";

/** Kilometres per degree of latitude (a sphere of radius 6 371 km: 111.19 km). */
export const KM_PER_DEGREE = 111.2;

/** Latitude where the projection keeps true scale: the middle of mainland France. */
export const PROJECTION_LATITUDE = 46.5;

/**
 * cos(latitude) by its Taylor series to x⁸: only + and ×, so every JS engine gives
 * the same bits (Math.cos may differ by 1 ulp, and here the result picks a cell).
 * Error below 2·10⁻⁶ up to 60° of latitude.
 */
export function cosDeg(degrees: number): number {
  const x = (degrees * 3.141592653589793) / 180;
  const x2 = x * x;
  return 1 - (x2 / 2) * (1 - (x2 / 12) * (1 - (x2 / 30) * (1 - x2 / 56)));
}

/** Kilometres per degree of longitude in the projection. */
export const KM_PER_DEGREE_LON = KM_PER_DEGREE * cosDeg(PROJECTION_LATITUDE);

/** North and west edges of the grid (degrees). */
export const NORTH = 51.2;
export const WEST = -5.4;

/** The fine grid: 1 km cells, for the region lookup. */
export const FINE_KM = 1;
export const FINE_COLUMNS = 1152;
export const FINE_ROWS = 1104;

/** The coarse grid: 4 km cells (4 × 4 fine cells), for the scene. */
export const COARSE_FACTOR = 4;
export const COARSE_KM = FINE_KM * COARSE_FACTOR;
export const COARSE_COLUMNS = FINE_COLUMNS / COARSE_FACTOR;
export const COARSE_ROWS = FINE_ROWS / COARSE_FACTOR;

/** South and east edges of the grid (degrees), derived from the sizes above. */
export const SOUTH = NORTH - (FINE_ROWS * FINE_KM) / KM_PER_DEGREE;
export const EAST = WEST + (FINE_COLUMNS * FINE_KM) / KM_PER_DEGREE_LON;

/**
 * What a cell holds. Index 0 is "not France" in the fine grid, and sea in the coarse
 * grid; 1 is foreign land (coarse grid only); then the 12 regions of the éCO2mix data
 * and Corsica, by INSEE code.
 */
export const CORSICA = "94" as const;
export type CellRegion = RegionCode | typeof CORSICA;
export const SEA = 0;
export const FOREIGN = 1;
export const KIND_REGIONS: readonly CellRegion[] = [...REGION_CODES, CORSICA];
/** Number of kinds: sea, foreign land, and one per region. */
export const KIND_COUNT = 2 + KIND_REGIONS.length;

/** The kind index of a region (2 and up). */
export function kindOfRegion(region: CellRegion): number {
  return 2 + KIND_REGIONS.indexOf(region);
}

/** The region of a kind index, or null for sea, foreign land or an unknown index. */
export function regionOfKind(kind: number): CellRegion | null {
  return kind >= 2 ? (KIND_REGIONS[kind - 2] ?? null) : null;
}

/**
 * Lower bound, in metres, of each elevation class (0 to 15) of the coarse grid: the
 * mean altitude of the cell. Steps are finer low down, where most of France is.
 */
export const ELEVATION_CLASSES: readonly number[] = [
  0, 50, 100, 200, 300, 400, 600, 800, 1000, 1300, 1600, 2000, 2400, 2800, 3200, 3600,
];

/** The class of a mean altitude in metres; 0 below 50 m (and at sea). */
export function elevationClass(metres: number): number {
  let cls = 0;
  for (let i = 1; i < ELEVATION_CLASSES.length; i++) {
    if (metres >= (ELEVATION_CLASSES[i] ?? Number.POSITIVE_INFINITY)) cls = i;
  }
  return cls;
}

/**
 * Row and column of the fine cell holding a position, even off the grid (negative or
 * past the last row or column); null for a non-number.
 */
export function fineIndexOf(
  latitude: number,
  longitude: number,
): { row: number; column: number } | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    row: Math.floor(((NORTH - latitude) * KM_PER_DEGREE) / FINE_KM),
    column: Math.floor(((longitude - WEST) * KM_PER_DEGREE_LON) / FINE_KM),
  };
}

/** Whether a row and column fall on the fine grid. */
export function onFineGrid(row: number, column: number): boolean {
  return row >= 0 && row < FINE_ROWS && column >= 0 && column < FINE_COLUMNS;
}

/** Latitude and longitude of the centre of a cell of `km` kilometres. */
export function cellCentre(
  row: number,
  column: number,
  km: number,
): { latitude: number; longitude: number } {
  return {
    latitude: NORTH - ((row + 0.5) * km) / KM_PER_DEGREE,
    longitude: WEST + ((column + 0.5) * km) / KM_PER_DEGREE_LON,
  };
}

/** One character per kind in the run-length encoded rows: `a` is kind 0. */
const KIND_CHAR_BASE = "a".charCodeAt(0);

/** Run-length encodes one row of kinds: `a12c40` is 12 cells of kind 0, 40 of kind 2. */
export function encodeRuns(row: ArrayLike<number>): string {
  let out = "";
  let i = 0;
  while (i < row.length) {
    const kind = row[i] ?? 0;
    let j = i + 1;
    while (j < row.length && row[j] === kind) j++;
    out += String.fromCharCode(KIND_CHAR_BASE + kind) + String(j - i);
    i = j;
  }
  return out;
}

/**
 * Decodes run-length encoded rows into one byte per cell, row after row. Throws on a
 * malformed row: the file is ours and committed, so this is a build error, caught by
 * the tests, never a runtime state.
 */
export function decodeRuns(rows: readonly string[], columns: number): Uint8Array {
  const out = new Uint8Array(rows.length * columns);
  rows.forEach((text, r) => {
    let column = 0;
    for (const match of text.matchAll(/([a-z])(\d+)|(.)/g)) {
      if (match[3] !== undefined) throw new Error(`map row ${r}: bad character`);
      const kind = (match[1] ?? "a").charCodeAt(0) - KIND_CHAR_BASE;
      const length = Number(match[2]);
      if (kind >= KIND_COUNT) throw new Error(`map row ${r}: unknown kind`);
      out.fill(kind, r * columns + column, r * columns + column + length);
      column += length;
    }
    if (column !== columns) throw new Error(`map row ${r}: ${column} cells, not ${columns}`);
  });
  return out;
}

/** Decodes rows of one hexadecimal digit per cell (the elevation classes). */
export function decodeHex(rows: readonly string[], columns: number): Uint8Array {
  const out = new Uint8Array(rows.length * columns);
  rows.forEach((text, r) => {
    if (!/^[0-9a-f]*$/.test(text) || text.length !== columns)
      throw new Error(`elevation row ${r}: malformed`);
    for (let c = 0; c < columns; c++) out[r * columns + c] = parseInt(text.charAt(c), 16);
  });
  return out;
}
