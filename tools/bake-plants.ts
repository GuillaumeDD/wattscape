/**
 * Bakes the power plants the scene draws (B-012, D-024) into `src/map/plants.ts`.
 * Run by hand, never in CI, then commit the file:
 *
 *   node --experimental-strip-types tools/bake-plants.ts
 *
 * Reads two GO sources of `docs/SOURCES.md` § 1 (downloads are cached in the
 * system's temporary folder, never committed):
 *
 * - DS-07, ODRÉ « Registre national des installations de production et de stockage
 *   d'électricité » at 31/12/2024 (S-016): every unit in service of 10 MW or more,
 *   with its technology, capacity and the INSEE code of its commune;
 * - DS-13, IGN BD TOPO (S-018): the zones of the power plants (« Centrale
 *   électrique »), the named dams and the wind turbines, where the plant really
 *   stands (B-015, D-032, D-036);
 * - DS-04, IGN ADMIN EXPRESS COG, the chef-lieu (town hall) of each commune (S-013),
 *   where a plant is placed when BD TOPO has no zone or dam for it.
 *
 * A **site** is the units of one technology in one commune. Per region and
 * technology, the largest sites are kept (`MIN_MW`, `MAX_SITES`), each at the BD TOPO
 * zone that bears its plant's name, else at the centre of the largest zone of its kind
 * in its commune, else (hydro) at the dam that bears its name, else at the commune's
 * chef-lieu (B-017, D-036), and moved onto the nearest 1 km cell of its region if it
 * falls elsewhere (the coast, a border). An offshore wind farm (`OFFSHORE_FARMS`) is the units of the
 * registry that share its name, at the centre of its BD TOPO turbines at sea (G-007).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { REGION_CODES, type RegionCode, type Source } from "../src/data/eco2mix.ts";
import {
  COOLING_TOWERS,
  FILIERES,
  MAX_SITES,
  MIN_MW,
  nearestNamed,
  OFFSHORE_FARMS,
  plantNameOf,
  ZONE_KINDS,
  zoneFits,
} from "./bake-plants-rules.ts";
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
  readonly nominstallation: string | null;
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
    "codefiliere,technologie,coderegion,codeinseecommune,codeinseecommuneimplantation,puismaxinstallee,nominstallation",
}).toString()}`;
const units = JSON.parse((await cached("units-named.json", unitsUrl)).toString("utf8")) as Unit[];
if (!Array.isArray(units) || units.length < 1000) throw new Error("registry: unexpected answer");

const isRegion = (code: string): code is RegionCode => REGION_CODES.some((r) => r === code);

interface Site {
  readonly source: Source;
  readonly region: RegionCode;
  readonly insee: string;
  mw: number;
  /** The plant names of its units (plantNameOf), largest unit first. */
  readonly names: { name: string; mw: number }[];
}
const sites = new Map<string, Site>();
const offshoreUnits: Unit[] = [];
let outside = 0;
for (const u of units) {
  const source = FILIERES[u.codefiliere];
  if (source === undefined) continue;
  if (u.technologie?.startsWith("En mer") === true) {
    offshoreUnits.push(u);
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
  const site = sites.get(key) ?? { source, region: u.coderegion, insee, mw: 0, names: [] };
  site.mw += u.puismaxinstallee / 1000;
  const name = plantNameOf(u.nominstallation);
  if (name !== null) {
    const known = site.names.find((n) => n.name === name);
    if (known === undefined) site.names.push({ name, mw: u.puismaxinstallee / 1000 });
    else known.mw += u.puismaxinstallee / 1000;
  }
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

// The plant zones of BD TOPO (DS-13), by commune: one request for all of France.
interface Zone {
  readonly kind: string | null;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  /** Area, km² (planar, in map kilometres). */
  readonly area: number;
}
type Ring = readonly (readonly [number, number])[];
const zonesUrl = `${WFS}?${new URLSearchParams({
  SERVICE: "WFS",
  VERSION: "2.0.0",
  REQUEST: "GetFeature",
  TYPENAMES: "BDTOPO_V3:zone_d_activite_ou_d_interet",
  OUTPUTFORMAT: "application/json",
  CQL_FILTER: "nature='Centrale électrique' AND etat_de_l_objet='En service'",
  COUNT: "10000",
}).toString()}`;
const zonesJson = JSON.parse((await cached("zones.json", zonesUrl)).toString("utf8")) as {
  features: {
    geometry: { type: string; coordinates: Ring[][] } | null;
    properties: {
      insee_commune: string | null;
      nature_detaillee: string | null;
      toponyme: string | null;
    };
  }[];
};
if (zonesJson.features.length < 3000) throw new Error("BD TOPO: unexpected answer");
/** Centre (of area) and area of a polygon's outer ring, in map kilometres. */
function ringCentre(ring: Ring): { x: number; y: number; area: number } {
  const pts = ring.map(([lon, lat]) => kmOf(lat, lon));
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const p = pts[k];
    const q = pts[k + 1];
    if (p === undefined || q === undefined) continue;
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  return a === 0
    ? { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, area: 0 }
    : { x: cx / (3 * a), y: cy / (3 * a), area: Math.abs(a) / 2 };
}
const zones = new Map<string, Zone[]>();
for (const f of zonesJson.features) {
  const insee = f.properties.insee_commune;
  if (insee === null || f.geometry?.type !== "MultiPolygon") continue;
  // The largest polygon of the zone.
  const best = f.geometry.coordinates
    .map((polygon) => ringCentre(polygon[0] ?? []))
    .sort((a, b) => b.area - a.area)[0];
  if (best === undefined) continue;
  const list = zones.get(insee) ?? [];
  list.push({ kind: f.properties.nature_detaillee, name: f.properties.toponyme ?? "", ...best });
  zones.set(insee, list);
}
const allZones = [...zones.values()].flat();

/**
 * The BD TOPO zone that bears the site's plant name (B-017, D-036): the registry often
 * files a plant under another commune, or a zone has no `nature_detaillee`. Not for
 * wind and solar farms, whose names are too common.
 */
function namedZoneOf(site: Site, near: { x: number; y: number }): Zone | undefined {
  if (site.source === "wind" || site.source === "solar") return undefined;
  const fit = allZones.filter((z) => zoneFits(z.kind, z.name, site.source));
  return nearestNamed(fit, site.names, near);
}

// The named dams of BD TOPO (DS-13), where a reservoir plant stands at the dam's foot.
interface Dam {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}
const dams: Dam[] = [];
for (const layer of ["construction_surfacique", "construction_lineaire"]) {
  const url = `${WFS}?${new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: `BDTOPO_V3:${layer}`,
    OUTPUTFORMAT: "application/json",
    CQL_FILTER: "nature='Barrage' AND toponyme IS NOT NULL AND etat_de_l_objet='En service'",
    COUNT: "10000",
  }).toString()}`;
  const json = JSON.parse((await cached(`dams-${layer}.json`, url)).toString("utf8")) as {
    features: {
      geometry: { type: string; coordinates: unknown } | null;
      properties: { toponyme: string };
    }[];
  };
  for (const f of json.features) {
    // The dam's middle: the mean of its positions (lon, lat, maybe a height), enough
    // for a 1 km cell.
    const positions: (readonly number[])[] = [];
    const walk = (v: unknown): void => {
      if (!Array.isArray(v)) return;
      if (typeof v[0] === "number") positions.push(v as number[]);
      else for (const w of v) walk(w);
    };
    walk(f.geometry?.coordinates);
    const n = positions.length;
    const lon = positions.reduce((t, q) => t + (q[0] ?? 0), 0);
    const lat = positions.reduce((t, q) => t + (q[1] ?? 0), 0);
    if (n >= 1) dams.push({ name: f.properties.toponyme, ...kmOf(lat / n, lon / n) });
  }
}
if (dams.length < 100) throw new Error("BD TOPO: too few named dams");

/** The named dam of a hydro site, where its plant stands at the dam's foot. */
const damOf = (site: Site, near: { x: number; y: number }): Dam | undefined =>
  site.source === "hydro" ? nearestNamed(dams, site.names, near) : undefined;

/** The largest zone of a source's kind in a commune, if any. */
const zoneOf = (insee: string, source: Source): Zone | undefined =>
  (zones.get(insee) ?? [])
    .filter((z) => ZONE_KINDS[source].includes(z.kind))
    .sort((a, b) => b.area - a.area || a.name.localeCompare(b.name))[0];

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
  readonly exact: boolean;
  readonly offshore: boolean;
}
/** The nearest 1 km cell of a region within SNAP_KM of a point, or null. */
function snap(at: { x: number; y: number }, region: RegionCode): [number, number] | null {
  const r0 = Math.floor(at.y / FINE_KM);
  const c0 = Math.floor(at.x / FINE_KM);
  const want = kindOfRegion(region);
  for (let ring = 0; ring <= SNAP_KM; ring++)
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++)
        if (Math.max(Math.abs(dr), Math.abs(dc)) === ring && kindAt(r0 + dr, c0 + dc) === want)
          return [r0 + dr, c0 + dc];
  return null;
}

