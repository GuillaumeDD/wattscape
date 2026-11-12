/**
 * The scene model (B-011): everything a frame shows, independent of how it is drawn.
 * A theme (src/render/theme.ts) turns a scene into pixels; the pixel-art theme is
 * the first, and a second one can come later without touching the model (PRD
 * G-011). Pure: a scene is plain data, built from the map, the camera and the light.
 */
import {
  type Eco2mixReading,
  freshness,
  REGION_CODES,
  type RegionCode,
  type RegionalReadings,
  type Source,
} from "../data/eco2mix.ts";
import { PREFECTURES, REGION_CAPITALS } from "../geo/regions.ts";
import { type CellRegion, kmOf, positionOfKm } from "../map/grid.ts";
import { type TerrainLayer } from "../map/layers.ts";
import { type PlantSite } from "../map/plants.ts";
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

/** A plant as the scene shows it: where, and how hard it works (ARCHITECTURE § Data-to-scene mapping). */
export interface ScenePlant {
  readonly site: PlantSite;
  /**
   * The load factor of its technology in its region, 0 to 1 (`tch_*` / 100, clamped:
   * the API sends up to 125 %), or null when there is no figure to show (no reading,
   * a reading dated in the future, or no such capacity in éCO2mix): the plant is then
   * drawn idle, with no motion and no glow, never with a guessed value.
   */
  readonly activity: number | null;
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
  /** The plants that may show, with their activity; the theme picks by size and scale. */
  readonly plants: readonly ScenePlant[];
  /** How lit each region's towns are at night (`townLights`). */
  readonly townLights: TownLights;
}

/**
 * How lit the towns of each region are at night, 0 to 1: where its consumption stands
 * in its typical range. A region without a figure is absent, and its towns show no
 * lamps (ARCHITECTURE § Data-to-scene mapping).
 */
export type TownLights = Readonly<Partial<Record<RegionCode, number>>>;

/** A region's typical consumption, MW: its 5th and 95th percentiles over a year. */
export interface ConsumptionRange {
  readonly p5: number;
  readonly p95: number;
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

/** The figure that drives a source's plants: its regional load factor (`tch_*`). */
export function activityOf(reading: Eco2mixReading | undefined, source: Source): number | null {
  const pct = reading?.loadFactorPct[source];
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  return Math.min(1, Math.max(0, pct / 100));
}

/**
 * Every plant with the activity its region's latest reading gives it. A reading dated
 * in the future (a wrong clock, or a bad answer) shows nothing; a stale one still
 * shows, labelled as such by the page (ARCHITECTURE § Data sources).
 */
export function scenePlants(
  sites: readonly PlantSite[],
  readings: RegionalReadings | null,
  nowMs: number,
): ScenePlant[] {
  return sites.map((site) => {
    const reading = readings?.byRegion[site.region];
    const shown =
      reading !== undefined && freshness(reading, nowMs) !== "future" ? reading : undefined;
    return { site, activity: activityOf(shown, site.source) };
  });
}

/**
 * Where a reading's consumption stands in its region's typical range: 0 at the 5th
 * percentile or below, 1 at the 95th or above, linear in between; null without a
 * figure, or with a range that is not one.
 */
export function townLightOf(
  reading: Eco2mixReading | undefined,
  range: ConsumptionRange | undefined,
): number | null {
  const mw = reading?.consumptionMw;
  if (mw === undefined || range === undefined || !Number.isFinite(mw)) return null;
  const { p5, p95 } = range;
  if (!Number.isFinite(p5) || !Number.isFinite(p95) || !(p95 > p5)) return null;
  return Math.min(1, Math.max(0, (mw - p5) / (p95 - p5)));
}

/**
 * The towns' light of every region from its latest reading, with the same rule as
 * the plants: a reading dated in the future shows nothing, a stale one still shows.
 */
export function townLights(
  readings: RegionalReadings | null,
  ranges: Readonly<Partial<Record<RegionCode, ConsumptionRange>>>,
  nowMs: number,
): TownLights {
  const lights: Partial<Record<RegionCode, number>> = {};
  for (const region of REGION_CODES) {
    const reading = readings?.byRegion[region];
    if (reading === undefined || freshness(reading, nowMs) === "future") continue;
    const light = townLightOf(reading, ranges[region]);
    if (light !== null) lights[region] = light;
  }
  return lights;
}
