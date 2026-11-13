/**
 * The landmarks the scene draws (B-015): each GO in docs/POI.md, at a position read
 * in IGN BD TOPO (DS-13, S-018), typed here with its source. More regions come with
 * B-016.
 */
import { kmOf } from "./grid.ts";

/** Which drawing a landmark uses (src/render/art/landmarks.ts). */
export type LandmarkSprite = "etretat" | "portCranes" | "harbourLight";

export interface Landmark {
  /** Its row in docs/POI.md. */
  readonly id: string;
  readonly sprite: LandmarkSprite;
  /** Map kilometres (src/map/grid.ts). */
  readonly x: number;
  readonly y: number;
}

const at = (id: string, sprite: LandmarkSprite, latitude: number, longitude: number): Landmark => ({
  id,
  sprite,
  ...kmOf(latitude, longitude),
});

export const LANDMARKS: readonly Landmark[] = [
  // The arch (« Porte d'Aval », a cape in BD TOPO `detail_orographique`) and the
  // needle (« l'Aiguille », 100 m west of it).
  at("P-001", "etretat", 49.70687, 0.19387),
  // Port 2000, the container terminal: the centre of its BD TOPO `equipement_de_transport`.
  at("P-002", "portCranes", 49.46024, 0.14785),
  // The outer harbour (« Avant-Port ») of Fécamp, its jetty and a generic lighthouse.
  at("P-005", "harbourLight", 49.76154, 0.36808),
];
