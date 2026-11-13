/**
 * Bakes the rivers the scene draws (B-023) into `src/map/rivers.ts` (the great
 * rivers, of reach GREAT_RIVER_REACH or more) and `src/map/rivers-fine.ts` (the
 * others). Run by hand, never in CI, then commit the files:
 *
 *   NODE_USE_ENV_PROXY=1 node --experimental-strip-types tools/bake-rivers.ts
 *
 * Reads one GO source of `docs/SOURCES.md` § 1 (downloads are cached in the system's
 * temporary folder, never committed): DS-13, IGN BD TOPO (S-018), layer
 * `cours_d_eau`: each named watercourse with its lines, the main course and its arms.
 *
 * Each line is projected to map kilometres, thinned to TOLERANCE_KM and rounded to
 * 0.1 km; the stretches of one river are joined (`joinStretches`). Kept: the rivers that cross MIN_RIVER_REACH cells of 1 km or more
 * (`footprint`: a river's reach, close to its length), canals and aqueducts left out;
 * and of a river, the lines that cross a cell no longer line of it crosses, so the
 * arms that run beside the main course within a kilometre are dropped.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EAST, kmOf, NORTH, SOUTH, WEST } from "../src/map/grid.ts";
import {
  GREAT_RIVER_REACH,
  packRiver,
  type River,
  RIVER_UNITS_PER_KM,
} from "../src/map/river-lines.ts";
import {
  footprint,
  isCanal,
  joinStretches,
  MIN_DEGREES,
  MIN_RIVER_REACH,
  type Stretch,
  thin,
  TOLERANCE_KM,
} from "./bake-rivers-rules.ts";

const OUT_GREAT = "src/map/rivers.ts";
const OUT_LESSER = "src/map/rivers-fine.ts";
const BAKED_ON = new Date().toISOString().slice(0, 10);
const CACHE = join(tmpdir(), `wattscape-bake-rivers-${BAKED_ON}`);
const WFS = "https://data.geopf.fr/wfs/ows";
const PAGE = 200;

async function get(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${String(response.status)} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

async function cached(name: string, url: string): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, name);
  if (existsSync(path)) return readFileSync(path);
  const body = await get(url);
  writeFileSync(path, body);
  return body;
}

interface Feature {
  readonly geometry: { readonly type: string; readonly coordinates: number[][][] } | null;
  readonly properties: { readonly cleabs: string; readonly toponyme: string | null };
}

// The long watercourses of the map's box, by pages (a page is about 25 MB).
const features: Feature[] = [];
let matched = -1;
for (let start = 0; ; start += PAGE) {
  const url = `${WFS}?${new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: "BDTOPO_V3:cours_d_eau",
    OUTPUTFORMAT: "application/json",
    COUNT: String(PAGE),
    STARTINDEX: String(start),
    SORTBY: "cleabs",
    CQL_FILTER: `geomLength(geometrie) > ${String(MIN_DEGREES)} AND BBOX(geometrie,${[SOUTH, WEST, NORTH, EAST].map((v) => v.toFixed(2)).join(",")})`,
  }).toString()}`;
  const page = JSON.parse((await cached(`long-${String(start)}.json`, url)).toString("utf8")) as {
    features: Feature[];
    numberMatched: number;
  };
  if (matched === -1) matched = page.numberMatched;
  if (page.numberMatched !== matched) throw new Error("BD TOPO changed during the bake");
  features.push(...page.features);
  if (page.features.length < PAGE) break;
}
if (features.length !== matched || matched < 300)
  throw new Error(`BD TOPO: ${String(features.length)} of ${String(matched)} watercourses`);
if (new Set(features.map((f) => f.properties.cleabs)).size !== features.length)
  throw new Error("BD TOPO: a watercourse came twice");

// Each watercourse: its lines projected, thinned and rounded.
const stretches: Stretch[] = [];
let points = 0;
let unnamed = 0;
for (const f of features) {
  if (f.geometry?.type !== "MultiLineString")
    throw new Error(`BD TOPO: ${f.properties.cleabs} is a ${String(f.geometry?.type)}`);
  const name = f.properties.toponyme;
  // A watercourse without a name cannot be joined to its river, nor named: left out.
  if (name === null || name.trim() === "") {
    unnamed++;
    continue;
  }
  const lines: Int32Array[] = [];
  for (const line of f.geometry.coordinates) {
    points += line.length;
    const thinned = thin(
      line.map(([lon = 0, lat = 0]) => kmOf(lat, lon)),
      TOLERANCE_KM,
    );
    // Rounded to 0.1 km; points that fall together are merged.
    const flat: number[] = [];
    for (const p of thinned) {
      const x = Math.round(p.x * RIVER_UNITS_PER_KM);
      const y = Math.round(p.y * RIVER_UNITS_PER_KM);
      if (flat.length >= 2 && flat[flat.length - 2] === x && flat[flat.length - 1] === y) continue;
      flat.push(x, y);
    }
    // A line that the rounding reduces to a point is dropped.
    if (flat.length >= 4) lines.push(Int32Array.from(flat));
  }
  stretches.push({ name, lines });
}

const rivers: River[] = [];
let canals = 0;
let kept = 0;
let arms = 0;
const joined = joinStretches(stretches);
for (const { name, lines: all } of joined) {
  const { lines, reach } = footprint(all);
  if (reach < MIN_RIVER_REACH) continue;
  if (isCanal(name)) {
    canals++;
    continue;
  }
  arms += all.length - lines.length;
  kept += lines.reduce((t, line) => t + line.length / 2, 0);
  rivers.push({ name, reach, lines });
}
// Longest first; ties by name, then by the first point, so the file is reproducible.
rivers.sort(
  (a, b) =>
    b.reach - a.reach ||
    a.name.localeCompare(b.name, "fr") ||
    (a.lines[0]?.[0] ?? 0) - (b.lines[0]?.[0] ?? 0),
);

const header = (which: string): string => `/**
 * ${which} (B-023). GENERATED by tools/bake-rivers.ts on
 * ${BAKED_ON}: do not edit, re-bake. Source and licence: ASSETS.md.
 *
 * The named watercourses of IGN BD TOPO (DS-13, S-018, layer \`cours_d_eau\`), Licence
 * Ouverte 2.0, that cross ${String(MIN_RIVER_REACH)} cells of 1 km or more, canals and aqueducts left out; each
 * line thinned to ${String(TOLERANCE_KM)} km, the arms beside the main course dropped. Packed as
 * \`name|reach|line;line\` (src/map/river-lines.ts), longest first.
 */
