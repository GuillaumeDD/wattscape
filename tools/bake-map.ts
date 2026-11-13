/**
 * Bakes the map of France (B-008, ARCHITECTURE § Map) into `src/map/france.ts`. Run
 * by hand, never in CI, then commit the file:
 *
 *   node --experimental-strip-types tools/bake-map.ts
 *
 * Reads three GO sources of `docs/SOURCES.md` § 1 (downloads are cached in the
 * system's temporary folder, never committed):
 *
 * - DS-04, IGN ADMIN EXPRESS COG CARTO, regions, from IGN's WFS (S-013);
 * - DS-05, IGN BD ALTI, from IGN's WMS as raw 32-bit altitudes (S-014);
 * - DS-11, Natural Earth admin-0 countries, for the land of the neighbours (S-015).
 *
 * Writes, on the grid of `src/map/grid.ts`:
 *
 * - the fine grid (1 km): the region at the centre of each cell, foreign land, or sea;
 * - the coarse grid (4 km): sea, foreign land or the region holding most of the
 *   cell's land, by majority of its 16 fine cells;
 * - the coarse elevation class: the mean of the cell's 64 altitudes sampled every
 *   500 m (BD ALTI covers France only: foreign land is class 0);
 * - the fine elevation class (`src/map/relief.ts`, loaded only when the camera comes
 *   close, D-018): the mean of the 4 samples of each 1 km cell of France.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  COARSE_COLUMNS,
  COARSE_FACTOR,
  COARSE_ROWS,
  EAST,
  elevationClass,
  encodeRuns,
  FINE_COLUMNS,
  FINE_KM,
  FINE_ROWS,
  FOREIGN,
  KIND_COUNT,
  KIND_REGIONS,
  kindOfRegion,
  KM_PER_DEGREE,
  KM_PER_DEGREE_LON,
  NORTH,
  SEA,
  SOUTH,
  WEST,
} from "../src/map/grid.ts";

const OUT = "src/map/france.ts";
const RELIEF_OUT = "src/map/relief.ts";
/** One cache per day: the regions layer is "LATEST" and changes with IGN's editions. */
const BAKED_ON = new Date().toISOString().slice(0, 10);
const CACHE = join(tmpdir(), `wattscape-bake-map-${BAKED_ON}`);

export const REGIONS_URL =
  "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature" +
  "&TYPENAMES=ADMINEXPRESS-COG-CARTO.LATEST:region&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326";