const baked: Baked[] = [];
let exact = 0;
const byName: string[] = [];
const placedBy = { name: 0, commune: 0, dam: 0, "town hall": 0 };
const missing: string[] = [];
const off: string[] = [];
for (const site of kept) {
  const chef = chefLieux.get(site.insee);
  if (chef === undefined) {
    missing.push(`${site.insee} ${site.source} ${site.mw.toFixed(0)} MW`);
    continue;
  }
  // Where it stands, in this order (B-017, D-036): its named zone; the largest zone of
  // its kind in its commune; its named dam; its town hall. A place found by its name
  // that lies out of the site's region (up to 15 km away) gives way to the next.
  const hall = kmOf(chef.lat, chef.lon);
  const named = namedZoneOf(site, hall);
  const commune = zoneOf(site.insee, site.source);
  const dam = damOf(site, hall);
  const choices: { by: keyof typeof placedBy; at: { x: number; y: number }; name: string }[] = [];
  if (named !== undefined) choices.push({ by: "name", at: named, name: named.name });
  if (commune !== undefined) choices.push({ by: "commune", at: commune, name: commune.name });
  if (dam !== undefined) choices.push({ by: "dam", at: dam, name: dam.name });
  choices.push({ by: "town hall", at: hall, name: chef.name });
  let chosen: { by: keyof typeof placedBy; at: { x: number; y: number }; name: string } | null =
    null;
  let cell: [number, number] | null = null;
  for (const choice of choices) {
    cell = snap(choice.at, site.region);
    if (cell !== null) {
      chosen = choice;
      break;
    }
  }
  if (cell === null || chosen === null) {
    off.push(`${chef.name} ${site.source}`);
    continue;
  }
  placedBy[chosen.by]++;
  if (chosen.by !== "town hall") exact++;
  if (chosen.by === "name" || chosen.by === "dam")
    byName.push(`${chef.name} ${site.source} → ${chosen.name}`);
  const at = chosen.at;
  const r0 = Math.floor(at.y / FINE_KM);
  const c0 = Math.floor(at.x / FINE_KM);
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
    exact: chosen.by !== "town hall",
    offshore: false,
  });
}

