/**
 * Bakes the power plants the scene draws (B-012, D-024) into `src/map/plants.ts`.
 * Run by hand, never in CI, then commit the file:
 *
 *   node --experimental-strip-types tools/bake-plants.ts
 *
 * Reads two GO sources of `docs/DATA-SOURCES.md` (downloads are cached in the
 * system's temporary folder, never committed):
 *
 * - DS-07, ODRÉ « Registre national des installations de production et de stockage
 *   d'électricité » at 31/12/2024 (S-016): every unit in service of 10 MW or more,
 *   with its technology, capacity and the INSEE code of its commune;
 * - DS-04, IGN ADMIN EXPRESS COG, the chef-lieu (town hall) of each commune (S-013),
 *   where the plant is placed.
 *
 * A **site** is the units of one technology in one commune. Per region and
 * technology, the largest sites are kept (`MIN_MW`, `MAX_SITES`), each moved onto the
 * nearest 1 km cell of its region if its chef-lieu falls elsewhere (the coast, a
 * border). Offshore wind is left out: the registry gives the commune where a farm
 * lands on the grid, not where it stands at sea (G-007).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { REGION_CODES, type RegionCode, type Source } from "../src/data/eco2mix.ts";
import { COOLING_TOWERS, FILIERES, MAX_SITES, MIN_MW } from "./bake-plants-rules.ts";
import {
  decodeRuns,
  FINE_COLUMNS,
  FINE_KM,
  FINE_ROWS,
  kindOfRegion,
  kmOf,
  SEA,
} from "../src/map/grid.ts";
import { FINE_ROWS_RLE } from "../src/map/france.ts";

const OUT = "src/map/plants.ts";
const BAKED_ON = new Date().toISOString().slice(0, 10);
const CACHE = join(tmpdir(), `wattscape-bake-plants-${BAKED_ON}`);

export const REGISTRY_DATASET =
  "registre-national-installation-production-stockage-electricite-agrege-311224";
const REGISTRY = `https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/${REGISTRY_DATASET}`;
const WFS = "https://data.geopf.fr/wfs/ows";

/** How far a site may move to land on a cell of its region, km. */
const SNAP_KM = 5;

