/**
 * Checks the prefecture table and measures the region lookup against the official
 * outlines of départements and regions (S-011, from IGN ADMIN EXPRESS). The outlines
 * are downloaded, never committed. Run by hand, never in CI:
 *
 *   node --experimental-strip-types tools/check-regions.ts
 *
 * Prints: prefectures outside their département or region (expected: none); the
 * share of 20 000 seeded random points of the mainland whose nearest prefecture is
 * in another region; the largest distance from a point to its nearest prefecture.
 */
import { areaOfPosition, CORSICA, nearestPrefectureKm, PREFECTURES } from "../src/geo/regions.ts";

const BASE = "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master";

type Ring = readonly (readonly [number, number])[];
interface Feature {
  properties: { code: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

async function outlines(file: string): Promise<Map<string, Ring[]>> {
  const response = await fetch(`${BASE}/${file}`);
  const body = (await response.json()) as { features: Feature[] };
  const map = new Map<string, Ring[]>();
  for (const f of body.features) {
    const polygons = (
      f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]
    ) as Ring[][];
    // Outer rings only: no French département or region has a hole that matters here.
    map.set(
      f.properties.code,
      polygons.map((p) => p[0] ?? []),
    );
  }
  return map;
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function regionAt(regions: Map<string, Ring[]>, lon: number, lat: number): string | undefined {
  for (const [code, rings] of regions) if (rings.some((r) => inRing(lon, lat, r))) return code;
  return undefined;
}

const departements = await outlines("departements.geojson");
const regions = await outlines("regions.geojson");

let misplaced = 0;
for (const [dept, town, region, lat, lon] of PREFECTURES) {
  const inDept = (departements.get(dept) ?? []).some((r) => inRing(lon, lat, r));
  const inRegion = (regions.get(region) ?? []).some((r) => inRing(lon, lat, r));
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
let points = 0;
let wrong = 0;
let farthest = 0;
const wrongByRegion = new Map<string, number>();
while (points < 20_000) {
  const lat = 41.3 + next() * 9.8;
  const lon = -5.2 + next() * 14.8;
  const truth = regionAt(regions, lon, lat);
  if (truth === undefined || truth === CORSICA) continue;
  points++;
  const best = nearestPrefectureKm(lat, lon);
  farthest = Math.max(farthest, best);
  const found = areaOfPosition(lat, lon).area;
  if (found !== truth) {
    wrong++;
    wrongByRegion.set(truth, (wrongByRegion.get(truth) ?? 0) + 1);
  }
}
console.log(
  `mainland points in the wrong region: ${String(wrong)} of ${String(points)} (${((100 * wrong) / points).toFixed(1)} %)`,
);
console.log(`  by true region: ${JSON.stringify(Object.fromEntries([...wrongByRegion].sort()))}`);
console.log(`farthest point from any prefecture: ${farthest.toFixed(0)} km`);