// The offshore wind farms (G-007): their units, and their BD TOPO turbines at sea.
for (const farm of OFFSHORE_FARMS) {
  const mw =
    offshoreUnits
      .filter((u) => u.nominstallation?.includes(farm.units) === true)
      .reduce((t, u) => t + u.puismaxinstallee, 0) / 1000;
  const [south, west, north, east] = farm.box;
  const url = `${WFS}?${new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: "BDTOPO_V3:construction_ponctuelle",
    OUTPUTFORMAT: "application/json",
    CQL_FILTER: `nature='Eolienne' AND etat_de_l_objet='En service' AND BBOX(geometrie,${String(south)},${String(west)},${String(north)},${String(east)})`,
    COUNT: "1000",
  }).toString()}`;
  const json = JSON.parse((await cached(`turbines-${farm.units}.json`, url)).toString("utf8")) as {
    features: { geometry: { coordinates: [number, number] } }[];
  };
  // At sea only: the box also holds a few turbines on the cliffs.
  const atSea = json.features
    .map((f) => kmOf(f.geometry.coordinates[1], f.geometry.coordinates[0]))
    .filter((p) => kindAt(Math.floor(p.y / FINE_KM), Math.floor(p.x / FINE_KM)) === SEA);
  if (!(mw > 100) || atSea.length < 20)
    throw new Error(`${farm.name}: ${String(mw)} MW, ${String(atSea.length)} turbines at sea`);
  const x = atSea.reduce((t, p) => t + p.x, 0) / atSea.length;
  const y = atSea.reduce((t, p) => t + p.y, 0) / atSea.length;
  console.log(`${farm.name}: ${mw.toFixed(0)} MW, ${String(atSea.length)} turbines at sea`);
  baked.push({
    source: "wind",
    region: farm.region,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    mw: Math.round(mw),
    towers: false,
    commune: farm.name,
    exact: true,
    offshore: true,
  });
}

