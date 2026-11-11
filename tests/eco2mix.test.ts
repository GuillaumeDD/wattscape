import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  eco2mixUrl,
  fetchEco2mix,
  freshness,
  isEco2mixArea,
  parseEco2mix,
  REGION_CODES,
  SOURCES,
  FETCH_TIMEOUT_MS,
  STALE_AFTER_MS,
  type Eco2mixArea,
  type Eco2mixReading,
} from "../src/data/eco2mix";

// Real answers recorded on 2026-11-11 by tools/record-eco2mix.ts (DS-01, DS-02).
const DIR = "tests/fixtures/eco2mix";
const FIXTURES: Record<string, Eco2mixArea> = {
  "2026-11-11-national": "FR",
  "2026-11-11-normandie": "28",
  "2026-11-11-bretagne": "53",
  "2026-11-11-auvergne-rhone-alpes": "84",
  "2026-11-11-ile-de-france": "11",
};

function load(name: string): unknown {
  return JSON.parse(readFileSync(`${DIR}/${name}.json`, "utf8"));
}

function meta(name: string): { url: string; status: number } {
  return JSON.parse(readFileSync(`${DIR}/${name}.meta.json`, "utf8")) as {
    url: string;
    status: number;
  };
}

function reading(name: string): Eco2mixReading {
  const area = FIXTURES[name];
  if (area === undefined) throw new Error(`unknown fixture ${name}`);
  const result = parseEco2mix(area, load(name));
  if (!result.ok) throw new Error(`${name}: ${result.reason}`);
  return result.reading;
}

/** The first row of a recorded answer, as a mutable copy. */
function row(name: string): Record<string, unknown> {
  const body = load(name) as { results: Record<string, unknown>[] };
  const first = body.results[0];
  if (first === undefined) throw new Error(`${name}: empty`);
  return { ...first };
}

function balanceError(r: Eco2mixReading, exchangeSign: 1 | -1): number {
  const production = SOURCES.reduce((sum, s) => sum + r.productionMw[s], 0);
  const supply =
    production +
    exchangeSign * r.exchangesMw +
    r.pumpingMw +
    r.batteryChargeMw +
    r.batteryDischargeMw;
  return Math.abs(r.consumptionMw - supply);
}

