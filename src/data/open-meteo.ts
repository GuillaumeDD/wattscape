/**
 * Open-Meteo current weather client (DS-03).
 *
 * The position is rounded to 0.1° before it leaves this module, and only the rounded
 * value is ever put in a URL (ARCHITECTURE § Privacy). Field names, units and the
 * WMO codes were checked against recorded answers (tests/fixtures/open-meteo/) and
 * the API's own code list (S-010). The parser is the trust boundary: it accepts only
 * that shape and returns "unavailable" for anything else, never throws.
 */
import { fetchJson, Invalid, isRecord, safely, type Result } from "./fetch-json";

declare const rounded: unique symbol;

/**
 * A position in degrees that went through {@link roundPosition}: the brand makes
 * the type system refuse a raw GPS position here.
 */
export interface RoundedPosition {
  readonly latitude: number;
  readonly longitude: number;
  readonly [rounded]: true;
}

/**
 * Rounds a position to 0.1° (about 10 km), the only precision that may be sent.
 * `null` for a position that is not a finite latitude/longitude.
 */
export function roundPosition(latitude: number, longitude: number): RoundedPosition | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  // `+ 0` turns -0 into 0. The URL prints the value with toFixed(1), so float noise
  // (48.900000001) never reaches it.
  const tenths = (x: number): number => Math.round(x * 10) / 10 + 0;
  return { latitude: tenths(latitude), longitude: tenths(longitude) } as RoundedPosition;
}

/** What the scene draws, grouped from the WMO code (ARCHITECTURE § Open-Meteo). */
export const WEATHER_GROUPS = [
  "clear",
  "cloudy",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "storm",
] as const;
export type WeatherGroup = (typeof WEATHER_GROUPS)[number];

/**
 * Every code the API can send (S-010: the `WeatherCode` enum of the API, plus 97,
 * which the documentation lists), with its group. Freezing drizzle and rain stay
 * drizzle and rain; snow grains are snow; hail is a storm.
 */
const WMO_GROUPS: ReadonlyMap<number, WeatherGroup> = new Map([
  [0, "clear"],
  [1, "clear"],
  [2, "cloudy"],
  [3, "cloudy"],
  [45, "fog"],
  [48, "fog"],
  [51, "drizzle"],
  [53, "drizzle"],
  [55, "drizzle"],
  [56, "drizzle"],
  [57, "drizzle"],
  [61, "rain"],
  [63, "rain"],
  [65, "rain"],
  [66, "rain"],
  [67, "rain"],
  [80, "rain"],
  [81, "rain"],
  [82, "rain"],
  [71, "snow"],
  [73, "snow"],
  [75, "snow"],
  [77, "snow"],
  [85, "snow"],
  [86, "snow"],
  [95, "storm"],
  [96, "storm"],
  [97, "storm"],
  [99, "storm"],
]);

/** The group of a WMO code, or `undefined` for a code the API does not send. */
export function weatherGroup(code: number): WeatherGroup | undefined {
  return WMO_GROUPS.get(code);
}

export interface WeatherReading {
  /** Start of the current 15-minute interval, ms since the epoch (UTC). */
  readonly timeMs: number;
  readonly temperatureC: number;
  readonly weatherCode: number;
  readonly group: WeatherGroup;
  /** Total cloud cover, % (0–100). */
  readonly cloudCoverPct: number;
  /**
   * Precipitation (rain, showers, snow), mm. Over the preceding hour for hourly data
   * (S-010); over which window for `current` is unverified (ARCHITECTURE).
   */
  readonly precipitationMm: number;
  /** Snowfall, cm; same window caveat as precipitation. */
  readonly snowfallCm: number;
  /** Snow on the ground, m. */
  readonly snowDepthM: number;
  /** Wind speed at 10 m, km/h. */
  readonly windSpeedKmh: number;
  /** Direction the wind blows from at 10 m, degrees (0 = from the north). */
  readonly windFromDeg: number;
  /** Whether it is daylight at the grid point, by the API. */
  readonly isDay: boolean;
}

export type WeatherResult = Result<WeatherReading>;

const API = "https://api.open-meteo.com/v1/forecast";

/** The fields asked for, in this order (ARCHITECTURE § Open-Meteo). */
const CURRENT = [
  "temperature_2m",
  "weather_code",
  "cloud_cover",
  "precipitation",
  "snowfall",
  "snow_depth",
  "wind_speed_10m",
  "wind_direction_10m",
  "is_day",
] as const;

/** The URL of the current weather at a rounded position. */
export function openMeteoUrl(position: RoundedPosition): string {
  const params = new URLSearchParams({
    latitude: position.latitude.toFixed(1),
    longitude: position.longitude.toFixed(1),
    current: CURRENT.join(","),
    timeformat: "unixtime",
  });
  return `${API}?${params.toString()}`;
}