const line = (p: Baked): string =>
  `  [${[p.source, p.region].map((v) => JSON.stringify(v)).join(", ")}, ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${String(p.mw)}, ${String(p.towers)}, ${JSON.stringify(p.commune)}, ${String(p.exact)}, ${String(p.offshore)}],`;
writeFileSync(
  OUT,
  `/**
 * The power plants the scene draws (B-012, D-024). GENERATED by tools/bake-plants.ts on
 * ${BAKED_ON}: do not edit, re-bake. Sources and licences: ASSETS.md.
 *
 * - Units in service of 10 MW or more: ODRÉ « Registre national des installations de
 *   production et de stockage d'électricité » at 31/12/2024 (DS-07, S-016), Licence
 *   Ouverte 2.0.
 * - Each site at the centre of its zone, or of its turbines at sea, in IGN BD TOPO
 *   (DS-13, S-018), else at the chef-lieu of its commune, IGN ADMIN EXPRESS COG
 *   (DS-04, S-013); both Licence Ouverte 2.0.
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
  /** A nuclear site cooled by towers, which steam (list confirmed by Guillaume, D-027). */
  readonly towers: boolean;
  /** The commune it stands in (IGN's official name), or an offshore farm's name. */
  readonly commune: string;
  /**
   * Placed where it stands, by BD TOPO: its named zone or dam, or its commune's zone
   * (D-032, D-036); false: at its commune's town hall.
   */
  readonly exact: boolean;
  /** An offshore wind farm, at sea (G-007). */
  readonly offshore: boolean;
}

/** Day of the bake. */
export const PLANTS_BAKED_ON = "${BAKED_ON}";

type Row = readonly [
  Source,
  RegionCode,
  number,
  number,
  number,
  boolean,
  string,
  boolean,
  boolean,
];

/** Source, region, x, y, MW, towers, commune, exact, offshore. */
const ROWS: readonly Row[] = [
${baked.map(line).join("\n")}
];

export const PLANT_SITES: readonly PlantSite[] = ROWS.map(
  ([source, region, x, y, mw, towers, commune, exact, offshore]) => ({
    source,
    region,
    x,
    y,
    mw,
    towers,
    commune,
    exact,
    offshore,
  }),
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
  `placed by BD TOPO: ${String(exact)}; ${String(offshoreUnits.length)} offshore units; ${String(outside)} outside the 12 regions`,
);
console.log(`placed by: ${JSON.stringify(placedBy)}`);
console.log(`by name: ${byName.join("; ")}`);
if (missing.length > 0) console.log(`no chef-lieu: ${missing.join("; ")}`);
if (off.length > 0) console.log(`not on their region: ${off.join("; ")}`);
console.log(
  baked
    .filter((p) => p.source === "nuclear")
    .map((p) => `${p.commune} ${String(p.mw)}${p.towers ? " (towers)" : ""}`)
    .join(", "),
);
