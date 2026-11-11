/**
 * What the debug page lists: every live figure with its field, its source and the
 * time it describes (B-007). Pure: the page passes the readings and the clock's
 * time, and gets back sections of text, so the listing is tested without a DOM.
 *
 * Labels are the API's own field names, unchanged in every language: they are what
 * a figure is traced back to (ARCHITECTURE § Data sources), not prose.
 */
import { freshness, type Eco2mixArea, type Eco2mixResult } from "../data/eco2mix";
import { weatherFreshness, type RoundedPosition, type WeatherResult } from "../data/open-meteo";
import type { Locale, MessageKey } from "../i18n";
import { moonPhase } from "../sky/moon";
import { sunPosition } from "../sky/sun";

export interface FigureRow {
  /** The API field, or the computed quantity, the value comes from. */
  readonly field: string;
  readonly value: string;
}

export interface FigureSection {
  readonly title: MessageKey;
  /** Where the figures come from: a dataset, an API, or an algorithm. */
  readonly source: string;
  /** The instant the figures describe, as the source gives it; null when there are none. */
  readonly time: string | null;
  /** Minutes between that instant and now; null when there is no reading. */
  readonly ageMinutes: number | null;
  readonly status: MessageKey;
  /** The failure reason, as the client reports it ("timeout", "HTTP 429", …). */
  readonly detail: string | null;
  readonly rows: readonly FigureRow[];
}

/** A reading still on its way, or not asked for. */
export type Pending = "loading" | "none";

export interface LiveInputs {
  readonly area: Eco2mixArea;
  /** The rounded point the weather and the sky are computed for; null nationally. */
  readonly point: RoundedPosition | null;
  readonly eco2mix: Eco2mixResult | Pending;
  readonly weather: WeatherResult | Pending;
  readonly nowMs: number;
  readonly locale: Locale;
}

