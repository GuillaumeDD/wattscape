/**
 * The scene model (B-011): everything a frame shows, independent of how it is drawn.
 * A theme (src/render/theme.ts) turns a scene into pixels; the pixel-art theme is
 * the first, and a second one can come later without touching the model (PRD
 * G-011). Pure: a scene is plain data, built from the map, the camera and the light.
 */
import { PREFECTURES, REGION_CAPITALS } from "../geo/regions.ts";
import { type CellRegion, kmOf, positionOfKm } from "../map/grid.ts";
import { type TerrainLayer } from "../map/layers.ts";
import { ditherLevel } from "../render/dither.ts";
import { type Light, lightAt } from "../sky/light.ts";
import { sunPosition } from "../sky/sun.ts";
import { type Camera } from "./camera.ts";

/** A town, in map kilometres. For now the prefectures (S-006); real towns come with B-015. */
export interface Town {
  readonly x: number;
  readonly y: number;
  /** A regional prefecture, drawn a little larger. */
  readonly capital: boolean;
}

export interface Scene {
  /** Size of the pixel buffer the scene is drawn into. */
  readonly width: number;
  readonly height: number;
  readonly camera: Camera;
  readonly light: Light;
  /** The region the viewer chose, set apart from the others; null on the national view. */
  readonly focus: CellRegion | null;
  /** The 4 km layer, always there. */
  readonly coarse: TerrainLayer;
  /** The 1 km layer, once loaded; null until then. */
  readonly fine: TerrainLayer | null;
  /**
   * How much of the 1 km layer shows over the 4 km one: a dither level, 0 (none) to 16
   * (all). Between the two, a crossfade by ordered dithering, so detail never pops.
   */
  readonly detail: number;
  readonly towns: readonly Town[];
}

/** Below this scale (pixels per km) the 4 km layer shows alone. */
export const DETAIL_FROM_SCALE = 0.5;
/** From this scale up, the 1 km layer shows alone. */
export const DETAIL_FULL_SCALE = 0.7;

/** The level of detail a scale asks for (0–16), linear between the two scales above. */
export function detailForScale(scale: number): number {
  return ditherLevel((scale - DETAIL_FROM_SCALE) / (DETAIL_FULL_SCALE - DETAIL_FROM_SCALE));
}

let towns: readonly Town[] | null = null;

/** The prefectures, as towns (computed once). */
export function prefectureTowns(): readonly Town[] {
  if (towns !== null) return towns;
  const capitals = new Set<string>(Object.values(REGION_CAPITALS));
  towns = PREFECTURES.map(([dept, , , lat, lon]) => ({
    ...kmOf(lat, lon),
    capital: capitals.has(dept),
  }));
  return towns;
}

/**
 * The light of a view at an instant: from the sun at the view's centre (one light for
 * the whole view, ARCHITECTURE § Camera and controls), its darkness rounded to a
 * sixteenth of a step, the dithering's own resolution, so that the picture changes
 * only when the light visibly does. A view off the globe reads as night.
 */
export function viewLight(camera: Camera, timeMs: number): Light {
  const at = positionOfKm(camera.x, camera.y);
  const sun = sunPosition(timeMs, at.latitude, at.longitude);
  const light = lightAt(sun?.geometricElevationDeg ?? Number.NaN);
  return { ...light, darkness: Math.round(light.darkness * 16) / 16 };
}