describe("eco2mixUrl", () => {
  it("is the URL every recorded fixture was fetched from", () => {
    for (const [name, area] of Object.entries(FIXTURES)) {
      expect(eco2mixUrl(area), name).toBe(meta(name).url);
    }
  });

  it("asks the regional dataset for one region's latest published step", () => {
    const url = new URL(eco2mixUrl("28"));
    expect(url.origin).toBe("https://odre.opendatasoft.com");
    expect(url.pathname).toContain("/eco2mix-regional-tr/records");
    expect(url.searchParams.get("where")).toBe(
      'code_insee_region = "28" and consommation is not null',
    );
    expect(url.searchParams.get("order_by")).toBe("date_heure desc");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("asks the national dataset for France", () => {
    const url = new URL(eco2mixUrl("FR"));
    expect(url.pathname).toContain("/eco2mix-national-tr/records");
    expect(url.searchParams.get("where")).toBe("consommation is not null");
  });
});

describe("isEco2mixArea", () => {
  it("accepts the 12 regions and FR, nothing else", () => {
    for (const code of REGION_CODES) expect(isEco2mixArea(code)).toBe(true);
    expect(isEco2mixArea("FR")).toBe(true);
    for (const bad of ["94", "", "fr", 28, null, undefined, "28 "]) {
      expect(isEco2mixArea(bad)).toBe(false);
    }
  });
});

describe("parseEco2mix on recorded answers", () => {
  it("reads Normandie (nuclear, exporting)", () => {
    const r = reading("2026-11-11-normandie");
    expect(r.area).toBe("28");
    expect(r.time).toBe("2026-11-11T07:45:00+00:00");
    expect(r.timeMs).toBe(Date.UTC(2026, 10, 11, 7, 45));
    expect(r.consumptionMw).toBe(2661);
    expect(r.productionMw).toEqual({
      thermal: 131,
      nuclear: 7597,
      wind: 247,
      solar: 17,
      hydro: 13,
      bioenergy: 48,
    });
    expect(r.loadFactorPct.nuclear).toBe(61.97);
    expect(r.exchangesMw).toBe(-5392);
  });

  it("reads a region without a nuclear plant as 0 MW and no load factor", () => {
    for (const name of ["2026-11-11-bretagne", "2026-11-11-ile-de-france"]) {
      const r = reading(name);
      expect(r.productionMw.nuclear, name).toBe(0);
      expect(r.loadFactorPct.nuclear, name).toBeNull();
    }
  });

  it("reads pumping and battery columns sent as text", () => {
    const bretagne = reading("2026-11-11-bretagne");
    expect(bretagne.pumpingMw).toBe(-50);
    expect(reading("2026-11-11-ile-de-france").batteryChargeMw).toBe(-1);
    expect(reading("2026-11-11-auvergne-rhone-alpes").batteryDischargeMw).toBe(3);
  });

  it("sums gas, oil and coal into thermal nationally, with no load factors", () => {
    const r = reading("2026-11-11-national");
    expect(r.area).toBe("FR");
    expect(r.productionMw.thermal).toBe(6355 + 37 + 493);
    expect(r.productionMw.nuclear).toBe(42178);
    expect(r.exchangesMw).toBe(-13753);
    for (const s of SOURCES) expect(r.loadFactorPct[s]).toBeNull();
  });

  it("closes the balance only if a positive exchange is an import", () => {
    for (const name of Object.keys(FIXTURES)) {
      const r = reading(name);
      expect(balanceError(r, 1), name).toBeLessThanOrEqual(100);
      if (Math.abs(r.exchangesMw) > 100) {
        expect(balanceError(r, -1), name).toBeGreaterThan(Math.abs(r.exchangesMw));
      }
    }
  });

  it("rejects a step not yet published (every figure null)", () => {
    const result = parseEco2mix("52", load("2026-11-11-regional-empty-step"));
    expect(result.ok).toBe(false);
  });

  it("rejects the API's error answer", () => {
    expect(meta("2026-11-11-error-bad-query").status).toBe(400);
    expect(parseEco2mix("28", load("2026-11-11-error-bad-query")).ok).toBe(false);
  });
});

describe("parseEco2mix on malformed and hostile answers", () => {
  const regional = (): Record<string, unknown> => row("2026-11-11-normandie");
  const parse = (r: Record<string, unknown>, area: Eco2mixArea = "28") =>
    parseEco2mix(area, { results: [r] });

  it("rejects bodies of the wrong shape", () => {
    for (const body of [null, undefined, 1, "x", [], {}, { results: {} }, { results: [] }]) {
      expect(parseEco2mix("28", body).ok).toBe(false);
    }
    expect(parseEco2mix("28", { results: [null] }).ok).toBe(false);
    expect(parseEco2mix("28", { results: [[1]] }).ok).toBe(false);
  });

  it("rejects a row for another area than the one asked", () => {
    expect(parse(regional(), "53").ok).toBe(false);
    expect(parse(regional(), "FR").ok).toBe(false);
    expect(parseEco2mix("28", load("2026-11-11-national")).ok).toBe(false);
  });

  it("rejects every MW field that is missing, null, non-numeric or out of range", () => {
    const fields = [
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
    ];
    const bad: unknown[] = [
      undefined,
      null,
      "ND",
      "-",
      "DC",
      "",
      " 1",
      "1e3",
      "0x10",
      "Infinity",
      "NaN",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      200_001,
      -200_001,
      true,
      {},
      [1],
      "1".repeat(65),
    ];
    for (const field of fields) {
      for (const value of bad) {
        const r = regional();
        if (value === undefined) Reflect.deleteProperty(r, field);
        else r[field] = value;
        expect(parse(r).ok, `${field} = ${String(value)}`).toBe(false);
      }
    }
  });

  it("rejects figures of the wrong sign", () => {
    for (const [field, value] of [
      ["consommation", -1],
      ["thermique", -1],
      ["nucleaire", -1],
      ["eolien", -1],
      ["solaire", -1],
      ["hydraulique", -1],
      ["bioenergies", -1],
      ["pompage", "5"],
      ["stockage_batterie", "2"],
      ["destockage_batterie", "-2"],
    ] as const) {
      const r = regional();
      r[field] = value;
      expect(parse(r).ok, field).toBe(false);
    }
  });

  it("rejects every bad national-only field, and a thermal sum out of range", () => {
    const national = (): Record<string, unknown> => row("2026-11-11-national");
    for (const field of ["gaz", "fioul", "charbon", "pompage", "stockage_batterie"]) {
      for (const value of [null, "ND", Number.NaN, 200_001, {}]) {
        const r = national();
        r[field] = value;
        expect(parse(r, "FR").ok, `${field} = ${JSON.stringify(value)}`).toBe(false);
      }
    }
    for (const value of [undefined, null, "france", "FR", "28"]) {
      const r = national();
      if (value === undefined) Reflect.deleteProperty(r, "perimetre");
      else r.perimetre = value;
      expect(parse(r, "FR").ok, `perimetre = ${String(value)}`).toBe(false);
    }
    const r = national();
    r.gaz = 100_000;
    r.fioul = 100_000;
    r.charbon = 1;
    expect(parse(r, "FR").ok).toBe(false);
  });

  it("rejects load factors out of 0–200 % or not numbers, accepts null", () => {
    for (const value of [-0.1, 200.1, "50", Number.NaN, {}]) {
      const r = regional();
      r.tch_eolien = value;
      expect(parse(r).ok, JSON.stringify(value)).toBe(false);
    }
    const r = regional();
    r.tch_eolien = null;
    const result = parse(r);
    expect(result.ok && result.reading.loadFactorPct.wind).toBeNull();
    r.tch_eolien = 125;
    expect(parse(r).ok).toBe(true);
  });

  it("rejects timestamps that are not a 15-minute UTC step", () => {
    for (const value of [
      null,
      1794380400000,
      "2026-11-11",
      "2026-11-11T07:45:00",
      "2026-11-11T07:45:00+01:00",
      "2026-11-11T07:44:00+00:00",
      "2026-11-11T07:45:30+00:00",
      "2026-02-30T07:45:00+00:00",
      "2026-11-11T24:00:00+00:00",
      " 2026-11-11T07:45:00+00:00",
    ]) {
      const r = regional();
      r.date_heure = value;
      expect(parse(r).ok, String(value)).toBe(false);
    }
    const r = regional();
    r.date_heure = "2026-11-11T07:45:00Z";
    expect(parse(r).ok).toBe(true);
  });

  it("never throws and keeps every accepted figure in range (fuzz)", () => {
    // Seeded mulberry32: the fuzz is reproducible (no Math.random).
    let seed = 0x5eed;
    const next = (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("empty pick");
      return item;
    };
    const values: unknown[] = [null, 0, -1, 1.5, 1e9, "12", "-3", "x", "", [], {}, true];
    for (let i = 0; i < 2000; i++) {
      const name = pick(Object.keys(FIXTURES));
      const area = FIXTURES[name] ?? "FR";
      const r = row(name);
      const keys = Object.keys(r);
      for (let k = 0; k < 1 + Math.floor(next() * 3); k++) r[pick(keys)] = pick(values);
      const result = parseEco2mix(area, { results: [r] });
      if (!result.ok) continue;
      const g = result.reading;
      const figures = [
        g.consumptionMw,
        g.exchangesMw,
        g.pumpingMw,
        g.batteryChargeMw,
        g.batteryDischargeMw,
        ...SOURCES.map((s) => g.productionMw[s]),
      ];
      for (const f of figures) {
        expect(Number.isFinite(f)).toBe(true);
        expect(Math.abs(f)).toBeLessThanOrEqual(200_000);
      }
      for (const s of SOURCES) {
        const lf = g.loadFactorPct[s];
        if (lf !== null) expect(lf >= 0 && lf <= 200).toBe(true);
      }
    }
  });
});

describe("freshness", () => {
  const r = reading("2026-11-11-normandie");

  it("is fresh at the 63-minute lag measured on 2026-11-11", () => {
    expect(freshness(r, r.timeMs + 63 * 60_000)).toBe("fresh");
  });

  it("turns stale strictly after STALE_AFTER_MS", () => {
    expect(freshness(r, r.timeMs + STALE_AFTER_MS)).toBe("fresh");
    expect(freshness(r, r.timeMs + STALE_AFTER_MS + 1)).toBe("stale");
  });

  it("is stale, never fresh, when the clock is not a number", () => {
    expect(freshness(r, Number.NaN)).toBe("stale");
    expect(freshness(r, Number.POSITIVE_INFINITY)).toBe("stale");
  });

  it("flags a step more than 15 minutes ahead of the clock", () => {
    expect(freshness(r, r.timeMs - 15 * 60_000)).toBe("fresh");
    expect(freshness(r, r.timeMs - 15 * 60_000 - 1)).toBe("future");
  });
});

describe("fetchEco2mix", () => {
  const answer =
    (body: string, status = 200): typeof fetch =>
    () =>
      Promise.resolve(new Response(body, { status }));

  it("parses a good answer and sends no credentials nor referrer", async () => {
    let seen: RequestInit | undefined;
    let seenUrl = "";
    const body = readFileSync(`${DIR}/2026-11-11-normandie.json`, "utf8");
    const fake: typeof fetch = (input, init) => {
      seenUrl = input instanceof Request ? input.url : input.toString();
      seen = init;
      return Promise.resolve(new Response(body));
    };
    const result = await fetchEco2mix("28", fake);
    expect(result.ok).toBe(true);
    expect(seenUrl).toBe(eco2mixUrl("28"));
    expect(seen?.credentials).toBe("omit");
    expect(seen?.referrerPolicy).toBe("no-referrer");
  });

  it("turns network errors, HTTP errors and non-JSON into unavailable", async () => {
    const down: typeof fetch = () => Promise.reject(new TypeError("Failed to fetch"));
    expect(await fetchEco2mix("28", down)).toEqual({ ok: false, reason: "network error" });
    expect(await fetchEco2mix("28", answer("{}", 503))).toEqual({
      ok: false,
      reason: "HTTP 503",
    });
    expect(await fetchEco2mix("28", answer("<html>"))).toEqual({
      ok: false,
      reason: "not JSON",
    });
  });

  /** A fetch that never answers, until its signal aborts. */
  const hanging: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a cancel by the caller as aborted, not as an outage", async () => {
    const controller = new AbortController();
    const pending = fetchEco2mix("28", hanging, controller.signal);
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: "aborted" });
    expect(await fetchEco2mix("28", answer("{}"), controller.signal)).toEqual({
      ok: false,
      reason: "aborted",
    });
  });

  it("gives up after FETCH_TIMEOUT_MS", async () => {
    vi.useFakeTimers();
    const pending = fetchEco2mix("28", hanging);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    expect(await pending).toEqual({ ok: false, reason: "timeout" });
  });

  it("rejects an answer over 64 KB without parsing it", async () => {
    const big = JSON.stringify({ results: [], pad: "x".repeat(64 * 1024) });
    expect(await fetchEco2mix("28", answer(big))).toEqual({
      ok: false,
      reason: "answer too large",
    });
  });
});