function number(locale: Locale, value: number, digits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

/** An instant as ISO 8601 UTC, to the second. */
function iso(timeMs: number): string {
  return new Date(timeMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Whole minutes since `timeMs`. A reading up to 15 minutes ahead of the clock still
 * counts as fresh (clock skew), and reads as 0 minutes old, never negative.
 */
function ageMinutes(timeMs: number, nowMs: number): number | null {
  const age = Math.round((nowMs - timeMs) / 60_000);
  return Number.isFinite(age) ? Math.max(0, age) : null;
}

/** The rounded point, as the sources that use it are labelled. */
function where(point: RoundedPosition): string {
  return `${point.latitude.toFixed(1)}, ${point.longitude.toFixed(1)}`;
}

const STATUS: Readonly<Record<"fresh" | "stale" | "future", MessageKey>> = {
  fresh: "debugFresh",
  stale: "debugStale",
  future: "debugFuture",
};

/** A section without figures: still loading, nothing to ask, or the failure reason. */
function empty(
  title: MessageKey,
  source: string,
  state: { readonly pending: Pending } | { readonly reason: string },
): FigureSection {
  const status: MessageKey =
    "reason" in state
      ? "debugUnavailable"
      : state.pending === "loading"
        ? "debugLoading"
        : "debugNoPoint";
  return {
    title,
    source,
    time: null,
    ageMinutes: null,
    status,
    detail: "reason" in state ? state.reason : null,
    rows: [],
  };
}

/**
 * A reading dated ahead of the clock counts as unavailable (ARCHITECTURE § Data
 * sources): its time is shown, so the fault can be traced, but none of its figures.
 */
function future(title: MessageKey, source: string, time: string): FigureSection {
  return { title, source, time, ageMinutes: null, status: "debugFuture", detail: null, rows: [] };
}

function eco2mixSection(inputs: LiveInputs): FigureSection {
  const { area, locale } = inputs;
  const source =
    area === "FR"
      ? "RTE éCO2mix, ODRÉ eco2mix-national-tr (DS-02)"
      : `RTE éCO2mix, ODRÉ eco2mix-regional-tr (DS-01), code_insee_region = ${area}`;
  const result = inputs.eco2mix;
  if (result === "loading" || result === "none")
    return empty("debugEco2mix", source, { pending: result });
  if (!result.ok) return empty("debugEco2mix", source, { reason: result.reason });
  const r = result.reading;
  if (freshness(r, inputs.nowMs) === "future") return future("debugEco2mix", source, r.time);
  const mw = (field: string, value: number): FigureRow => ({
    field,
    value: `${number(locale, value)} MW`,
  });
  const rows: FigureRow[] = [
    mw("consommation", r.consumptionMw),
    mw(area === "FR" ? "gaz + fioul + charbon" : "thermique", r.productionMw.thermal),
    mw("nucleaire", r.productionMw.nuclear),
    mw("eolien", r.productionMw.wind),
    mw("solaire", r.productionMw.solar),
    mw("hydraulique", r.productionMw.hydro),
    mw("bioenergies", r.productionMw.bioenergy),
    mw("ech_physiques", r.exchangesMw),
    mw("pompage", r.pumpingMw),
    mw("stockage_batterie", r.batteryChargeMw),
    mw("destockage_batterie", r.batteryDischargeMw),
  ];
  if (area !== "FR") {
    const tch: readonly [string, number | null][] = [
      ["tch_thermique", r.loadFactorPct.thermal],
      ["tch_nucleaire", r.loadFactorPct.nuclear],
      ["tch_eolien", r.loadFactorPct.wind],
      ["tch_solaire", r.loadFactorPct.solar],
      ["tch_hydraulique", r.loadFactorPct.hydro],
      ["tch_bioenergies", r.loadFactorPct.bioenergy],
    ];
    // `null` is what the API sends where the area has no such capacity: shown as is.
    for (const [field, value] of tch)
      rows.push({ field, value: value === null ? "null" : `${number(locale, value, 1)} %` });
  }
  return {
    title: "debugEco2mix",
    source,
    time: r.time,
    ageMinutes: ageMinutes(r.timeMs, inputs.nowMs),
    status: STATUS[freshness(r, inputs.nowMs)],
    detail: null,
    rows,
  };
}

function weatherSection(inputs: LiveInputs): FigureSection {
  const { point, locale } = inputs;
  const source = point === null ? "Open-Meteo (DS-03)" : `Open-Meteo (DS-03), ${where(point)}`;
  if (point === null) return empty("debugWeather", source, { pending: "none" });
  const result = inputs.weather;
  if (result === "loading" || result === "none")
    return empty("debugWeather", source, { pending: result });
  if (!result.ok) return empty("debugWeather", source, { reason: result.reason });
  const r = result.reading;
  if (weatherFreshness(r, inputs.nowMs) === "future")
    return future("debugWeather", source, iso(r.timeMs));
  const n = (value: number, unit: string, digits = 1): string =>
    `${number(locale, value, digits)} ${unit}`;
  return {
    title: "debugWeather",
    source,
    time: iso(r.timeMs),
    ageMinutes: ageMinutes(r.timeMs, inputs.nowMs),
    status: STATUS[weatherFreshness(r, inputs.nowMs)],
    detail: null,
    rows: [
      { field: "temperature_2m", value: n(r.temperatureC, "°C") },
      { field: "weather_code", value: String(r.weatherCode) },
      { field: "cloud_cover", value: n(r.cloudCoverPct, "%", 0) },
      { field: "precipitation", value: n(r.precipitationMm, "mm") },
      { field: "snowfall", value: n(r.snowfallCm, "cm", 2) },
      { field: "snow_depth", value: n(r.snowDepthM, "m", 2) },
      { field: "wind_speed_10m", value: n(r.windSpeedKmh, "km/h") },
      { field: "wind_direction_10m", value: n(r.windFromDeg, "°", 0) },
      { field: "is_day", value: r.isDay ? "1" : "0" },
    ],
  };
}

function sunSection(inputs: LiveInputs): FigureSection {
  const { point, locale, nowMs } = inputs;
  const source = point === null ? "NOAA (S-008)" : `NOAA (S-008), ${where(point)}`;
  if (point === null) return empty("debugSun", source, { pending: "none" });
  const sun = sunPosition(nowMs, point.latitude, point.longitude);
  if (sun === null) return empty("debugSun", source, { reason: "no clock" });
  const deg = (value: number): string => `${number(locale, value, 2)}°`;
  return {
    title: "debugSun",
    source,
    time: iso(nowMs),
    ageMinutes: null,
    status: "debugComputed",
    detail: null,
    rows: [
      { field: "elevation", value: deg(sun.elevationDeg) },
      { field: "geometricElevation", value: deg(sun.geometricElevationDeg) },
      { field: "azimuth", value: deg(sun.azimuthDeg) },
    ],
  };
}

function moonSection(inputs: LiveInputs): FigureSection {
  const { locale, nowMs } = inputs;
  const source = "Meeus, Astronomical Algorithms, ch. 49";
  const moon = moonPhase(nowMs);
  if (moon === null) return empty("debugMoon", source, { reason: "no clock" });
  return {
    title: "debugMoon",
    source,
    time: iso(nowMs),
    ageMinutes: null,
    status: "debugComputed",
    detail: null,
    rows: [
      { field: "ageDays", value: number(locale, moon.ageDays, 1) },
      { field: "illuminated", value: `${number(locale, moon.illuminated * 100, 0)} %` },
    ],
  };
}

/** The sections of the debug page, in display order. */
export function liveFigures(inputs: LiveInputs): readonly FigureSection[] {
  return [eco2mixSection(inputs), weatherSection(inputs), sunSection(inputs), moonSection(inputs)];
}