/** Pinned to a commit, so that a re-bake reads the same countries. */
const NATURAL_EARTH_COMMIT = "ca96624a56bd078437bca8184e78163e5039ad19";
const COUNTRIES_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_COMMIT}/geojson/ne_10m_admin_0_countries.geojson`;
const WMS = "https://data.geopf.fr/wms-r/wms";
/** BD ALTI's "no data" value, sent at sea and abroad. */
const NO_DATA_BELOW = -1000;
/** Altitude samples per coarse cell side: 8, one every 500 m. */
const SAMPLES = 8;

type Ring = readonly (readonly [number, number])[];
interface Shape {
  readonly kind: number;
  readonly rings: readonly Ring[];
}

/** Downloads once (with retries), then reads the cached copy. */
async function cached(name: string, url: string): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, name);
  if (existsSync(path)) return readFileSync(path);
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const body = Buffer.from(await response.arrayBuffer());
      writeFileSync(path, body);
      return body;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

/** Every ring (outer and holes) of a Polygon or MultiPolygon. */
function ringsOf(feature: Feature): Ring[] {
  const g = feature.geometry;
  if (g === null) return [];
  if (g.type === "Polygon") return g.coordinates as Ring[];
  if (g.type === "MultiPolygon") return (g.coordinates as Ring[][]).flat();
  throw new Error(`unexpected geometry ${g.type}`);
}

/**
 * Fills the cells of a `rows` × `columns` grid of `km` cells whose centre lies inside
 * a shape (even-odd rule over all its rings, so holes stay empty), by scanlines.
 */
function rasterize(
  shapes: readonly Shape[],
  rows: number,
  columns: number,
  km: number,
): Uint8Array {
  const grid = new Uint8Array(rows * columns);
  for (const shape of shapes) {
    // Bucket the edges by the rows whose centre line they may cross.
    const buckets = new Map<number, [number, number, number, number][]>();
    for (const ring of shape.rings) {
      for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i] ?? [0, 0];
        const [x2, y2] = ring[(i + 1) % ring.length] ?? [0, 0];
        if (y1 === y2) continue;
        const top = Math.max(y1, y2);
        const bottom = Math.min(y1, y2);
        const first = Math.max(0, Math.floor(((NORTH - top) * KM_PER_DEGREE) / km - 0.5));
        const last = Math.min(rows - 1, Math.ceil(((NORTH - bottom) * KM_PER_DEGREE) / km - 0.5));
        for (let r = first; r <= last; r++) {
          const list = buckets.get(r) ?? [];
          list.push([x1, y1, x2, y2]);
          buckets.set(r, list);
        }
      }
    }
    for (const [r, edges] of buckets) {
      const y = NORTH - ((r + 0.5) * km) / KM_PER_DEGREE;
      const xs: number[] = [];
      for (const [x1, y1, x2, y2] of edges) {
        if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const from = Math.max(0, Math.ceil((((xs[i] ?? 0) - WEST) * KM_PER_DEGREE_LON) / km - 0.5));
        const to = Math.min(
          columns - 1,
          Math.ceil((((xs[i + 1] ?? 0) - WEST) * KM_PER_DEGREE_LON) / km - 0.5) - 1,
        );
        if (to >= from) grid.fill(shape.kind, r * columns + from, r * columns + to + 1);
      }
    }
  }
  return grid;
}

// 1. Regions (DS-04).
const regionsJson = JSON.parse((await cached("regions.json", REGIONS_URL)).toString("utf8")) as {
  timeStamp?: string;
  features: Feature[];
};
const regionShapes: Shape[] = [];
for (const feature of regionsJson.features) {
  const code = feature.properties.code_insee;
  const region = KIND_REGIONS.find((r) => r === code);
  if (region === undefined) continue; // overseas regions, off the grid
  regionShapes.push({ kind: kindOfRegion(region), rings: ringsOf(feature) });
}
if (regionShapes.length !== KIND_REGIONS.length)
  throw new Error(`expected ${KIND_REGIONS.length} regions, got ${regionShapes.length}`);
for (const shape of regionShapes) {
  for (const ring of shape.rings) {
    for (const [lon, lat] of ring) {
      if (lat <= SOUTH || lat >= NORTH || lon <= WEST || lon >= EAST)
        throw new Error(`region outline at ${lat}, ${lon} is off the grid`);
    }
  }
}
const fine = rasterize(regionShapes, FINE_ROWS, FINE_COLUMNS, FINE_KM);

// 2. Neighbouring countries (DS-11), on the fine grid too.
const countries = JSON.parse((await cached("countries.json", COUNTRIES_URL)).toString("utf8")) as {
  features: Feature[];
};
const foreignShapes: Shape[] = countries.features
  .filter((f) => f.properties.ADM0_A3 !== "FRA")
  .map((f) => ({
    kind: FOREIGN,
    rings: ringsOf(f).filter((ring) =>
      ring.some(
        ([lon, lat]) => lat > SOUTH - 1 && lat < NORTH + 1 && lon > WEST - 1 && lon < EAST + 1,
      ),
    ),
  }))
  .filter((s) => s.rings.length > 0);
const foreign = rasterize(foreignShapes, FINE_ROWS, FINE_COLUMNS, FINE_KM);

// 3. Coarse kinds: land if most fine cells are land; then the region with most of
// them, unless foreign land outweighs France. Ties go to the lowest kind.
const coarse = new Uint8Array(COARSE_ROWS * COARSE_COLUMNS);
for (let r = 0; r < COARSE_ROWS; r++) {
  for (let c = 0; c < COARSE_COLUMNS; c++) {
    const counts = new Array<number>(KIND_COUNT).fill(0);
    for (let dr = 0; dr < COARSE_FACTOR; dr++) {
      for (let dc = 0; dc < COARSE_FACTOR; dc++) {
        const i = (r * COARSE_FACTOR + dr) * FINE_COLUMNS + c * COARSE_FACTOR + dc;
        const kind = fine[i] ?? 0;
        if (kind !== 0) counts[kind] = (counts[kind] ?? 0) + 1;
        else if (foreign[i] === FOREIGN) counts[FOREIGN] = (counts[FOREIGN] ?? 0) + 1;
      }
    }
    const french = counts.slice(2).reduce((a, b) => a + b, 0);
    const land = french + (counts[FOREIGN] ?? 0);
    let kind = SEA;
    if (2 * land >= COARSE_FACTOR * COARSE_FACTOR) {
      if (french >= (counts[FOREIGN] ?? 0)) {
        let best = 2;
        for (let k = 3; k < KIND_COUNT; k++) if ((counts[k] ?? 0) > (counts[best] ?? 0)) best = k;
        kind = best;
      } else kind = FOREIGN;
    }
    coarse[r * COARSE_COLUMNS + c] = kind;
  }
}

// The fine grid keeps foreign land too, now that the coarse kinds are counted: the
// region lookup reads only the regions, the close view draws land and sea.
for (let i = 0; i < fine.length; i++)
  if (fine[i] === 0 && foreign[i] === FOREIGN) fine[i] = FOREIGN;

// 4. Elevation (DS-05): 2 × 2 WMS requests of raw float32 altitudes, sampled at the
// centres of a 500 m grid aligned on the coarse cells.
const sampleColumns = COARSE_COLUMNS * SAMPLES;
const sampleRows = COARSE_ROWS * SAMPLES;
const altitude = new Float32Array(sampleRows * sampleColumns);
const halfRows = sampleRows / 2;
const halfColumns = sampleColumns / 2;
const sampleKm = (FINE_KM * COARSE_FACTOR) / SAMPLES;
const elevationUrls: string[] = [];
for (let br = 0; br < 2; br++) {
  for (let bc = 0; bc < 2; bc++) {
    const north = NORTH - (br * halfRows * sampleKm) / KM_PER_DEGREE;
    const south = NORTH - ((br + 1) * halfRows * sampleKm) / KM_PER_DEGREE;
    const west = WEST + (bc * halfColumns * sampleKm) / KM_PER_DEGREE_LON;
    const east = WEST + ((bc + 1) * halfColumns * sampleKm) / KM_PER_DEGREE_LON;
    const url =
      `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE` +
      `&STYLES=&CRS=EPSG:4326&BBOX=${south},${west},${north},${east}` +
      `&WIDTH=${halfColumns}&HEIGHT=${halfRows}&FORMAT=image/x-bil;bits=32`;
    elevationUrls.push(url);
    const body = await cached(`altitude-${br}-${bc}.bil`, url);
    if (body.length !== halfRows * halfColumns * 4)
      throw new Error(`altitude block ${br},${bc}: ${body.length} bytes`);
    for (let y = 0; y < halfRows; y++) {
      for (let x = 0; x < halfColumns; x++) {
        altitude[(br * halfRows + y) * sampleColumns + bc * halfColumns + x] = body.readFloatLE(
          (y * halfColumns + x) * 4,
        );
      }
    }
  }
}
const elevation = new Uint8Array(COARSE_ROWS * COARSE_COLUMNS);
let highest = 0;
for (let r = 0; r < COARSE_ROWS; r++) {
  for (let c = 0; c < COARSE_COLUMNS; c++) {
    if ((coarse[r * COARSE_COLUMNS + c] ?? SEA) < 2) continue; // sea and foreign land: 0
    let sum = 0;
    let n = 0;
    for (let y = 0; y < SAMPLES; y++) {
      for (let x = 0; x < SAMPLES; x++) {
        const v = altitude[(r * SAMPLES + y) * sampleColumns + c * SAMPLES + x] ?? 0;
        if (v > NO_DATA_BELOW) {
          sum += v;
          n++;
        }
      }
    }
    const mean = n > 0 ? sum / n : 0;
    highest = Math.max(highest, mean);
    elevation[r * COARSE_COLUMNS + c] = elevationClass(mean);
  }
}

// The 1 km relief: the mean of the 2 × 2 samples of each French fine cell.
const fineElevation = new Uint8Array(FINE_ROWS * FINE_COLUMNS);
const perFine = SAMPLES / COARSE_FACTOR;
for (let r = 0; r < FINE_ROWS; r++) {
  for (let c = 0; c < FINE_COLUMNS; c++) {
    if ((fine[r * FINE_COLUMNS + c] ?? SEA) < 2) continue; // sea and foreign land: 0
    let sum = 0;
    let n = 0;
    for (let y = 0; y < perFine; y++) {
      for (let x = 0; x < perFine; x++) {
        const v = altitude[(r * perFine + y) * sampleColumns + c * perFine + x] ?? 0;
        if (v > NO_DATA_BELOW) {
          sum += v;
          n++;
        }
      }
    }
    fineElevation[r * FINE_COLUMNS + c] = elevationClass(n > 0 ? sum / n : 0);
  }
}

// 5. Write the files.
const rowsOf = (grid: Uint8Array, rows: number, columns: number): string[] =>
  Array.from({ length: rows }, (_, r) => encodeRuns(grid.subarray(r * columns, (r + 1) * columns)));
const hexRows = Array.from({ length: COARSE_ROWS }, (_, r) =>
  Array.from(elevation.subarray(r * COARSE_COLUMNS, (r + 1) * COARSE_COLUMNS), (v) =>
    v.toString(16),
  ).join(""),
);
const list = (rows: string[]): string => rows.map((row) => `  ${JSON.stringify(row)},`).join("\n");
writeFileSync(
  OUT,
  `/**
 * The baked map of France. GENERATED by tools/bake-map.ts on ${BAKED_ON}: do not edit,
 * re-bake. Grid and encoding: src/map/grid.ts; sources and licences: ASSETS.md.
 *
 * - Regions: IGN ADMIN EXPRESS COG CARTO (DS-04, S-013), Licence Ouverte 2.0,
 *   WFS answer stamped ${regionsJson.timeStamp ?? "?"}.
 * - Relief: IGN BD ALTI (DS-05, S-014), Licence Ouverte 2.0.
 * - Neighbouring land: Natural Earth admin-0 countries 1:10m (DS-11, S-015), public
 *   domain, commit ${NATURAL_EARTH_COMMIT.slice(0, 12)}.
 */

