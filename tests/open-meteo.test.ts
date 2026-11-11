import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchOpenMeteo,
  openMeteoUrl,
  parseOpenMeteo,
  roundPosition,
  weatherFreshness,
  weatherGroup,
  WEATHER_STALE_AFTER_MS,
  WEATHER_GROUPS,
  type RoundedPosition,
  type WeatherReading,
} from "../src/data/open-meteo";
import { FETCH_TIMEOUT_MS } from "../src/data/fetch-json";

/** A position through roundPosition, the only way to get the branded type. */
function pos(latitude: number, longitude: number): RoundedPosition {
  const p = roundPosition(latitude, longitude);
  if (p === null) throw new Error("bad position");
  return p;
}

// Real answers recorded on 2026-11-11 by tools/record-open-meteo.ts (DS-03), at
// landmarks: Rouen cathedral, the Mont Blanc summit, Pointe du Raz.
const DIR = "tests/fixtures/open-meteo";
const FIXTURES: Record<string, RoundedPosition> = {
  "2026-11-11-rouen": pos(49.44, 1.095),
  "2026-11-11-mont-blanc": pos(45.833, 6.865),
  "2026-11-11-pointe-du-raz": pos(48.039, -4.74),
};
const ROUEN = pos(49.44, 1.095);

function load(name: string): unknown {
  return JSON.parse(readFileSync(`${DIR}/${name}.json`, "utf8"));
}

function meta(name: string): { url: string; status: number } {
  return JSON.parse(readFileSync(`${DIR}/${name}.meta.json`, "utf8")) as {
    url: string;
    status: number;
  };
}

function reading(name: string): WeatherReading {
  const position = FIXTURES[name];
  if (position === undefined) throw new Error(`unknown fixture ${name}`);
  const result = parseOpenMeteo(position, load(name));
  if (!result.ok) throw new Error(`${name}: ${result.reason}`);
  return result.reading;
}

/** A recorded answer as a mutable deep copy. */
function body(name = "2026-11-11-rouen"): {
  [key: string]: unknown;
  current: Record<string, unknown>;
  current_units: Record<string, unknown>;
} {
  return structuredClone(load(name)) as {
    current: Record<string, unknown>;
    current_units: Record<string, unknown>;
  };
}

describe("roundPosition", () => {
  it("rounds to 0.1°", () => {
    expect(roundPosition(49.443, 1.0989)).toEqual({ latitude: 49.4, longitude: 1.1 });
    expect(roundPosition(48.039, -4.74)).toEqual({ latitude: 48, longitude: -4.7 });
    expect(roundPosition(-0.04, -0.04)).toEqual({ latitude: 0, longitude: 0 });
  });

  it("never sends more than one decimal, whatever the input (random cross-check)", () => {
    // Seeded LCG: reproducible, no Math.random.
    let seed = 42;
    const next = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 5000; i++) {
      const lat = next() * 180 - 90;
      const lon = next() * 360 - 180;
      const p = roundPosition(lat, lon);
      if (p === null) throw new Error("rejected a valid position");
      const url = new URL(openMeteoUrl(p));
      expect(url.searchParams.get("latitude")).toMatch(/^-?\d{1,2}\.\d$/);
      expect(url.searchParams.get("longitude")).toMatch(/^-?\d{1,3}\.\d$/);
      expect(Math.abs(p.latitude - lat)).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(Math.abs(p.longitude - lon)).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });

  it("rejects non-finite or impossible positions", () => {
    for (const [lat, lon] of [
      [Number.NaN, 1],
      [1, Number.POSITIVE_INFINITY],
      [90.1, 0],
      [0, -180.1],
    ] as const) {
      expect(roundPosition(lat, lon)).toBeNull();
    }
  });
});

describe("openMeteoUrl", () => {
  it("is the URL every recorded fixture was fetched from", () => {
    for (const [name, position] of Object.entries(FIXTURES)) {
      expect(openMeteoUrl(position), name).toBe(meta(name).url);
    }
  });

  it("asks only for current weather, in unix time, at one decimal", () => {
    const url = new URL(openMeteoUrl(pos(48, -4.7)));
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("latitude")).toBe("48.0");
    expect(url.searchParams.get("longitude")).toBe("-4.7");
    expect(url.searchParams.get("timeformat")).toBe("unixtime");
    expect([...url.searchParams.keys()].sort()).toEqual(
      ["current", "latitude", "longitude", "timeformat"].sort(),
    );
  });
});

