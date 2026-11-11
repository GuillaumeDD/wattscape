/**
 * RTE éCO2mix real-time client (ODRÉ datasets DS-01 regional, DS-02 national).
 *
 * Field names, types, the sign of `ech_physiques` and how missing values look were
 * checked against recorded responses (tests/fixtures/eco2mix/, S-003, S-009); see
 * ARCHITECTURE § Data sources for every caveat. The parser is the trust boundary: it
 * accepts only that shape and returns "unavailable" for anything else, never throws.
 */

/** INSEE codes of the 12 mainland regions in the regional dataset (Corsica is absent). */
export const REGION_CODES = [
  "11",
  "24",
  "27",
  "28",
  "32",
  "44",
  "52",
  "53",
  "75",
  "76",
  "84",
  "93",
] as const;

export type RegionCode = (typeof REGION_CODES)[number];

/** What éCO2mix is asked about: one region, or the whole of France. */
export type Eco2mixArea = RegionCode | "FR";

export function isEco2mixArea(value: unknown): value is Eco2mixArea {
  return value === "FR" || REGION_CODES.some((code) => code === value);
}

/** The six technologies the scene draws (PRD § Data-to-scene mapping). */
export const SOURCES = ["thermal", "nuclear", "wind", "solar", "hydro", "bioenergy"] as const;
export type Source = (typeof SOURCES)[number];

export interface Eco2mixReading {
  readonly area: Eco2mixArea;
  /** Start of the 15-minute step, as given by the API (ISO 8601, UTC offset). */
  readonly time: string;
  /** Same instant, in milliseconds since the epoch. */
  readonly timeMs: number;
  /** Consumption, MW. */
  readonly consumptionMw: number;
  /**
   * Production per technology, MW. 0 also when the area has no such plant. Never
   * negative in 10 weeks of real data; a negative figure is rejected, since it would
   * break the shares of the mix.
   */
  readonly productionMw: Readonly<Record<Source, number>>;
  /**
   * Load factor (TCH) per technology, %: production over installed capacity. `null`
   * when the area has no such capacity (a region without a nuclear plant), and
   * always `null` nationally, where the dataset has no TCH column. Can exceed 100
   * (up to 125 % seen) when the capacity reference lags new installations.
   */
  readonly loadFactorPct: Readonly<Record<Source, number | null>>;
  /** Net physical exchanges, MW: positive = the area imports, negative = it exports. */
  readonly exchangesMw: number;
  /** Power drawn by pumped-storage pumps, MW, ≤ 0 (API sign kept). */
  readonly pumpingMw: number;
  /** Power drawn to charge batteries, MW, ≤ 0 (API sign kept). */
  readonly batteryChargeMw: number;
  /** Power given back by batteries, MW, ≥ 0. */
  readonly batteryDischargeMw: number;
}

export type Eco2mixResult =
  | { readonly ok: true; readonly reading: Eco2mixReading }
  | { readonly ok: false; readonly reason: string };

const API = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets";

/**
 * The URL of the latest published step for an area. Rows for the rest of the day
 * exist but are empty, hence the filter on `consommation`.
 */
export function eco2mixUrl(area: Eco2mixArea): string {
  const dataset = area === "FR" ? "eco2mix-national-tr" : "eco2mix-regional-tr";
  const where =
    area === "FR"
      ? "consommation is not null"
      : `code_insee_region = "${area}" and consommation is not null`;
  const params = new URLSearchParams({ where, order_by: "date_heure desc", limit: "1" });
  return `${API}/${dataset}/records?${params.toString()}`;
}

// Bounds of the security boundary (ARCHITECTURE § Security).
const MAX_ABS_MW = 200_000;
const MAX_LOAD_FACTOR_PCT = 200;
const MAX_STRING = 64;

class Invalid extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A MW figure. The API sends some columns as JSON numbers and others as text
 * (`pompage`, battery columns regionally, `hydraulique_fil_eau_eclusee`
 * nationally), so both are accepted, text only as a plain integer or decimal.
 */
function mw(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.length <= MAX_STRING && /^-?\d+(\.\d+)?$/.test(value))
    n = Number(value);
  else throw new Invalid(`${key}: not a number`);
  if (!Number.isFinite(n) || Math.abs(n) > MAX_ABS_MW) throw new Invalid(`${key}: out of range`);
  return n;
}

function signedMw(row: Record<string, unknown>, key: string, sign: 1 | -1): number {
  const n = mw(row, key);
  if (n * sign < 0) throw new Invalid(`${key}: wrong sign`);
  return n;
}

function loadFactor(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Invalid(`${key}: not a number`);
  if (value < 0 || value > MAX_LOAD_FACTOR_PCT) throw new Invalid(`${key}: out of range`);
  return value;
}

const ISO_STEP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(00|15|30|45):00(\+00:00|Z)$/;

function stepTime(row: Record<string, unknown>): { time: string; timeMs: number } {
  const value = row.date_heure;
  if (typeof value !== "string" || !ISO_STEP.test(value))
    throw new Invalid("date_heure: bad format");
  const timeMs = Date.parse(value);
  if (!Number.isFinite(timeMs)) throw new Invalid("date_heure: not a date");
  // Reject impossible dates that Date.parse would roll over (2026-02-30).
  if (new Date(timeMs).toISOString().slice(0, 16) !== value.slice(0, 16))
    throw new Invalid("date_heure: not a date");
  return { time: value, timeMs };
}