async function get(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${String(response.status)} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      // ODRÉ sometimes resets the connection: retry with growing pauses.
      if (attempt === 8) throw error;
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

interface Unit {
  readonly codefiliere: string;
  readonly technologie: string | null;
  readonly coderegion: string;
  readonly codeinseecommune: string | null;
  readonly codeinseecommuneimplantation: string | null;
  readonly puismaxinstallee: number;
}

const where = [
  `regime = "En service"`,
  "puismaxinstallee >= 10000",
  `codefiliere in (${Object.keys(FILIERES)
    .map((f) => `"${f}"`)
    .join(",")})`,
].join(" and ");
const unitsUrl = `${REGISTRY}/exports/json?${new URLSearchParams({
  where,
  select:
    "codefiliere,technologie,coderegion,codeinseecommune,codeinseecommuneimplantation,puismaxinstallee",
}).toString()}`;
const units = JSON.parse((await cached("units.json", unitsUrl)).toString("utf8")) as Unit[];
if (!Array.isArray(units) || units.length < 1000) throw new Error("registry: unexpected answer");

const isRegion = (code: string): code is RegionCode => REGION_CODES.some((r) => r === code);

interface Site {
  readonly source: Source;
  readonly region: RegionCode;
  readonly insee: string;
  mw: number;
}
const sites = new Map<string, Site>();
let offshore = 0;
let outside = 0;
for (const u of units) {
  const source = FILIERES[u.codefiliere];
  if (source === undefined) continue;
  if (u.technologie?.startsWith("En mer") === true) {
    offshore++;
    continue;
  }
  // Corsica and overseas: not in the regional éCO2mix, so never animated.
  if (!isRegion(u.coderegion)) {
    outside++;
    continue;
  }
  const insee = u.codeinseecommuneimplantation ?? u.codeinseecommune;
  if (insee === null || !/^[0-9][0-9AB][0-9]{3}$/.test(insee)) continue;
  if (!(u.puismaxinstallee > 0)) continue;
  const key = `${u.coderegion}|${source}|${insee}`;
  const site = sites.get(key) ?? { source, region: u.coderegion, insee, mw: 0 };
  site.mw += u.puismaxinstallee / 1000;
  sites.set(key, site);
}

// The largest sites of each region and technology, largest first; ties by commune.
const kept: Site[] = [];
for (const region of REGION_CODES)
  for (const source of Object.values(FILIERES)) {
    const all = [...sites.values()]
      .filter((s) => s.region === region && s.source === source && s.mw >= MIN_MW[source])
      .sort((a, b) => b.mw - a.mw || a.insee.localeCompare(b.insee));
    kept.push(...(source === "nuclear" ? all : all.slice(0, MAX_SITES)));
  }

// The chef-lieu of each commune, from IGN, by batches of codes.
interface ChefLieu {
  readonly lon: number;
  readonly lat: number;
  readonly name: string;
}
const chefLieux = new Map<string, ChefLieu>();
const codes = [...new Set(kept.map((s) => s.insee))].sort();
for (let i = 0; i < codes.length; i += 80) {
  const batch = codes.slice(i, i + 80);
  const url = `${WFS}?${new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: "ADMINEXPRESS-COG.LATEST:chef_lieu_de_commune",
    OUTPUTFORMAT: "application/json",
    CQL_FILTER: `code_insee_de_la_commune IN (${batch.map((c) => `'${c}'`).join(",")})`,
  }).toString()}`;
  const json = JSON.parse((await cached(`chef-lieux-${String(i)}.json`, url)).toString("utf8")) as {
    features: {
      geometry: { coordinates: [number, number] };
      properties: { code_insee_de_la_commune: string; nom_officiel: string };
    }[];
  };
  for (const f of json.features)
    chefLieux.set(f.properties.code_insee_de_la_commune, {
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      name: f.properties.nom_officiel,
    });
}

// Onto a 1 km cell of the site's region.
const kinds = decodeRuns(FINE_ROWS_RLE, FINE_COLUMNS);
const kindAt = (r: number, c: number): number =>
  r < 0 || c < 0 || r >= FINE_ROWS || c >= FINE_COLUMNS
    ? SEA
    : (kinds[r * FINE_COLUMNS + c] ?? SEA);

interface Baked {
  readonly source: Source;
  readonly region: RegionCode;
  readonly x: number;
  readonly y: number;
  readonly mw: number;
  readonly towers: boolean;
  readonly commune: string;
}
const baked: Baked[] = [];
const missing: string[] = [];
const off: string[] = [];
for (const site of kept) {
  const chef = chefLieux.get(site.insee);
  if (chef === undefined) {
    missing.push(`${site.insee} ${site.source} ${site.mw.toFixed(0)} MW`);
    continue;
  }
  const at = kmOf(chef.lat, chef.lon);
  const r0 = Math.floor(at.y / FINE_KM);
  const c0 = Math.floor(at.x / FINE_KM);
  const want = kindOfRegion(site.region);
  let cell: [number, number] | null = null;
  for (let ring = 0; ring <= SNAP_KM && cell === null; ring++)
    for (let dr = -ring; dr <= ring && cell === null; dr++)
      for (let dc = -ring; dc <= ring && cell === null; dc++)
        if (Math.max(Math.abs(dr), Math.abs(dc)) === ring && kindAt(r0 + dr, c0 + dc) === want)
          cell = [r0 + dr, c0 + dc];
  if (cell === null) {
    off.push(`${chef.name} ${site.source}`);
    continue;
  }
  const [r, c] = cell;
  const moved = r !== r0 || c !== c0;
  baked.push({
    source: site.source,
    region: site.region,
    // Kept to 0.1 km; a site moved onto its region sits at the centre of that cell.
    x: moved ? c + 0.5 : Math.round(at.x * 10) / 10,
    y: moved ? r + 0.5 : Math.round(at.y * 10) / 10,
    mw: Math.round(site.mw),
    towers: site.source === "nuclear" && COOLING_TOWERS.includes(chef.name),
    commune: chef.name,
  });
}

const line = (p: Baked): string =>
  `  [${[p.source, p.region].map((v) => JSON.stringify(v)).join(", ")}, ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${String(p.mw)}, ${String(p.towers)}, ${JSON.stringify(p.commune)}],`;
writeFileSync(
  OUT,
  `/**
 * The power plants the scene draws (B-012, D-024). GENERATED by tools/bake-plants.ts on
 * ${BAKED_ON}: do not edit, re-bake. Sources and licences: ASSETS.md.
 *
 * - Units in service of 10 MW or more: ODRÉ « Registre national des installations de
 *   production et de stockage d'électricité » at 31/12/2024 (DS-07, S-016), Licence
 *   Ouverte 2.0.
 * - Each site at the chef-lieu of its commune: IGN ADMIN EXPRESS COG (DS-04, S-013),
 *   Licence Ouverte 2.0.
 */
import { type RegionCode, type Source } from "../data/eco2mix.ts";

/** One technology in one commune: the sum of its units. */
export interface PlantSite {
  readonly source: Source;
  /** The region whose éCO2mix figures drive it. */
  readonly region: RegionCode;
  /** Map kilometres (src/map/grid.ts), to 0.1 km. */
  readonly x: number;
  readonly y: number;
  /** Installed capacity, MW (the registry's puisMaxInstallee). */
  readonly mw: number;
  /** A nuclear site cooled by towers, which steam (provisional, PRD Q-14). */
  readonly towers: boolean;
  /** The commune it stands in (IGN's official name). */
  readonly commune: string;
}

/** Day of the bake. */
export const PLANTS_BAKED_ON = "${BAKED_ON}";

type Row = readonly [Source, RegionCode, number, number, number, boolean, string];

/** Source, region, x, y, MW, towers, commune. */
const ROWS: readonly Row[] = [
${baked.map(line).join("\n")}
];

export const PLANT_SITES: readonly PlantSite[] = ROWS.map(
  ([source, region, x, y, mw, towers, commune]) => ({ source, region, x, y, mw, towers, commune }),
);
`,
);
// The committed file follows the repository's formatting.
execFileSync("npx", ["prettier", "--write", OUT], { stdio: "inherit" });

const bySource = (s: Source): string => {
  const list = baked.filter((p) => p.source === s);
  return `${s} ${String(list.length)} (${String(list.reduce((t, p) => t + p.mw, 0))} MW)`;
};
console.log(
  `${String(units.length)} units, ${String(sites.size)} sites, ${String(baked.length)} baked`,
);
console.log(Object.values(FILIERES).map(bySource).join(", "));
console.log(
  `left out: ${String(offshore)} offshore units, ${String(outside)} outside the 12 regions`,
);
if (missing.length > 0) console.log(`no chef-lieu: ${missing.join("; ")}`);
if (off.length > 0) console.log(`not on their region: ${off.join("; ")}`);
console.log(
  baked
    .filter((p) => p.source === "nuclear")
    .map((p) => `${p.commune} ${String(p.mw)}${p.towers ? " (towers)" : ""}`)
    .join(", "),
);