describe("weatherGroup", () => {
  it("groups every code the API sends (S-010), and nothing else", () => {
    const expected: Record<string, number[]> = {
      clear: [0, 1],
      cloudy: [2, 3],
      fog: [45, 48],
      drizzle: [51, 53, 55, 56, 57],
      rain: [61, 63, 65, 66, 67, 80, 81, 82],
      snow: [71, 73, 75, 77, 85, 86],
      storm: [95, 96, 97, 99],
    };
    const known = new Set<number>();
    for (const group of WEATHER_GROUPS) {
      for (const code of expected[group] ?? []) {
        expect(weatherGroup(code), String(code)).toBe(group);
        known.add(code);
      }
    }
    for (let code = -1; code <= 100; code++) {
      if (!known.has(code)) expect(weatherGroup(code), String(code)).toBeUndefined();
    }
  });
});

describe("parseOpenMeteo on recorded answers", () => {
  it("reads Rouen", () => {
    expect(reading("2026-11-11-rouen")).toEqual({
      timeMs: Date.UTC(2026, 10, 11, 15, 0),
      temperatureC: 15.5,
      weatherCode: 3,
      group: "cloudy",
      cloudCoverPct: 95,
      precipitationMm: 0,
      snowfallCm: 0,
      snowDepthM: 0,
      windSpeedKmh: 6.8,
      windFromDeg: 273,
      isDay: true,
    });
  });

  it("reads snow on the ground and rain showers at Mont Blanc", () => {
    const r = reading("2026-11-11-mont-blanc");
    expect(r.snowDepthM).toBe(0.02);
    expect(r.weatherCode).toBe(81);
    expect(r.group).toBe("rain");
  });

  it("reads a grid point on the coast", () => {
    expect(reading("2026-11-11-pointe-du-raz").windFromDeg).toBe(138);
  });

  it("rejects the API's error answers (bad query, daily quota)", () => {
    expect(meta("2026-11-11-error-bad-latitude").status).toBe(400);
    expect(meta("2026-11-11-error-quota").status).toBe(429);
    for (const name of ["2026-11-11-error-bad-latitude", "2026-11-11-error-quota"]) {
      expect(parseOpenMeteo(ROUEN, load(name)).ok, name).toBe(false);
    }
  });
});

describe("parseOpenMeteo on malformed and hostile answers", () => {
  it("rejects bodies of the wrong shape", () => {
    for (const value of [null, undefined, 1, "x", [], {}, { current: {} }]) {
      expect(parseOpenMeteo(ROUEN, value).ok).toBe(false);
    }
  });

  it("rejects an answer for another place than the one asked", () => {
    expect(parseOpenMeteo(pos(45.8, 6.9), load("2026-11-11-rouen")).ok).toBe(false);
  });

  it("rejects every field that is missing, of the wrong type or out of range", () => {
    const cases: Record<string, unknown[]> = {
      interval: [undefined, null, 3600, "900"],
      time: [undefined, null, "2026-11-11T15:00", 1794409201, 1794409200.5, 1e12, -1],
      temperature_2m: [undefined, null, "15", Number.NaN, 61, -81],
      weather_code: [undefined, null, "3", 4, 3.5, 100, -1],
      cloud_cover: [undefined, null, 101, -1],
      precipitation: [undefined, null, -0.1, 501],
      snowfall: [undefined, null, -0.1],
      snow_depth: [undefined, null, -0.01, 51],
      wind_speed_10m: [undefined, null, -1, 501],
      wind_direction_10m: [undefined, null, 361, -1],
      is_day: [undefined, null, true, 2, "1"],
    };
    for (const [field, values] of Object.entries(cases)) {
      for (const value of values) {
        const b = body();
        if (value === undefined) Reflect.deleteProperty(b.current, field);
        else b.current[field] = value;
        expect(parseOpenMeteo(ROUEN, b).ok, `${field} = ${JSON.stringify(value)}`).toBe(false);
      }
    }
  });

  it("rejects a change of unit (°F, mph, inch, ISO time)", () => {
    for (const [field, unit] of [
      ["temperature_2m", "°F"],
      ["wind_speed_10m", "mph"],
      ["precipitation", "inch"],
      ["snow_depth", "ft"],
      ["time", "iso8601"],
      ["interval", "minutes"],
    ] as const) {
      const b = body();
      b.current_units[field] = unit;
      expect(parseOpenMeteo(ROUEN, b).ok, field).toBe(false);
    }
  });

  it("never throws and keeps every accepted figure in range (fuzz)", () => {
    let seed = 7;
    const next = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pick = <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("empty pick");
      return item;
    };
    const values: unknown[] = [null, 0, -1, 1.5, 1e9, "12", "x", [], {}, true, 1794409200];
    const names = Object.keys(FIXTURES);
    for (let i = 0; i < 2000; i++) {
      const name = pick(names);
      const position = FIXTURES[name] ?? ROUEN;
      const b = body(name);
      const target = next() < 0.8 ? b.current : b;
      const keys = Object.keys(target);
      for (let k = 0; k < 1 + Math.floor(next() * 3); k++) target[pick(keys)] = pick(values);
      const result = parseOpenMeteo(position, b);
      if (!result.ok) continue;
      const r = result.reading;
      expect(Number.isFinite(r.temperatureC)).toBe(true);
      expect(r.cloudCoverPct >= 0 && r.cloudCoverPct <= 100).toBe(true);
      expect(r.windFromDeg >= 0 && r.windFromDeg <= 360).toBe(true);
      expect(weatherGroup(r.weatherCode)).toBe(r.group);
    }
  });
});