/** Day of the bake: the date of the map data, shown in the credits. */
export const MAP_BAKED_ON = "${BAKED_ON}";

/** Fine grid (1 km), one run-length encoded row per line: the region of each cell. */
export const FINE_ROWS_RLE: readonly string[] = [
${list(rowsOf(fine, FINE_ROWS, FINE_COLUMNS))}
];

/** Coarse grid (4 km): sea, foreign land or region, run-length encoded. */
export const COARSE_ROWS_RLE: readonly string[] = [
${list(rowsOf(coarse, COARSE_ROWS, COARSE_COLUMNS))}
];

/** Coarse grid (4 km): elevation class of each cell, one hexadecimal digit. */
export const ELEVATION_ROWS_HEX: readonly string[] = [
${list(hexRows)}
];
`,
);
writeFileSync(
  RELIEF_OUT,
  `/**
 * The 1 km relief of France (D-018). GENERATED by tools/bake-map.ts on ${BAKED_ON}: do
 * not edit, re-bake. Loaded only when the camera comes close (ARCHITECTURE § Map).
 *
 * - Relief: IGN BD ALTI (DS-05, S-014), Licence Ouverte 2.0.
 */

/** Fine grid (1 km): elevation class of each cell, run-length encoded (\`a\` = class 0). */
export const FINE_ELEVATION_RLE: readonly string[] = [
${list(rowsOf(fineElevation, FINE_ROWS, FINE_COLUMNS))}
];
`,
);
execFileSync("npx", ["prettier", "--write", OUT, RELIEF_OUT], { stdio: "inherit" });

const count = (grid: Uint8Array, kind: number): number =>
  grid.reduce((n, v) => n + (v === kind ? 1 : 0), 0);
console.log(`regions WFS stamp: ${regionsJson.timeStamp ?? "?"}`);
console.log(`elevation requests:\n  ${elevationUrls.join("\n  ")}`);
for (const region of KIND_REGIONS) {
  const kind = kindOfRegion(region);
  console.log(`  ${region}: ${count(fine, kind)} km² fine, ${count(coarse, kind)} coarse cells`);
}
console.log(`foreign coarse cells: ${count(coarse, FOREIGN)}; sea: ${count(coarse, SEA)}`);
console.log(`highest mean cell altitude: ${highest.toFixed(0)} m`);