function inRange(row: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Invalid(`${key}: not a number`);
  if (value < min || value > max) throw new Invalid(`${key}: out of range`);
  return value;
}

/** Units the parser relies on; a change of unit must not slip through as a value. */
const UNITS: Readonly<Record<string, string>> = {
  time: "unixtime",
  interval: "seconds",
  temperature_2m: "°C",
  weather_code: "wmo code",
  cloud_cover: "%",
  precipitation: "mm",
  snowfall: "cm",
  snow_depth: "m",
  wind_speed_10m: "km/h",
  wind_direction_10m: "°",
};

/** How far the answer's grid point may be from the position asked, degrees. */
const MAX_GRID_OFFSET_DEG = 0.5;

function parseBody(position: RoundedPosition, body: unknown): WeatherReading {
  if (!isRecord(body)) throw new Invalid("not an object");
  if (body.error === true) throw new Invalid("API error");
  const latitude = inRange(body, "latitude", -90, 90);
  const longitude = inRange(body, "longitude", -180, 180);
  if (
    Math.abs(latitude - position.latitude) > MAX_GRID_OFFSET_DEG ||
    Math.abs(longitude - position.longitude) > MAX_GRID_OFFSET_DEG
  )
    throw new Invalid("not the position asked");
  const units = body.current_units;
  if (!isRecord(units)) throw new Invalid("current_units: missing");
  for (const [key, unit] of Object.entries(UNITS)) {
    if (units[key] !== unit) throw new Invalid(`${key}: unexpected unit`);
  }
  const current = body.current;
  if (!isRecord(current)) throw new Invalid("current: missing");
  // Seconds since the epoch, on a 15-minute boundary, between 2020 and 2100.
  if (current.interval !== 900) throw new Invalid("interval: not 15 minutes");
  const time = inRange(current, "time", 1_577_836_800, 4_102_444_800);
  if (!Number.isInteger(time) || time % 900 !== 0) throw new Invalid("time: not a 15-min step");
  const weatherCode = inRange(current, "weather_code", 0, 99);
  const group = Number.isInteger(weatherCode) ? weatherGroup(weatherCode) : undefined;
  if (group === undefined) throw new Invalid("weather_code: unknown code");
  const isDay = current.is_day;
  if (isDay !== 0 && isDay !== 1) throw new Invalid("is_day: not 0 or 1");
  return {
    timeMs: time * 1000,
    temperatureC: inRange(current, "temperature_2m", -80, 60),
    weatherCode,
    group,
    cloudCoverPct: inRange(current, "cloud_cover", 0, 100),
    precipitationMm: inRange(current, "precipitation", 0, 500),
    snowfallCm: inRange(current, "snowfall", 0, 500),
    snowDepthM: inRange(current, "snow_depth", 0, 50),
    windSpeedKmh: inRange(current, "wind_speed_10m", 0, 500),
    windFromDeg: inRange(current, "wind_direction_10m", 0, 360),
    isDay: isDay === 1,
  };
}

/** Parses the body of {@link openMeteoUrl}'s answer. Never throws. */
export function parseOpenMeteo(position: RoundedPosition, body: unknown): WeatherResult {
  return safely(() => parseBody(position, body));
}

/** The answer is about 600 bytes; anything much larger is not ours. */
const MAX_BODY_CHARS = 16 * 1024;

/**
 * How old a weather reading may get before the scene labels it stale: four missed
 * 15-minute refreshes. Provisional (D-010).
 */
export const WEATHER_STALE_AFTER_MS = 60 * 60 * 1000;

/** A reading dated more than this ahead of the clock is absurd: not shown. */
const MAX_CLOCK_SKEW_MS = 15 * 60 * 1000;

/**
 * Classifies a reading against the injected clock's `nowMs`. Only "fresh" and
 * "stale" readings may be shown; "future" counts as unavailable. A non-finite clock
 * gives "stale", never "fresh".
 */
export function weatherFreshness(
  reading: WeatherReading,
  nowMs: number,
): "fresh" | "stale" | "future" {
  const age = nowMs - reading.timeMs;
  if (!Number.isFinite(age)) return "stale";
  if (age < -MAX_CLOCK_SKEW_MS) return "future";
  return age > WEATHER_STALE_AFTER_MS ? "stale" : "fresh";
}

/** Fetches and parses the current weather (failures: see {@link fetchJson}). */
export function fetchOpenMeteo(
  position: RoundedPosition,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<WeatherResult> {
  return fetchJson(
    openMeteoUrl(position),
    MAX_BODY_CHARS,
    (body) => parseOpenMeteo(position, body),
    fetchFn,
    signal,
  );
}
