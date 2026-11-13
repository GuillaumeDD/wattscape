/**
 * Which plants tools/bake-plants.ts keeps, and how it draws them (B-012, D-024): kept
 * apart from the bake itself, which reads the network, so that the tests can check
 * the baked file against them.
 */
import { type Source } from "../src/data/eco2mix.ts";
import { type DiffuseSource, type MajorSource } from "../src/map/sources.ts";

/** The registry's technologies (`codefiliere`), as the scene's sources. */
export const FILIERES: Readonly<Record<string, Source>> = {
  NUCLE: "nuclear",
  THERM: "thermal",
  EOLIE: "wind",
  SOLAI: "solar",
  HYDLQ: "hydro",
  BIOEN: "bioenergy",
};

/** The smallest major site kept, MW: every nuclear site; the large dams and thermal plants. */
export const MIN_MW: Readonly<Record<MajorSource, number>> = {
  nuclear: 0,
  hydro: 50,
  thermal: 100,
};

/** At most this many hydro or thermal sites per region (nuclear: all of them). */
export const MAX_SITES = 8;

/**
 * The installed capacity one site of a diffuse source stands for, MW (B-017, D-041):
 * a region shows one site per so many MW of its units in service, of any size, so
 * that the map tells where the wind farms and the solar fields are (27 wind sites in
 * Hauts-de-France, 1 in Provence-Alpes-Côte d'Azur).
 */
export const MW_PER_SITE: Readonly<Record<DiffuseSource, number>> = {
  wind: 250,
  solar: 250,
  bioenergy: 50,
};

/**
 * How many sites of a diffuse source a region shows, from its installed capacity in
 * kW: one per MW_PER_SITE, rounded (half up), and one at least where there is any, so
 * that the region's figure always has something to move. Integers only.
 */
export function diffuseSiteCount(regionKw: number, source: DiffuseSource): number {
  if (!Number.isFinite(regionKw)) throw new Error(`capacity: ${String(regionKw)}`);
  const kw = Math.round(regionKw);
  if (kw <= 0) return 0;
  const perKw = MW_PER_SITE[source] * 1000;
  return Math.max(1, Math.floor((2 * kw + perKw) / (2 * perKw)));
}

/**
 * The nuclear sites cooled by towers (aéroréfrigérants), by commune: the others are
 * cooled by the sea or a river, in an open circuit, and have no towers to steam.
 * From general knowledge, no source found yet (fr.wikipedia.org is out of the
 * session's reach); confirmed by Guillaume, 2026-11-12 (PRD Q-14, D-027).
 */
export const COOLING_TOWERS: readonly string[] = [
  "Avoine", // Chinon
  "Belleville-sur-Loire",
  "Cattenom",
  "Chooz",
  "Civaux",
  "Cruas",
  "Dampierre-en-Burly",
  "Golfech",
  "Nogent-sur-Seine",
  "Saint-Laurent-Nouan",
  "Saint-Vulbas", // Bugey
];

/**
 * Which BD TOPO plant zones (DS-13, `nature_detaillee` of a « Centrale électrique »)
 * can be a site of each source. Nuclear plants have no `nature_detaillee`; biomass
 * plants are thermal ones, or have none.
 */
export const ZONE_KINDS: Readonly<Record<Source, readonly (string | null)[]>> = {
  nuclear: [null],
  thermal: ["Centrale thermique", null],
  bioenergy: ["Centrale thermique", null],
  hydro: ["Centrale hydroélectrique", "Centrale marémotrice"],
  wind: ["Parc éolien"],
  solar: [
    "Centrale photovoltaïque sol ou agrivoltaïque",
    "Centrale photovoltaïque sur bâti",
    "Centrale photovoltaïque flottante",
  ],
};

/** An offshore wind farm (G-007): its units in the registry, its turbines at sea. */
export interface OffshoreFarm {
  /** The name the scene gives it. */
  readonly name: string;
  /** A part of the registry's `nominstallation` that all its units share. */
  readonly units: string;
  /**
   * The region whose éCO2mix figures drive it: where it lands on the grid. The
   * registry gives Saint-Nazaire's second unit region 53 with a commune of 44, so the
   * region is set here.
   */
  readonly region: "28" | "52" | "53";
  /** South, west, north, east (degrees): the box its BD TOPO turbines stand in. */
  readonly box: readonly [number, number, number, number];
}

/**
 * The offshore wind farms in service at the registry's date (31/12/2024), each with
 * its turbines in BD TOPO. Faraman's three floating units (25 MW) have no turbine in
 * BD TOPO yet; the Calvados and Dieppe - Le Tréport farms are « en construction ».
 */
export const OFFSHORE_FARMS: readonly OffshoreFarm[] = [
  {
    name: "Parc éolien en mer de Fécamp",
    units: "HAUTES - FALAISES",
    region: "28",
    box: [49.75, 0.0, 50.0, 0.4],
  },
  {
    name: "Parc éolien en mer de Saint-Nazaire",
    units: "BANC-DE-GUERANDE",
    region: "52",
    box: [47.0, -2.75, 47.25, -2.4],
  },
  {
    name: "Parc éolien en mer de la baie de Saint-Brieuc",
    units: "BAIE-DE-ST-BRIEUC",
    region: "53",
    box: [48.75, -2.85, 49.05, -2.35],
  },
];

