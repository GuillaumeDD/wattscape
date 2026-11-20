/**
 * The weather the scene shows (B-018): one Open-Meteo reading per region, taken at
 * its prefecture, or at the viewer's rounded position for the viewer's own region
 * (PRD Q-41, D-063), and one per mountain range, for the snow on the ground (B-022,
 * Q-45). A region without a reading shows no weather, never a guessed one.
 */
import { REGION_CODES, type RegionCode } from "../data/eco2mix.ts";
import { type WeatherGroup, type WeatherReading, weatherFreshness } from "../data/open-meteo.ts";
import { referencePoint } from "../geo/regions.ts";

/**
 * The mountain ranges with a weather point of their own (Q-45): snow lies there
 * most of the winter while the prefectures, in the plains, see little. Each point is
 * on 0.1° (what is sent is exactly this), between 950 and 1 700 m by the API's own
 * height of the point (asked 2026-11-20): high enough to hold snow, low enough that
 * the ground above it is most of the range.
 */
export const MASSIFS = [
  { id: "alps", latitude: 45.5, longitude: 6.6 },
  { id: "pyrenees", latitude: 42.8, longitude: 0 },
  { id: "massifCentral", latitude: 45.2, longitude: 2.8 },
  { id: "jura", latitude: 46.5, longitude: 6.1 },
  { id: "vosges", latitude: 48.1, longitude: 7 },
] as const;

export type MassifId = (typeof MASSIFS)[number]["id"];
export const MASSIF_IDS: readonly MassifId[] = MASSIFS.map((m) => m.id);

/** Where a reading of the scene was taken: a region, or a mountain range. */
export type WeatherPointId = RegionCode | MassifId;

/** Each point's current weather; a point without a reading to show is absent. */
export type RegionalWeather = Readonly<Partial<Record<WeatherPointId, WeatherReading>>>;

/** Every weather point, the regions first. */
export const WEATHER_POINT_IDS: readonly WeatherPointId[] = [...REGION_CODES, ...MASSIF_IDS];

/**
 * Whether any region has a reading, and so a sky whose clouds drift with the time
 * (src/scene/clouds.ts); a range's reading only lays snow, which stands still.
 */
export function hasSky(weather: RegionalWeather): boolean {
  return REGION_CODES.some((r) => weather[r] !== undefined);
}

/**
 * The readings the scene may show at `nowMs`: a reading dated more than 15 minutes
 * after the clock (a fixed `?at=` in the past, the time-lapse, a wrong clock) is
 * dropped; a stale one stays, and the page labels it (the same rule as the plants).
 */
export function sceneWeather(byRegion: RegionalWeather, nowMs: number): RegionalWeather {
  const shown: Partial<Record<WeatherPointId, WeatherReading>> = {};
  for (const region of WEATHER_POINT_IDS) {
    const reading = byRegion[region];
    if (reading !== undefined && weatherFreshness(reading, nowMs) !== "future")
      shown[region] = reading;
  }
  return shown;
}

/**
 * The weather `?weather=` imposes on every region, for demos and screenshots: not a
 * reading, and the page says so. Typed by hand (ARCHITECTURE § Open-Meteo, "Weather
 * override"): a representative WMO code of the group and round values that fit it.
 */
const OVERRIDES: Readonly<
  Record<
    WeatherGroup,
    Pick<
      WeatherReading,
      | "temperatureC"
      | "weatherCode"
      | "cloudCoverPct"
      | "precipitationMm"
      | "snowfallCm"
      | "snowDepthM"
    >
  >
> = {
  clear: {
    temperatureC: 15,
    weatherCode: 0,
    cloudCoverPct: 0,
    precipitationMm: 0,
    snowfallCm: 0,
    snowDepthM: 0,
  },
  cloudy: {
    temperatureC: 12,
    weatherCode: 3,
    cloudCoverPct: 100,
    precipitationMm: 0,
    snowfallCm: 0,
    snowDepthM: 0,
  },
  fog: {
    temperatureC: 6,
    weatherCode: 45,
    cloudCoverPct: 100,
    precipitationMm: 0,
    snowfallCm: 0,
    snowDepthM: 0,
  },
  drizzle: {
    temperatureC: 10,
    weatherCode: 53,
    cloudCoverPct: 100,
    precipitationMm: 0.2,
    snowfallCm: 0,
    snowDepthM: 0,
  },
  rain: {
    temperatureC: 10,
    weatherCode: 63,
    cloudCoverPct: 100,
    precipitationMm: 2,
    snowfallCm: 0,
    snowDepthM: 0,
  },
  snow: {
    temperatureC: -1,
    weatherCode: 73,
    cloudCoverPct: 100,
    precipitationMm: 1,
    snowfallCm: 1,
    snowDepthM: 0.1,
  },
  storm: {
    temperatureC: 20,
    weatherCode: 95,
    cloudCoverPct: 100,
    precipitationMm: 5,
    snowfallCm: 0,
    snowDepthM: 0,
  },
};

/** The wind of every override: 20 km/h from the west, a round example. */
const OVERRIDE_WIND = { windSpeedKmh: 20, windFromDeg: 270 } as const;

/**
 * The same imposed weather for every region and range, dated `timeMs` (the clock's
 * time, so that it always shows). `isDay` is left true: the scene takes its light
 * from the sun (src/sky/light.ts), never from this field.
 */
export function overrideWeather(group: WeatherGroup, timeMs: number): RegionalWeather {
  const all: Partial<Record<WeatherPointId, WeatherReading>> = {};
  const points: (readonly [WeatherPointId, { latitude: number; longitude: number } | null])[] = [
    ...REGION_CODES.map((r) => [r, referencePoint(r)] as const),
    ...MASSIFS.map((m) => [m.id, m] as const),
  ];
  for (const [id, point] of points) {
    // A region without a point (none today) gets no weather, as with live readings.
    if (point === null) continue;
    all[id] = {
      timeMs,
      latitude: point.latitude,
      longitude: point.longitude,
      // At sea level, so that `?weather=snow` lays snow on all the land.
      elevationM: 0,
      group,
      ...OVERRIDES[group],
      ...OVERRIDE_WIND,
      isDay: true,
    };
  }
  return all;
}
