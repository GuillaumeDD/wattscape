/**
 * The usual names of the large plants, for their captions (B-020): "Penly (Petit-Caux)"
 * rather than the commune alone (Guillaume, 2026-11-14, D-053). Each is the plant name
 * the national registry gives the site's units (`nominstallation`, DS-07, read on
 * 2026-11-14, S-025), written with its accents, when one plant holds most of the
 * site's capacity and its name is not already the commune's. Every other site keeps
 * its commune's name alone.
 */
import { type PlantSite } from "./plants.ts";

/** By technology and commune, as baked in src/map/plants.ts. */
export const PLANT_NAMES: Readonly<Record<string, string>> = {
  // Nuclear: « CENTRALE NUCLEAIRE DE … ».
  "nuclear|Avoine": "Chinon",
  "nuclear|Belleville-sur-Loire": "Belleville",
  "nuclear|Saint-Laurent-Nouan": "Saint-Laurent-des-Eaux",
  "nuclear|Petit-Caux": "Penly",
  "nuclear|Braud-et-Saint-Louis": "Le Blayais",
  // Filed under Pierrelatte, its neighbour, by the registry.
  "nuclear|Saint-Paul-Trois-Châteaux": "Le Tricastin",
  "nuclear|Saint-Vulbas": "Le Bugey",
  "nuclear|Saint-Maurice-l'Exil": "Saint-Alban",
  // Thermal: « CENTRALE THERMIQUE DE … ».
  "thermal|Vernou-la-Celle-sur-Seine": "Montereau",
  "thermal|Vitry-sur-Seine": "Arrighi",
  "thermal|Saint-Ouen-sur-Seine": "Bateliers",
  "thermal|Abergement-la-Ronce": "Tavaux",
  "thermal|Gonfreville-l'Orcher": "Amfard",
  "thermal|Saint-Étienne-du-Rouvray": "Chapelle-Darblay",
  "thermal|Grande-Synthe": "Braek",
  "thermal|Pont-sur-Sambre": "Quartes",
  "thermal|Saint-Avold": "Émile-Huchet",
  "thermal|Toul": "Croix-de-Metz",
  "thermal|Montoir-de-Bretagne": "Grandes-Rivières",
  "thermal|Landivisiau": "Ponant",
  "thermal|Le Lardin-Saint-Lazare": "Condat-le-Lardin",
  "thermal|Bayet": "Les Morandes",
  "thermal|Martigues": "Martigues-Ponteau",
  // Hydro: « CENTRALE HYDRAULIQUE DE … ».
  "hydro|Cernon": "Vouglans",
  "hydro|Les Mazures": "Revin",
  "hydro|Soursac": "L'Aigle",
  "hydro|Saint-Martin-la-Méanne": "Le Chastang",
  "hydro|Camps-Saint-Mathurin-Léobazel": "Laval-de-Cère",
  "hydro|Liginiac": "Marèges",
  "hydro|Le Truel": "Le Pouget",
  "hydro|Gavarnie-Gèdre": "Pragnères",
  "hydro|Saint-Hippolyte": "Couesque",
  "hydro|Vaujany": "Grand-Maison",
  "hydro|Avrieux": "Villarodin",
  "hydro|Injoux-Génissiat": "Génissiat",
  "hydro|Grand-Aigueblanche": "La Coche",
  "hydro|Ubaye-Serre-Ponçon": "Serre-Ponçon",
  "hydro|Venterol": "Curbans",
};

/** A plant's name in its caption: "Penly (Petit-Caux)", or its commune alone. */
export function plantName(site: Pick<PlantSite, "source" | "commune">): string {
  const usual = PLANT_NAMES[`${site.source}|${site.commune}`];
  return usual === undefined ? site.commune : `${usual} (${site.commune})`;
}
