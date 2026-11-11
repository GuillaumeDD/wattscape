/**
 * Checks the prefecture table and measures the region lookup against the official
 * outlines of départements and regions at full precision (IGN ADMIN EXPRESS COG,
 * DS-04, S-013), not the generalised COG CARTO outlines the map is baked from. The
 * outlines are downloaded, never committed. Run by hand, never in CI:
 *
 *   NODE_USE_ENV_PROXY=1 node --experimental-strip-types tools/check-regions.ts
 *
 * Prints: prefectures outside their département or region (expected: none); the
 * share of 20 000 seeded random points of the mainland that the lookup puts in
 * another region, and how far the worst of them is from the true border.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { areaOfPosition, CORSICA, PREFECTURES } from "../src/geo/regions.ts";
import { KM_PER_DEGREE } from "../src/map/grid.ts";

const WFS =
  "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature" +
  "&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326&TYPENAMES=ADMINEXPRESS-COG.LATEST:";

type Ring = readonly (readonly [number, number])[];
interface Feature {
  properties: { code_insee: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

/** Downloads an outline layer once, then reads the cached copy (never committed). */
async function download(layer: string): Promise<string> {
  // One cache per day: the layers are "LATEST" and change with IGN's editions.
  const dir = join(tmpdir(), `wattscape-check-regions-${new Date().toISOString().slice(0, 10)}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${layer}.json`);
  if (existsSync(path)) return readFileSync(path, "utf8");
  const response = await fetch(`${WFS}${layer}`);
  if (!response.ok) throw new Error(`HTTP ${String(response.status)} for ${layer}`);
  const text = await response.text();
  writeFileSync(path, text);
  return text;
}

/** Height of the latitude bands the edges are filed under, in degrees. */
const BAND = 0.01;

/**
 * An outline's edges filed by latitude band, so that a point-in-polygon test reads
 * only the few edges that can cross its parallel (the full-precision outlines have
 * millions of vertices).
 */
type Outline = Map<number, [number, number, number, number][]>;

function index(rings: Ring[]): Outline {
  const bands: Outline = new Map();
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j] ?? [0, 0];
      const [x2, y2] = ring[i] ?? [0, 0];
      if (y1 === y2) continue;
      const first = Math.floor(Math.min(y1, y2) / BAND);
      const last = Math.floor(Math.max(y1, y2) / BAND);
      for (let b = first; b <= last; b++) {
        const list = bands.get(b) ?? [];
        list.push([x1, y1, x2, y2]);
        bands.set(b, list);
      }
    }
  }
  return bands;
}

async function outlines(layer: string): Promise<Map<string, { rings: Ring[]; edges: Outline }>> {
  const body = JSON.parse(await download(layer)) as { features: Feature[] };
  const map = new Map<string, { rings: Ring[]; edges: Outline }>();
  for (const f of body.features) {
    const polygons = (
      f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]
    ) as Ring[][];
    // Every ring, holes included: the even-odd rule below handles them.
    const rings = polygons.flat();
    map.set(f.properties.code_insee, { rings, edges: index(rings) });
  }
  return map;
}

/** Even-odd point-in-polygon over the edges of the point's band. */
function inside(outline: { edges: Outline } | undefined, lon: number, lat: number): boolean {
  let odd = false;
  for (const [x1, y1, x2, y2] of outline?.edges.get(Math.floor(lat / BAND)) ?? []) {
    if (y1 > lat !== y2 > lat && lon < x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1)) odd = !odd;
  }
  return odd;
}

function regionAt(
  regions: Map<string, { edges: Outline }>,
  lon: number,
  lat: number,
): string | undefined {
  for (const [code, outline] of regions) if (inside(outline, lon, lat)) return code;
  return undefined;
}

const departements = await outlines("departement");
const regions = await outlines("region");

let misplaced = 0;
for (const [dept, town, region, lat, lon] of PREFECTURES) {
  const inDept = inside(departements.get(dept), lon, lat);
  const inRegion = inside(regions.get(region), lon, lat);
  if (!inDept || !inRegion) {
    misplaced++;
    console.log(
      `  ${dept} ${town}: in département ${String(inDept)}, in region ${String(inRegion)}`,
    );
  }
}
console.log(
  `prefectures outside their département or region: ${String(misplaced)} of ${String(PREFECTURES.length)}`,
);

// Seeded mulberry32, so the measure is reproducible.
let seed = 1;
const next = (): number => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** Distance in km from a point to the nearest edge of its true region's outline. */
function kmToBorder(rings: Ring[], lon: number, lat: number): number {
  // Local tangent plane at the point: exact enough over a few km.
  const kmPerDegreeLon = KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180);
  let best = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j] ?? [0, 0];
      const [x2, y2] = ring[i] ?? [0, 0];
      const ax = (x1 - lon) * kmPerDegreeLon;
      const ay = (y1 - lat) * KM_PER_DEGREE;
      const bx = (x2 - lon) * kmPerDegreeLon;
      const by = (y2 - lat) * KM_PER_DEGREE;
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

let points = 0;
let wrong = 0;
let worstKm = 0;
const wrongByRegion = new Map<string, number>();
while (points < 20_000) {
  const lat = 41.3 + next() * 9.8;
  const lon = -5.2 + next() * 14.8;
  const truth = regionAt(regions, lon, lat);
  if (truth === undefined || truth === CORSICA) continue;
  points++;
  const found = areaOfPosition(lat, lon).area;
  if (found !== truth) {
    wrong++;
    wrongByRegion.set(truth, (wrongByRegion.get(truth) ?? 0) + 1);
    worstKm = Math.max(worstKm, kmToBorder(regions.get(truth)?.rings ?? [], lon, lat));
  }
}
console.log(
  `mainland points in the wrong region: ${String(wrong)} of ${String(points)} (${((100 * wrong) / points).toFixed(2)} %)`,
);
console.log(`  by true region: ${JSON.stringify(Object.fromEntries([...wrongByRegion].sort()))}`);
console.log(`  farthest of them from their region's outline: ${worstKm.toFixed(2)} km`);
