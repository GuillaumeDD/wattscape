/**
 * Which plants tools/bake-plants.ts keeps, and how it draws them (B-012, D-024): kept
 * apart from the bake itself, which reads the network, so that the tests can check
 * the baked file against them.
 */
import { type Source } from "../src/data/eco2mix.ts";

/** The registry's technologies (`codefiliere`), as the scene's sources. */
export const FILIERES: Readonly<Record<string, Source>> = {
  NUCLE: "nuclear",
  THERM: "thermal",
  EOLIE: "wind",
  SOLAI: "solar",
  HYDLQ: "hydro",
  BIOEN: "bioenergy",
};

/** The smallest site kept, MW: every nuclear site; the large dams and thermal plants. */
export const MIN_MW: Readonly<Record<Source, number>> = {
  nuclear: 0,
  hydro: 50,
  thermal: 100,
  bioenergy: 10,
  wind: 10,
  solar: 10,
};

/** At most this many sites per region and technology (nuclear: all of them). */
export const MAX_SITES = 8;

/**
 * The nuclear sites cooled by towers (aéroréfrigérants), by commune: the others are
 * cooled by the sea or a river, in an open circuit, and have no towers to steam.
 * **Provisional**: from general knowledge, no source found yet (fr.wikipedia.org is
 * out of the session's reach); listed in the PR for Guillaume to check (PRD Q-14).
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
