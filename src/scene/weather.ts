/**
 * The weather the scene shows (B-018): one Open-Meteo reading per region, taken at
 * its prefecture, or at the viewer's rounded position for the viewer's own region
 * (PRD Q-41, D-063). A region without a reading shows no weather, never a guessed one.
 */
import { REGION_CODES, type RegionCode } from "../data/eco2mix.ts";
import { type WeatherGroup, type WeatherReading, weatherFreshness } from "../data/open-meteo.ts";
import { referencePoint } from "../geo/regions.ts";

/** Each region's current weather; a region without a reading to show is absent. */
export type RegionalWeather = Readonly<Partial<Record<RegionCode, WeatherReading>>>;

/**
 * The readings the scene may show at `nowMs`: a reading dated more than 15 minutes
 * after the clock (a fixed `?at=` in the past, the time-lapse, a wrong clock) is
 * dropped; a stale one stays, and the page labels it (the same rule as the plants).
 */
export function sceneWeather(byRegion: RegionalWeather, nowMs: number): RegionalWeather {
  const shown: Partial<Record<RegionCode, WeatherReading>> = {};
  for (const region of REGION_CODES) {
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
 * The same imposed weather for every region, dated `timeMs` (the clock's time, so
 * that it always shows). `isDay` is left true: the scene takes its light from the
 * sun (src/sky/light.ts), never from this field.
 */
export function overrideWeather(group: WeatherGroup, timeMs: number): RegionalWeather {
  const all: Partial<Record<RegionCode, WeatherReading>> = {};
  for (const region of REGION_CODES) {
    // At each region's prefecture, at sea level, so that snow on the ground shows
    // around it whatever the ground's height.
    const point = referencePoint(region);
    all[region] = {
      timeMs,
      latitude: point?.latitude ?? 0,
      longitude: point?.longitude ?? 0,
      elevationM: 0,
      group,
      ...OVERRIDES[group],
      ...OVERRIDE_WIND,
      isDay: true,
    };
  }
  return all;
}
