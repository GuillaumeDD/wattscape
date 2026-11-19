/**
 * The reference frames whose hashes are recorded in tests/fixtures/frames/hashes.json:
 * Node draws them in tests/render.test.ts and tests/pixel-theme.test.ts, Chromium in
 * e2e/frame-hash.spec.ts, and both must agree (AGENTS.md § Determinism). Fixed inputs
 * only: a 480 × 270 buffer, cameras framed as the app frames an area, fixed lights.
 */
import { parseEco2mixRegions, type RegionCode } from "../src/data/eco2mix.ts";
import { CONSUMPTION_RANGES } from "../src/map/consumption.ts";
import { kmOf, type CellRegion } from "../src/map/grid.ts";
import { coarseLayer, fineLayer } from "../src/map/layers.ts";
import { LANDMARKS } from "../src/map/landmarks.ts";
import { PLANT_SITES } from "../src/map/plants.ts";
import { FINE_ELEVATION_RLE } from "../src/map/relief.ts";
import { LESSER_RIVERS_PACKED } from "../src/map/rivers-fine.ts";
import { drawModernScene, MODERN_SHARP_DENSITY } from "../src/render/modern-theme.ts";
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
import { type WeatherGroup, type WeatherReading } from "../src/data/open-meteo.ts";
import { overrideWeather, type RegionalWeather } from "../src/scene/weather.ts";
import dayStep from "../tests/fixtures/eco2mix/2026-11-12-all-regions.json" with { type: "json" };
import nightStep from "../tests/fixtures/eco2mix/2026-11-12-all-regions-0100z.json" with { type: "json" };

export const FRAME_WIDTH = 480;
export const FRAME_HEIGHT = 270;
/** Output pixels per scene pixel of the modern theme's frames. */
export const MODERN_DENSITY = 2;

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
    fine: fineLayer(FINE_ELEVATION_RLE, LESSER_RIVERS_PACKED),
    detail: detailForScale(camera.scale),
    towns: bakedTowns(),
    plants: recordedPlants(sunElevation < 0),
    townLights: recordedTownLights(sunElevation < 0),
    landmarks: LANDMARKS,
    weather: {},
    timeMs: 0,
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

/**
 * The same scene by the modern theme, at 2 output pixels per scene pixel, or at the
 * sharp density a full HD screen gets (4, the map drawn at 2: D-058).
 */
function modern(
  focus: CellRegion | null,
  camera: Camera,
  sunElevation: number,
  seconds?: number,
  density = MODERN_DENSITY,
): Surface {
  const out = createSurface(FRAME_WIDTH * density, FRAME_HEIGHT * density);
  const drawn = drawModernScene(referenceScene(focus, camera, sunElevation), out);
  if (seconds !== undefined) drawn.animate(out, seconds);
  return out;
}

const framed = (region: CellRegion | null): Camera =>
  fitBox(areaBox(coarseLayer(), region), FRAME_WIDTH, FRAME_HEIGHT);

/** The time of the weather frames: the clouds drift with it. */
export const WEATHER_TIME_MS = Date.UTC(2026, 10, 12, 9, 45);

/** One sky per region, as `?weather=` would impose each: rain in the west, a storm in the Alps. */
export const MIXED_WEATHER: RegionalWeather = (() => {
  const of = (group: WeatherGroup): WeatherReading | undefined =>
    overrideWeather(group, WEATHER_TIME_MS)["11"];
  const half = of("cloudy");
  const groups: Partial<Record<RegionCode, WeatherReading | undefined>> = {
    "53": of("rain"),
    "52": of("drizzle"),
    "28": half === undefined ? undefined : { ...half, cloudCoverPct: 50 },
    "11": of("cloudy"),
    "44": of("snow"),
    "27": of("fog"),
    "84": of("storm"),
    "93": of("clear"),
  };
  const out: Partial<Record<RegionCode, WeatherReading>> = {};
  for (const [region, reading] of Object.entries(groups) as [
    RegionCode,
    WeatherReading | undefined,
  ][])
    if (reading !== undefined) out[region] = reading;
  return out;
})();

/** A reference frame under a weather, in either theme. */
function weathered(
  theme: "pixel" | "modern",
  focus: CellRegion | null,
  sunElevation: number,
  weather: RegionalWeather,
  seconds: number,
): Surface {
  const density = theme === "pixel" ? 1 : MODERN_DENSITY;
  const out = createSurface(FRAME_WIDTH * density, FRAME_HEIGHT * density);
  const s = {
    ...referenceScene(focus, framed(focus), sunElevation),
    weather,
    timeMs: WEATHER_TIME_MS,
  };
  const drawn = (theme === "pixel" ? drawPixelScene : drawModernScene)(s, out);
  drawn.animate(out, seconds);
  return out;
}

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
  // The modern theme (G-011), at 2 output pixels per scene pixel: France with its
  // sky, a region by day, at the golden hour and at night with its plants moving,
  // the blend between the two layers, and the relief close up.
  "modern-france-day": () => modern(null, framed(null), 35),
  "modern-france-night": () => modern(null, framed(null), -20),
  "modern-normandie-day-t1.3": () => modern("28", framed("28"), 35, 1.3),
  "modern-normandie-night-t1.3": () => modern("28", framed("28"), -20, 1.3),
  "modern-auvergne-rhone-alpes-golden": () => modern("84", framed("84"), 2),
  "modern-crossfade-day": () => modern(null, { ...kmOf(45.5, 3), scale: 0.6 }, 35),
  "modern-mont-blanc-day": () => modern("84", { ...kmOf(45.83, 6.86), scale: 4 }, 35),
  // At the sharp density (D-058): the map spread from 2 pixels per scene pixel, the
  // plants and the landmarks at 4.
  "modern-sharp-normandie-day-t1.3": () =>
    modern("28", framed("28"), 35, 1.3, MODERN_SHARP_DENSITY),
  "modern-sharp-normandie-night-t1.3": () =>
    modern("28", framed("28"), -20, 1.3, MODERN_SHARP_DENSITY),
  // The weather (B-018), as `?weather=` imposes it, at a fixed time: France with a
  // different sky in each region, Normandie under rain, then under a storm at night,
  // in both themes, at an animation time that shows the rain and one that flashes.
  "weather-france-mixed-pixel-t1.3": () => weathered("pixel", null, 35, MIXED_WEATHER, 1.3),
  "weather-normandie-rain-pixel-t1.3": () =>
    weathered("pixel", "28", 35, overrideWeather("rain", WEATHER_TIME_MS), 1.3),
  "weather-normandie-storm-night-pixel-t0.1": () =>
    weathered("pixel", "28", -20, overrideWeather("storm", WEATHER_TIME_MS), 0.1),
  "weather-france-mixed-modern-t1.3": () => weathered("modern", null, 35, MIXED_WEATHER, 1.3),
  "weather-normandie-fog-modern-t1.3": () =>
    weathered("modern", "28", 35, overrideWeather("fog", WEATHER_TIME_MS), 1.3),
  "weather-normandie-storm-night-modern-t0.1": () =>
    weathered("modern", "28", -20, overrideWeather("storm", WEATHER_TIME_MS), 0.1),
};