/**
 * The plant's own name in a unit's registry name (B-017), e.g. « BATHIE (LA) » in
 * « BATHIEH-CENTRALE HYDRAULIQUE DE BATHIE (LA)-7 », as words to look for in a BD
 * TOPO name (wordsOf): « bathie ». The article in brackets and any other brackets (an
 * owner, a unit) are dropped. Null when the name has no plant name.
 */
export function plantNameOf(nominstallation: string | null): string | null {
  const m = /CENTRALE (?:HYDRAULIQUE|THERMIQUE) DE (.+?)(?:-\d+)?$/.exec(nominstallation ?? "");
  const raw = m?.[1];
  if (raw === undefined) return null;
  const article = /^([^(]+?)\s*\((LA|LE|LES|L)\s*\)/.exec(raw);
  const base = article?.[1] ?? raw.replace(/\(.*$/, "");
  const name = wordsOf(base);
  // An article alone does not name anything, nor a name of fewer than four letters.
  return name.replace(/ /g, "").length < 4 ? null : name;
}

/**
 * Lower case, no accents, letters only, one space between words, articles dropped,
 * the registry's \u00ab ST \u00bb and \u00ab STE \u00bb spelt out as BD TOPO spells them.
 */
export function wordsOf(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter((w) => w !== "" && !["le", "la", "les", "l", "d", "de", "du", "des"].includes(w))
    .map((w) => (w === "st" ? "saint" : w === "ste" ? "sainte" : w))
    .join(" ");
}

/** True when a BD TOPO name holds a plant's name, as whole words. */
export function namesPlant(toponyme: string | null, plantName: string): boolean {
  return ` ${wordsOf(toponyme ?? "")} `.includes(` ${plantName} `);
}

/**
 * Words of a BD TOPO zone's name that tell its technology (B-017): a zone with no
 * `nature_detaillee` is not taken for a site of another source when its name holds
 * one of these (Strasbourg's hydro plant is not « Centrale Biomasse de Strasbourg »).
 */
export const NAME_WORDS: Readonly<Record<Source, readonly string[]>> = {
  nuclear: ["nucleaire", "cnpe"],
  thermal: ["thermique", "combustion", "cycle", "cogeneration", "charbon", "gaz"],
  bioenergy: ["biomasse", "biogaz", "incineration", "valorisation", "dechets"],
  hydro: ["hydroelectrique", "hydraulique", "barrage", "maremotrice", "hydrolienne"],
  wind: ["eolien", "eolienne", "eoliennes"],
  solar: ["photovoltaique", "solaire", "photovaoltaique"],
};

/** False when a zone's name tells another technology than the site's (NAME_WORDS). */
export function nameFits(toponyme: string | null, source: Source): boolean {
  const words = ` ${wordsOf(toponyme ?? "")} `;
  return (Object.keys(NAME_WORDS) as Source[]).every(
    (other) =>
      other === source ||
      // Thermal and bioenergy plants share their names (« centrale thermique »).
      (other === "thermal" && source === "bioenergy") ||
      (other === "bioenergy" && source === "thermal") ||
      NAME_WORDS[other].every((w) => !words.includes(` ${w} `)),
  );
}

/**
 * Whether a BD TOPO plant zone found by its name can be a site of a source (B-017):
 * of the source's kind or of no kind, and not named for another technology.
 */
export function zoneFits(kind: string | null, toponyme: string | null, source: Source): boolean {
  return (kind === null || ZONE_KINDS[source].includes(kind)) && nameFits(toponyme, source);
}

/** Something BD TOPO names, in map kilometres. */
export interface NamedPlace {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

/** How far from its town hall a plant named in BD TOPO may stand, km (B-017). */
export const NAMED_KM = 15;

/**
 * The nearest place, within NAMED_KM of `near` (the town hall), whose name holds one
 * of a site's plant names, the names of its largest units tried first (B-017, D-036).
 * Ties go to the name in alphabetical order, so the bake is reproducible.
 */
export function nearestNamed<T extends NamedPlace>(
  places: readonly T[],
  names: readonly { readonly name: string; readonly mw: number }[],
  near: { readonly x: number; readonly y: number },
): T | undefined {
  const order = [...names].sort((a, b) => b.mw - a.mw || a.name.localeCompare(b.name));
  for (const { name } of order) {
    const found = places
      .filter((p) => namesPlant(p.name, name))
      .map((p) => ({ p, km: Math.hypot(p.x - near.x, p.y - near.y) }))
      .filter((c) => c.km <= NAMED_KM)
      .sort((a, b) => a.km - b.km || a.p.name.localeCompare(b.p.name))[0];
    if (found !== undefined) return found.p;
  }
  return undefined;
}
