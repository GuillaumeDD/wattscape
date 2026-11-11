import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEco2mix, type Eco2mixResult } from "../src/data/eco2mix";
import {
  parseOpenMeteo,
  roundPosition,
  type RoundedPosition,
  type WeatherResult,
} from "../src/data/open-meteo";
import { liveFigures, type FigureSection, type LiveInputs } from "../src/ui/live-figures";

// Real answers recorded on 2026-11-11 (tests/fixtures, DS-01, DS-02, DS-03).
function raw(path: string): unknown {
  return JSON.parse(readFileSync(`tests/fixtures/${path}.json`, "utf8"));
}
function firstRow(path: string): Record<string, unknown> {
  return (raw(path) as { results: Record<string, unknown>[] }).results[0] ?? {};
}

const ROUEN = roundPosition(49.44, 1.095) as RoundedPosition;
const normandie: Eco2mixResult = parseEco2mix("28", raw("eco2mix/2026-11-11-normandie"));
const national: Eco2mixResult = parseEco2mix("FR", raw("eco2mix/2026-11-11-national"));
const rouenWeather: WeatherResult = parseOpenMeteo(ROUEN, raw("open-meteo/2026-11-11-rouen"));
const STEP_MS = Date.parse("2026-11-11T07:45:00+00:00");

function sections(overrides: Partial<LiveInputs>): readonly FigureSection[] {
  return liveFigures({
    area: "28",
    point: ROUEN,
    eco2mix: normandie,
    weather: rouenWeather,
    nowMs: STEP_MS + 63 * 60_000,
    locale: "en",
    ...overrides,
  });
}

function section(list: readonly FigureSection[], title: string): FigureSection {
  const found = list.find((s) => s.title === title);
  if (found === undefined) throw new Error(`no section ${title}`);
  return found;
}

describe("liveFigures, power grid", () => {
  it("fixtures parse (guard for the tests below)", () => {
    expect(normandie.ok && national.ok && rouenWeather.ok).toBe(true);
  });

  it("lists every regional figure under its API field name, with the dataset and step time", () => {
    const s = section(sections({}), "debugEco2mix");
    expect(s.source).toContain("eco2mix-regional-tr");
    expect(s.source).toContain("code_insee_region = 28");
    expect(s.time).toBe("2026-11-11T07:45:00+00:00");
    expect(s.ageMinutes).toBe(63);
    expect(s.status).toBe("debugFresh");
    expect(s.rows.map((r) => r.field)).toEqual([
      "consommation",
      "thermique",
      "nucleaire",
      "eolien",
      "solaire",
      "hydraulique",
      "bioenergies",
      "ech_physiques",
      "pompage",
      "stockage_batterie",
      "destockage_batterie",
      "tch_thermique",
      "tch_nucleaire",
      "tch_eolien",
      "tch_solaire",
      "tch_hydraulique",
      "tch_bioenergies",
    ]);
  });

  it("every field it names exists in the recorded answer, with the value shown", () => {
    const row = firstRow("eco2mix/2026-11-11-normandie");
    for (const r of section(sections({}), "debugEco2mix").rows) {
      expect(Object.keys(row)).toContain(r.field);
      const value = row[r.field];
      if (value === null) expect(r.value).toBe("null");
      else
        expect(r.value.replace(/[^\d.-]/g, "")).toBe(
          String(Math.round(Number(value) * 10) / 10)
            .replace(/\.0$/, "")
            .replace(/,/g, ""),
        );
    }
  });

  it("nationally, names the three thermal fields summed and shows no load factor", () => {
    const s = section(sections({ area: "FR", point: null, eco2mix: national }), "debugEco2mix");
    expect(s.source).toContain("eco2mix-national-tr");
    const fields = s.rows.map((r) => r.field);
    expect(fields).toContain("gaz + fioul + charbon");
    expect(fields.some((f) => f.startsWith("tch_"))).toBe(false);
    const row = firstRow("eco2mix/2026-11-11-national");
    for (const field of fields.flatMap((f) => f.split(" + ")))
      expect(Object.keys(row)).toContain(field);
  });

  it("labels a stale step and still shows it", () => {
    const s = section(sections({ nowMs: STEP_MS + 4 * 3_600_000 }), "debugEco2mix");
    expect(s.status).toBe("debugStale");
    expect(s.rows).toHaveLength(17);
  });

  it("shows the time of a step dated in the future, but none of its figures", () => {
    // Regression: the first version listed the figures of a future step, and a
    // negative age ("-60 min ago"), though such a reading counts as unavailable.
    const s = section(sections({ nowMs: STEP_MS - 3_600_000 }), "debugEco2mix");
    expect(s.status).toBe("debugFuture");
    expect(s.time).toBe("2026-11-11T07:45:00+00:00");
    expect(s.rows).toEqual([]);
    expect(s.ageMinutes).toBeNull();
  });

  it("shows no figure while loading or after a failure, and says why", () => {
    const loading = section(sections({ eco2mix: "loading" }), "debugEco2mix");
    expect(loading.status).toBe("debugLoading");
    expect(loading.rows).toEqual([]);
    expect(loading.time).toBeNull();
    const failed = section(sections({ eco2mix: { ok: false, reason: "timeout" } }), "debugEco2mix");
    expect(failed.status).toBe("debugUnavailable");
    expect(failed.detail).toBe("timeout");
    expect(failed.rows).toEqual([]);
  });

  it("formats numbers in the page's language", () => {
    const fr = section(sections({ locale: "fr" }), "debugEco2mix").rows[0]?.value;
    const en = section(sections({ locale: "en" }), "debugEco2mix").rows[0]?.value;
    const mw = normandie.ok ? normandie.reading.consumptionMw : NaN;
    expect(fr).toBe(`${new Intl.NumberFormat("fr").format(mw)} MW`);
    expect(en).toBe(`${new Intl.NumberFormat("en").format(mw)} MW`);
  });
});

