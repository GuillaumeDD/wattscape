/**
 * Bakes the towns the scene draws (B-015, D-031) into `src/map/towns.ts`: every
 * commune of metropolitan France with `MIN_POPULATION` inhabitants or more, placed at
 * its chef-lieu, with its population and its area. Run by hand, never in CI, then
 * commit the file:
 *
 *   node --experimental-strip-types tools/bake-towns.ts
 *
 * Reads DS-04, IGN ADMIN EXPRESS COG (S-013), Licence Ouverte 2.0: the layer
 * `commune` (INSEE population, cadastral area in hectares) and the layer
 * `chef_lieu_de_commune` (the town hall's position). Downloads are cached in the
 * system's temporary folder, never committed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KIND_REGIONS } from "../src/map/grid.ts";
import { kmOf } from "../src/map/grid.ts";
import { MIN_POPULATION } from "../src/map/town-rules.ts";

const OUT = "src/map/towns.ts";
const BAKED_ON = new Date().toISOString().slice(0, 10);
const CACHE = join(tmpdir(), `wattscape-bake-towns-${BAKED_ON}`);
const WFS = "https://data.geopf.fr/wfs/ows";
/** The WFS answers at most this many features per request. */
const PAGE = 5000;

async function get(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${String(response.status)} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
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

const wfs = (params: Record<string, string>): string =>
  `${WFS}?${new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    OUTPUTFORMAT: "application/json",
    ...params,
  }).toString()}`;

interface Commune {
  readonly code_insee: string;
  readonly nom_officiel: string;
  readonly population: number;
  readonly superficie_cadastrale: number;
  readonly code_insee_de_la_region: string;
  readonly date_du_recensement: string;
}

// The communes, metropolitan regions only (Corsica included: its towns show, unlit).
const regions = new Set<string>(KIND_REGIONS);
const communes: Commune[] = [];
for (let start = 0; ; start += PAGE) {
  const url = wfs({
    TYPENAMES: "ADMINEXPRESS-COG.LATEST:commune",
    PROPERTYNAME:
      "code_insee,nom_officiel,population,superficie_cadastrale,code_insee_de_la_region,date_du_recensement",
    CQL_FILTER: `population>=${String(MIN_POPULATION)}`,
    SORTBY: "code_insee",
    COUNT: String(PAGE),
    STARTINDEX: String(start),
  });
  const json = JSON.parse(
    (await cached(`communes-${String(start)}.json`, url)).toString("utf8"),
  ) as {
    features: { properties: Commune }[];
  };
  for (const f of json.features)
    if (regions.has(f.properties.code_insee_de_la_region)) communes.push(f.properties);
  if (json.features.length < PAGE) break;
}

// Their chef-lieux, by batches of codes.
const chefLieux = new Map<string, [number, number]>();
const codes = communes.map((c) => c.code_insee).sort();
for (let i = 0; i < codes.length; i += 200) {
  const batch = codes.slice(i, i + 200);
  const url = wfs({
    TYPENAMES: "ADMINEXPRESS-COG.LATEST:chef_lieu_de_commune",
    PROPERTYNAME: "code_insee_de_la_commune,geometrie",
    CQL_FILTER: `code_insee_de_la_commune IN (${batch.map((c) => `'${c}'`).join(",")})`,
    COUNT: String(PAGE),
  });
  const json = JSON.parse((await cached(`chef-lieux-${String(i)}.json`, url)).toString("utf8")) as {
    features: {
      geometry: { coordinates: [number, number] };
      properties: { code_insee_de_la_commune: string };
    }[];
  };
  for (const f of json.features)
    chefLieux.set(f.properties.code_insee_de_la_commune, f.geometry.coordinates);
}

const towns: string[] = [];
const census = new Set<string>();
const missing: string[] = [];
// Largest first, then by code: a stable order whatever the WFS sends.
communes.sort((a, b) => b.population - a.population || a.code_insee.localeCompare(b.code_insee));
for (const c of communes) {
  const at = chefLieux.get(c.code_insee);
  if (at === undefined) {
    missing.push(`${c.code_insee} ${c.nom_officiel}`);
    continue;
  }
  if (!Number.isInteger(c.population) || !(c.superficie_cadastrale > 0))
    throw new Error(`commune ${c.code_insee}: unexpected ${JSON.stringify(c)}`);
  const { x, y } = kmOf(at[1], at[0]);
  census.add(c.date_du_recensement.slice(0, 10));
  towns.push(
    [Math.round(x * 10), Math.round(y * 10), c.population, Math.round(c.superficie_cadastrale)]
      .map(String)
      .join(" "),
  );
}
if (missing.length > 0) throw new Error(`no chef-lieu for ${missing.join(", ")}`);
console.log(`${String(towns.length)} towns; census ${[...census].join(", ")}`);

writeFileSync(
  OUT,
  `/**
 * The towns the scene draws (B-015, D-031). GENERATED by tools/bake-towns.ts on
 * ${BAKED_ON}: do not edit, re-bake. Sources and licences: ASSETS.md.
 *
 * Every commune of metropolitan France with ${String(MIN_POPULATION)} inhabitants or more, at its chef-lieu:
 * IGN ADMIN EXPRESS COG (DS-04, S-013), Licence Ouverte 2.0; population: INSEE
 * census of ${[...census].join(", ")}, as ADMIN EXPRESS gives it.
 */

/** Day of the bake. */
export const TOWNS_BAKED_ON = "${BAKED_ON}";

/**
 * One town per ";", largest first: x and y in tenths of a map kilometre
 * (src/map/grid.ts), population, cadastral area in hectares.
 */
export const TOWNS_PACKED =
  "${towns.join(";")}";
`,
);
execFileSync("npx", ["prettier", "--write", OUT], { stdio: "inherit" });
