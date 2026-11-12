/**
 * The reference frames whose hashes are recorded in tests/fixtures/frames/hashes.json:
 * Node draws them in tests/render.test.ts and tests/pixel-theme.test.ts, Chromium in
 * e2e/frame-hash.spec.ts, and both must agree (AGENTS.md § Determinism). Fixed inputs
 * only: a 480 × 270 buffer, cameras framed as the app frames an area, fixed lights.
 */
import { parseEco2mixRegions } from "../src/data/eco2mix.ts";
import { CONSUMPTION_RANGES } from "../src/map/consumption.ts";
import { kmOf, type CellRegion } from "../src/map/grid.ts";
import { coarseLayer, fineLayer } from "../src/map/layers.ts";
import { LANDMARKS } from "../src/map/landmarks.ts";
import { PLANT_SITES } from "../src/map/plants.ts";
import { FINE_ELEVATION_RLE } from "../src/map/relief.ts";
import { drawPixelScene } from "../src/render/pixel-theme.ts";
import { createSurface, type Surface } from "../src/render/surface.ts";
import { drawTestCard } from "../src/render/test-card.ts";
import { areaBox, type Camera, fitBox } from "../src/scene/camera.ts";
import {
  detailForScale,
  bakedTowns,
  type Scene,
  type ScenePlant,
  scenePlants,
  type TownLights,
  townLights,
} from "../src/scene/scene.ts";
import { lightAt } from "../src/sky/light.ts";
import dayStep from "../tests/fixtures/eco2mix/2026-11-12-all-regions.json" with { type: "json" };
import nightStep from "../tests/fixtures/eco2mix/2026-11-12-all-regions-0100z.json" with { type: "json" };

export const FRAME_WIDTH = 480;
export const FRAME_HEIGHT = 270;

/**
 * The plants as two recorded steps of every region show them (DS-01): 2026-11-12 at
 * 09:45 UTC for the day and the golden hour, 01:00 UTC for the night.
 */
export function recordedPlants(night: boolean): ScenePlant[] {
  const parsed = parseEco2mixRegions(night ? nightStep : dayStep);
  if (!parsed.ok) throw new Error(`fixture: ${parsed.reason}`);
  return scenePlants(PLANT_SITES, parsed.reading, parsed.reading.timeMs);
}

/** The towns' light of the same two steps, against the baked ranges (DS-12). */
export function recordedTownLights(night: boolean): TownLights {
  const parsed = parseEco2mixRegions(night ? nightStep : dayStep);
  if (!parsed.ok) throw new Error(`fixture: ${parsed.reason}`);
  return townLights(parsed.reading, CONSUMPTION_RANGES, parsed.reading.timeMs);
}

/** The scene of a reference frame. */
export function referenceScene(
  focus: CellRegion | null,
  camera: Camera,
  sunElevation: number,
): Scene {
  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    camera,
    light: lightAt(sunElevation),
    focus,
    coarse: coarseLayer(),
    fine: fineLayer(FINE_ELEVATION_RLE),
    detail: detailForScale(camera.scale),
    towns: bakedTowns(),
    plants: recordedPlants(sunElevation < 0),
    townLights: recordedTownLights(sunElevation < 0),
    landmarks: LANDMARKS,
  };
}

function scene(
  focus: CellRegion | null,
  camera: Camera,
  sunElevation: number,
  seconds?: number,
): Surface {
  const out = createSurface(FRAME_WIDTH, FRAME_HEIGHT);
  const drawn = drawPixelScene(referenceScene(focus, camera, sunElevation), out);
  if (seconds !== undefined) drawn.animate(out, seconds);
  return out;
}

const framed = (region: CellRegion | null): Camera =>
  fitBox(areaBox(coarseLayer(), region), FRAME_WIDTH, FRAME_HEIGHT);

/** Every reference frame, by the name its hash is recorded under. */
export const REFERENCE_FRAMES: Readonly<Record<string, () => Surface>> = {
  "test-card": drawTestCard,
  "scene-france-day": () => scene(null, framed(null), 35),
  "scene-france-night": () => scene(null, framed(null), -20),
  "scene-normandie-golden": () => scene("28", framed("28"), 2),
  "scene-normandie-night": () => scene("28", framed("28"), -20),
  "scene-auvergne-rhone-alpes-day": () => scene("84", framed("84"), 35),
  // Halfway between the 4 km and the 1 km layers: a crossfade (detail 8).
  "scene-crossfade-day": () => scene(null, { ...kmOf(45.5, 3), scale: 0.6 }, 35),
  "scene-mont-blanc-day": () => scene("84", { ...kmOf(45.83, 6.86), scale: 4 }, 35),
  // The plants in motion (B-012): Normandie at two animation times, and the Rhône valley
  // close up (Bugey, Saint-Alban, Cruas, Tricastin and the dams).
  "plants-normandie-day-t0": () => scene("28", framed("28"), 35, 0),
  "plants-normandie-day-t1.3": () => scene("28", framed("28"), 35, 1.3),
  "plants-normandie-night-t1.3": () => scene("28", framed("28"), -20, 1.3),
  "plants-rhone-day-t0.7": () => scene("84", { ...kmOf(45.0, 4.9), scale: 1.6 }, 35, 0.7),
};