describe("liveFigures, weather", () => {
  it("lists every current field at the rounded reference point, with its time", () => {
    const s = section(sections({ nowMs: Date.parse("2026-11-11T15:10:00Z") }), "debugWeather");
    expect(s.status).toBe("debugFresh");
    expect(s.ageMinutes).toBe(10);
    expect(s.source).toContain("49.4, 1.1");
    expect(s.time).toBe("2026-11-11T15:00:00Z");
    const current = (raw("open-meteo/2026-11-11-rouen") as { current: Record<string, unknown> })
      .current;
    for (const r of s.rows) expect(Object.keys(current)).toContain(r.field);
    expect(s.rows).toHaveLength(9);
    expect(s.rows.find((r) => r.field === "weather_code")?.value).toBe("3");
  });

  it("has no point, and asks nothing, for the whole of France", () => {
    const s = section(sections({ area: "FR", point: null, weather: "none" }), "debugWeather");
    expect(s.status).toBe("debugNoPoint");
    expect(s.rows).toEqual([]);
  });

  it("shows none of the figures of a reading dated in the future", () => {
    // The Rouen answer describes 15:00 UTC; at 08:48 it is six hours ahead.
    const s = section(sections({ nowMs: Date.parse("2026-11-11T08:48:00Z") }), "debugWeather");
    expect(s.status).toBe("debugFuture");
    expect(s.time).toBe("2026-11-11T15:00:00Z");
    expect(s.rows).toEqual([]);
    expect(s.ageMinutes).toBeNull();
  });

  it("reads 0 min old, never a negative age, for a reading slightly ahead of the clock", () => {
    // Regression: 10 min ahead is within the tolerated skew, so "fresh", and the page
    // printed "-10 min ago".
    const s = section(sections({ nowMs: Date.parse("2026-11-11T14:50:00Z") }), "debugWeather");
    expect(s.status).toBe("debugFresh");
    expect(s.ageMinutes).toBe(0);
  });

  it("reports a failure such as the quota", () => {
    const s = section(sections({ weather: { ok: false, reason: "HTTP 429" } }), "debugWeather");
    expect(s.status).toBe("debugUnavailable");
    expect(s.detail).toBe("HTTP 429");
  });
});

describe("liveFigures, sun and moon", () => {
  it("gives the sun at the point, computed for now", () => {
    const s = section(sections({}), "debugSun");
    expect(s.status).toBe("debugComputed");
    expect(s.source).toBe("NOAA (S-008), 49.4, 1.1");
    expect(s.time).toBe("2026-11-11T08:48:00Z");
    expect(s.rows.map((r) => r.field)).toEqual(["elevation", "geometricElevation", "azimuth"]);
  });

  it("credits the moon to its own model, not to NOAA", () => {
    const s = section(sections({}), "debugMoon");
    expect(s.source).not.toContain("NOAA");
    expect(s.rows.map((r) => r.field)).toEqual(["ageDays", "illuminated"]);
  });

  it("has no sun for the whole of France, but still the moon", () => {
    const list = sections({ area: "FR", point: null });
    expect(section(list, "debugSun").status).toBe("debugNoPoint");
    expect(section(list, "debugSun").rows).toEqual([]);
    expect(section(list, "debugMoon").rows).toHaveLength(2);
  });

  it("shows nothing for a broken clock rather than a made-up sky", () => {
    for (const title of ["debugSun", "debugMoon"]) {
      const s = section(sections({ nowMs: Number.NaN }), title);
      expect(s.rows).toEqual([]);
      expect(s.time).toBeNull();
      expect(s.status).toBe("debugUnavailable");
    }
  });
});
