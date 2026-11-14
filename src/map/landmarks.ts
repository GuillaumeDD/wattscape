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
  | "notreDameDeLaGarde";

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
];
