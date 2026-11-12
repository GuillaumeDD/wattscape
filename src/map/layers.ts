/**
 * The baked map as terrain layers the scene draws (ARCHITECTURE § Map): the 4 km
 * layer, always there, and the 1 km layer of D-018, built once its relief has been
 * loaded. Pure: decoding and a breadth-first search, nothing else.
 */
import { COARSE_ROWS_RLE, ELEVATION_ROWS_HEX, FINE_ROWS_RLE } from "./france.ts";
import {
  COARSE_COLUMNS,
  COARSE_KM,
  COARSE_ROWS,
  decodeHex,
  decodeRuns,
  ELEVATION_CLASSES,
  FINE_COLUMNS,
  FINE_KM,
  FINE_ROWS,
  SEA,
} from "./grid.ts";

/** One resolution of the map: what each cell holds, its relief, and the sea's depth. */
export interface TerrainLayer {
  /** Cell size in kilometres: 4 or 1. */
  readonly km: number;
  readonly columns: number;
  readonly rows: number;
  /** Sea, foreign land or region of each cell (`src/map/grid.ts`). */
  readonly kinds: Uint8Array;
  /** Elevation class (0–15) of each cell; 0 at sea and abroad. */
  readonly elevation: Uint8Array;
  /** For a sea cell, its distance to the nearest land in cells (4-neighbours, capped at 255). */
  readonly seaDistance: Uint8Array;
}

/** Breadth-first distance from land over the sea, in cells, capped at 255. */
export function seaDistances(kinds: Uint8Array, columns: number, rows: number): Uint8Array {
  const distance = new Uint8Array(kinds.length).fill(255);
  // A fixed-size queue: every cell enters it at most once.
  const queue = new Int32Array(kinds.length);
  let head = 0;
  let tail = 0;
  const visit = (j: number, d: number): void => {
    if ((distance[j] ?? 0) > d) {
      distance[j] = d;
      queue[tail++] = j;
    }
  };
  for (let i = 0; i < kinds.length; i++)
    if (kinds[i] !== SEA) {
      distance[i] = 0;
      queue[tail++] = i;
    }
  while (head < tail) {
    const i = queue[head++] ?? 0;
    const d = (distance[i] ?? 0) + 1;
    if (d >= 255) continue;
    const r = Math.floor(i / columns);
    const c = i - r * columns;
    if (r > 0) visit(i - columns, d);
    if (r < rows - 1) visit(i + columns, d);
    if (c > 0) visit(i - 1, d);
    if (c < columns - 1) visit(i + 1, d);
  }
  return distance;
}

let coarse: TerrainLayer | null = null;

/** The 4 km layer, decoded once (about 240 KB, never grows). */
export function coarseLayer(): TerrainLayer {
  if (coarse !== null) return coarse;
  const kinds = decodeRuns(COARSE_ROWS_RLE, COARSE_COLUMNS);
  coarse = {
    km: COARSE_KM,
    columns: COARSE_COLUMNS,
    rows: COARSE_ROWS,
    kinds,
    elevation: decodeHex(ELEVATION_ROWS_HEX, COARSE_COLUMNS),
    seaDistance: seaDistances(kinds, COARSE_COLUMNS, COARSE_ROWS),
  };
  return coarse;
}

let fine: { readonly rows: readonly string[]; readonly layer: TerrainLayer } | null = null;

/**
 * The 1 km layer, from the relief rows of `src/map/relief.ts` (passed in, so that the
 * browser loads that file only when the camera comes close). Decoded once for the
 * same rows (about 3.8 MB, never grows); throws on malformed rows, like the 4 km one.
 */
export function fineLayer(reliefRows: readonly string[]): TerrainLayer {
  if (fine?.rows === reliefRows) return fine.layer;
  if (reliefRows.length !== FINE_ROWS) throw new Error(`relief: ${reliefRows.length} rows`);
  const kinds = decodeRuns(FINE_ROWS_RLE, FINE_COLUMNS);
  const layer: TerrainLayer = {
    km: FINE_KM,
    columns: FINE_COLUMNS,
    rows: FINE_ROWS,
    kinds,
    elevation: decodeRuns(reliefRows, FINE_COLUMNS, ELEVATION_CLASSES.length),
    seaDistance: seaDistances(kinds, FINE_COLUMNS, FINE_ROWS),
  };
  fine = { rows: reliefRows, layer };
  return layer;
}