`;
const rows = (list: readonly River[]): string =>
  list.map((r) => `  ${JSON.stringify(packRiver(r))},`).join("\n");
writeFileSync(
  OUT_GREAT,
  `${header(`The great rivers the scene draws, of reach ${String(GREAT_RIVER_REACH)} or more`)}
export const GREAT_RIVERS_PACKED: readonly string[] = [
${rows(rivers.filter((r) => r.reach >= GREAT_RIVER_REACH))}
];
`,
);
writeFileSync(
  OUT_LESSER,
  `${header(`The lesser rivers the scene draws from close, of reach under ${String(GREAT_RIVER_REACH)}`)}
export const LESSER_RIVERS_PACKED: readonly string[] = [
${rows(rivers.filter((r) => r.reach < GREAT_RIVER_REACH))}
];
`,
);
// The committed files follow the repository's formatting.
execFileSync("npx", ["prettier", "--write", OUT_GREAT, OUT_LESSER], { stdio: "inherit" });

console.log(
  `${String(features.length)} watercourses over ${String(MIN_DEGREES)}°, ${String(joined.length)} once joined; ${String(rivers.length)} rivers of reach ${String(MIN_RIVER_REACH)} or more, ${String(canals)} canals and ${String(unnamed)} unnamed watercourses left out`,
);
console.log(
  `${String(points)} points thinned to ${String(kept)}; ${String(arms)} arms dropped; ${String(rivers.reduce((t, r) => t + r.reach, 0))} cells in all`,
);
for (const floor of [500, GREAT_RIVER_REACH, 200, 150, MIN_RIVER_REACH])
  console.log(
    `reach ${String(floor)} or more: ${String(rivers.filter((r) => r.reach >= floor).length)}`,
  );
console.log(rivers.map((r) => `${r.name} ${String(r.reach)}`).join(", "));