describe("weatherFreshness", () => {
  const r = reading("2026-11-11-rouen");

  it("turns stale strictly after WEATHER_STALE_AFTER_MS", () => {
    expect(weatherFreshness(r, r.timeMs + WEATHER_STALE_AFTER_MS)).toBe("fresh");
    expect(weatherFreshness(r, r.timeMs + WEATHER_STALE_AFTER_MS + 1)).toBe("stale");
  });

  it("flags a reading more than 15 minutes ahead, and a broken clock as stale", () => {
    expect(weatherFreshness(r, r.timeMs - 15 * 60_000)).toBe("fresh");
    expect(weatherFreshness(r, r.timeMs - 15 * 60_000 - 1)).toBe("future");
    expect(weatherFreshness(r, Number.NaN)).toBe("stale");
  });
});

describe("fetchOpenMeteo", () => {
  const answer =
    (text: string, status = 200): typeof fetch =>
    () =>
      Promise.resolve(new Response(text, { status }));
  const hanging: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for the rounded position only, with no credentials nor referrer", async () => {
    let seenUrl = "";
    let seen: RequestInit | undefined;
    const text = readFileSync(`${DIR}/2026-11-11-rouen.json`, "utf8");
    const fake: typeof fetch = (input, init) => {
      seenUrl = input instanceof Request ? input.url : input.toString();
      seen = init;
      return Promise.resolve(new Response(text));
    };
    expect((await fetchOpenMeteo(pos(49.44, 1.095), fake)).ok).toBe(true);
    expect(seenUrl).toContain("latitude=49.4&longitude=1.1&");
    expect(seenUrl).not.toContain("49.44");
    expect(seen?.credentials).toBe("omit");
    expect(seen?.referrerPolicy).toBe("no-referrer");
  });

  it("turns network errors, HTTP errors (quota) and non-JSON into unavailable", async () => {
    const down: typeof fetch = () => Promise.reject(new TypeError("Failed to fetch"));
    expect(await fetchOpenMeteo(ROUEN, down)).toEqual({ ok: false, reason: "network error" });
    expect(await fetchOpenMeteo(ROUEN, answer("{}", 429))).toEqual({
      ok: false,
      reason: "HTTP 429",
    });
    expect(await fetchOpenMeteo(ROUEN, answer("<html>"))).toEqual({
      ok: false,
      reason: "not JSON",
    });
  });

  it("reports a cancel by the caller as aborted", async () => {
    const controller = new AbortController();
    const pending = fetchOpenMeteo(ROUEN, hanging, controller.signal);
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: "aborted" });
  });

  it("gives up after FETCH_TIMEOUT_MS", async () => {
    vi.useFakeTimers();
    const pending = fetchOpenMeteo(ROUEN, hanging);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    expect(await pending).toEqual({ ok: false, reason: "timeout" });
  });

  it("rejects an answer over 16 KB", async () => {
    expect(await fetchOpenMeteo(ROUEN, answer(" ".repeat(16 * 1024 + 1)))).toEqual({
      ok: false,
      reason: "answer too large",
    });
  });
});
