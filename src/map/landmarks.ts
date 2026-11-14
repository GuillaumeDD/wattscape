/**
 * The landmarks the scene draws (B-015, B-016): each GO in docs/POI.md, at a position
 * read in IGN BD TOPO (DS-13, S-018), typed here with its source: the named point
 * of the layer `BDTOPO_V3:toponymie`, unless the comment names another layer.
 */
import { kmOf } from "./grid.ts";

/** Which drawing a landmark uses (src/render/art/landmarks.ts). */
export type LandmarkSprite =
  | "etretat"
  | "portCranes"
  | "harbourLight"
  | "montSaintMichel"
  | "eiffelTower"
  | "slagHeaps"
  | "strasbourgCathedral"
  | "chambord"
  | "beauneHospices"
  | "nantesCastle"
  | "carnacStones"
  | "pilatDune"
  | "pontDuGard"
  | "fourviere"
  | "notreDameDeLaGarde"
  | "rouenCathedral"
  | "lilleBelfry"
  | "amiensCathedral"
  | "hautKoenigsbourg"
  | "chartresCathedral"
  | "besanconCitadel"
  | "fortBoyard"
  | "placeDeLaBourse"
  | "carcassonne"
  | "saltMarshes"
  | "seaLighthouse"
  | "puyDeDome"
  | "calanques";

export interface Landmark {
  /** Its row in docs/POI.md. */
  readonly id: string;
  readonly sprite: LandmarkSprite;
  /** Where BD TOPO names it, in degrees. */
  readonly latitude: number;
  readonly longitude: number;
  /** Map kilometres (src/map/grid.ts). */
  readonly x: number;
  readonly y: number;
}

const at = (id: string, sprite: LandmarkSprite, latitude: number, longitude: number): Landmark => ({
  id,
  sprite,
  latitude,
  longitude,
  ...kmOf(latitude, longitude),
});

export const LANDMARKS: readonly Landmark[] = [
  // Normandie. The arch (« Porte d'Aval », a cape in BD TOPO `detail_orographique`)
  // and the needle (« l'Aiguille », 100 m west of it).
  at("P-001", "etretat", 49.70687, 0.19387),
  // Port 2000, the container terminal: the centre of its BD TOPO `equipement_de_transport`.
  at("P-002", "portCranes", 49.46024, 0.14785),
  // The outer harbour (« Avant-Port ») of Fécamp, its jetty and a generic lighthouse.
  at("P-005", "harbourLight", 49.76154, 0.36808),
  // « Abbaye du Mont-Saint-Michel » (Culte chrétien).
  at("P-006", "montSaintMichel", 48.63612, -1.51132),
  // Île-de-France. « Tour Eiffel » (Monument).
  at("P-008", "eiffelTower", 48.85826, 2.29424),
  // Hauts-de-France. « Terrils du 11/19 » (Terril), the twin heaps of Loos-en-Gohelle.
  at("P-012", "slagHeaps", 50.44558, 2.78259),
  // Grand Est. « Cathédrale Notre-Dame » of Strasbourg (Culte chrétien).
  at("P-015", "strasbourgCathedral", 48.58189, 7.75111),
  // Centre-Val de Loire. « Château de Chambord » (Château).
  at("P-018", "chambord", 47.61608, 1.51718),
  // Bourgogne-Franche-Comté. « Hôtel-Dieu » of Beaune (Musée).
  at("P-020", "beauneHospices", 47.0221, 4.8366),
  // Pays de la Loire. « Château des ducs de Bretagne », Nantes (Château).
  at("P-022", "nantesCastle", 47.21613, -1.5493),
  // Bretagne. « Alignements du Ménec », Carnac (Mégalithe).
  at("P-025", "carnacStones", 47.5934, -3.07964),
  // Nouvelle-Aquitaine. « Dune du Pilat » (Dune).
  at("P-026", "pilatDune", 44.58875, -1.21572),
  // Occitanie. « Pont du Gard » (Vestige archéologique).
  at("P-029", "pontDuGard", 43.94739, 4.53511),
  // Auvergne-Rhône-Alpes. « Notre-Dame de Fourvière », Lyon (Culte chrétien). The
  // Mont Blanc (P-033) needs no sprite: the relief draws its snow.
  at("P-035", "fourviere", 45.76223, 4.82252),
  // Provence-Alpes-Côte d'Azur. « Notre-Dame de la Garde », Marseille (Culte chrétien).
  at("P-036", "notreDameDeLaGarde", 43.28393, 5.37126),

  // The second lot (D-048). « Cathédrale Notre-Dame » of Rouen (Culte chrétien). The
  // Gros-Horloge (P-042, « Gros Horloge », 49.44152, 1.09127) stands 0.28 km west:
  // too close for a sprite of its own, so it is drawn in this one, west of the nave.
  at("P-041", "rouenCathedral", 49.44027, 1.09482),
  // « Beffroi de l'hôtel de ville », Lille (Construction).
  at("P-013", "lilleBelfry", 50.63063, 3.06978),
  // « Cathédrale Notre-Dame » of Amiens (Culte chrétien).
  at("P-014", "amiensCathedral", 49.89457, 2.30205),
  // « Château du Haut Koenigsbourg » (Château).
  at("P-016", "hautKoenigsbourg", 48.24954, 7.34465),
  // « Cathédrale Notre-Dame de Chartres » (Culte chrétien).
  at("P-019", "chartresCathedral", 48.4478, 1.48784),
  // « Muséum citadelle de Besançon » (Musée), inside the citadel.
  at("P-021", "besanconCitadel", 47.2286, 6.03447),
  // « Fort Boyard » (Ouvrage militaire).
  at("P-027", "fortBoyard", 45.99966, -1.21396),
  // « Place de la Bourse », Bordeaux (Espace public).
  at("P-028", "placeDeLaBourse", 44.84156, -0.57015),
  // « La Cité », Carcassonne (Quartier).
  at("P-030", "carcassonne", 43.20649, 2.36399),

  // The third lot (D-049). « Marais salants de Guérande » (Marais salant).
  at("P-023", "saltMarshes", 47.30122, -2.4626),
  // A generic lighthouse at sea (P-024), at the place of « Phare de la Vieille »
  // (Construction ponctuelle, Phare) off the Pointe du Raz; its look is not copied.
  at("P-024", "seaLighthouse", 48.04067, -4.75644),
  // « Puy de Dôme » (Détail orographique, Volcan).
  at("P-034", "puyDeDome", 45.77294, 2.96515),
  // « Calanque de Sormiou » (Détail hydrographique, Baie).
  at("P-037", "calanques", 43.20956, 5.42189),
];