function parseRow(area: Eco2mixArea, row: Record<string, unknown>): Eco2mixReading {
  if (area === "FR") {
    if (row.perimetre !== "France") throw new Invalid("perimetre: not France");
  } else if (row.code_insee_region !== area) {
    throw new Invalid("code_insee_region: not the requested region");
  }
  const { time, timeMs } = stepTime(row);
  const thermal =
    area === "FR"
      ? signedMw(row, "gaz", 1) + signedMw(row, "fioul", 1) + signedMw(row, "charbon", 1)
      : signedMw(row, "thermique", 1);
  if (thermal > MAX_ABS_MW) throw new Invalid("thermal: out of range");
  const productionMw: Record<Source, number> = {
    thermal,
    nuclear: signedMw(row, "nucleaire", 1),
    wind: signedMw(row, "eolien", 1),
    solar: signedMw(row, "solaire", 1),
    hydro: signedMw(row, "hydraulique", 1),
    bioenergy: signedMw(row, "bioenergies", 1),
  };
  const loadFactorPct: Record<Source, number | null> =
    area === "FR"
      ? { thermal: null, nuclear: null, wind: null, solar: null, hydro: null, bioenergy: null }
      : {
          thermal: loadFactor(row, "tch_thermique"),
          nuclear: loadFactor(row, "tch_nucleaire"),
          wind: loadFactor(row, "tch_eolien"),
          solar: loadFactor(row, "tch_solaire"),
          hydro: loadFactor(row, "tch_hydraulique"),
          bioenergy: loadFactor(row, "tch_bioenergies"),
        };
  return {
    area,
    time,
    timeMs,
    consumptionMw: signedMw(row, "consommation", 1),
    productionMw,
    loadFactorPct,
    exchangesMw: mw(row, "ech_physiques"),
    pumpingMw: signedMw(row, "pompage", -1),
    batteryChargeMw: signedMw(row, "stockage_batterie", -1),
    batteryDischargeMw: signedMw(row, "destockage_batterie", 1),
  };
}

/** Parses the body of {@link eco2mixUrl}'s answer. Never throws. */
export function parseEco2mix(area: Eco2mixArea, body: unknown): Eco2mixResult {
  try {
    if (!isRecord(body) || !Array.isArray(body.results)) throw new Invalid("not a records answer");
    const row: unknown = body.results[0];
    if (!isRecord(row)) throw new Invalid("no published step");
    return { ok: true, reading: parseRow(area, row) };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, reason: error.message };
    return { ok: false, reason: "unexpected parser error" };
  }
}

/**
 * How old a reading may get before the scene labels it stale. RTE publishes the
 * regional steps about an hour late, refreshed hourly (S-004, and a lag of 63 min
 * measured on 2026-11-11), so a healthy regional reading can be nearly 2 h old.
 * Provisional: to be checked over a longer run.
 */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/** A step dated more than this ahead of the clock is absurd: the scene must not show it. */
const MAX_CLOCK_SKEW_MS = 15 * 60 * 1000;

export type Freshness = "fresh" | "stale" | "future";

/**
 * Classifies a reading against the injected clock's `nowMs`. Only "fresh" and
 * "stale" readings may be shown; "future" counts as unavailable. A non-finite clock
 * gives "stale", never "fresh".
 */
export function freshness(reading: Eco2mixReading, nowMs: number): Freshness {
  const age = nowMs - reading.timeMs;
  if (!Number.isFinite(age)) return "stale";
  if (age < -MAX_CLOCK_SKEW_MS) return "future";
  return age > STALE_AFTER_MS ? "stale" : "fresh";
}

/** A request that has not finished by then is given up. */
export const FETCH_TIMEOUT_MS = 30_000;

/** The answer is one row of about 1 KB; anything much larger is not ours. */
const MAX_BODY_CHARS = 64 * 1024;

/**
 * Fetches and parses the latest step. Every failure becomes "unavailable" with a
 * reason; "aborted" means the caller cancelled (the area changed, the tab was
 * hidden), so it must not be shown as an outage.
 */
export async function fetchEco2mix(
  area: Eco2mixArea,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<Eco2mixResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  const cancel = (): void => {
    controller.abort();
  };
  signal?.addEventListener("abort", cancel);
  if (signal?.aborted) controller.abort();
  const failed = (reason: string): Eco2mixResult => ({
    ok: false,
    reason: signal?.aborted ? "aborted" : reason,
  });
  try {
    let response: Response;
    try {
      response = await fetchFn(eco2mixUrl(area), {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
    } catch {
      return failed(controller.signal.aborted ? "timeout" : "network error");
    }
    if (!response.ok) return failed(`HTTP ${String(response.status)}`);
    let text: string;
    try {
      text = await response.text();
    } catch {
      return failed(controller.signal.aborted ? "timeout" : "network error");
    }
    if (text.length > MAX_BODY_CHARS) return failed("answer too large");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return failed("not JSON");
    }
    return signal?.aborted ? failed("aborted") : parseEco2mix(area, body);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
