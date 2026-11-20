import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGION_CODES, type RegionCode } from "../src/data/eco2mix";
import {
  parseOpenMeteo,
  roundPosition,
  type RoundedPosition,
  WEATHER_GROUPS,
  WEATHER_STALE_AFTER_MS,
  type WeatherReading,
  weatherGroup,
} from "../src/data/open-meteo";
import { referencePoint } from "../src/geo/regions";
import {
  MASSIFS,
  overrideWeather,
  type RegionalWeather,
  sceneWeather,
  WEATHER_POINT_IDS,
} from "../src/scene/weather";
import { weatherFromQuery } from "../src/ui/settings";
import {
  SEND_AFTER_MS,
  startWeatherFeed,
  WEATHER_REFRESH_MS,
  WEATHER_RETRY_MS,
  weatherPoint,
  weatherState,
} from "../src/ui/weather-feed";

function pos(latitude: number, longitude: number): RoundedPosition {
  const p = roundPosition(latitude, longitude);
  if (p === null) throw new Error("bad position");
  return p;
}

// The real answer recorded at Rouen cathedral on 2026-11-11 (DS-03), parsed.
const ROUEN_BODY = JSON.parse(
  readFileSync("tests/fixtures/open-meteo/2026-11-11-rouen.json", "utf8"),
) as Record<string, unknown>;
const rouenResult = parseOpenMeteo(pos(49.44, 1.095), ROUEN_BODY);
if (!rouenResult.ok) throw new Error("the Rouen fixture no longer parses");
const ROUEN: WeatherReading = rouenResult.reading;
const T = ROUEN.timeMs;

const at = (timeMs: number): WeatherReading => ({ ...ROUEN, timeMs });

describe("sceneWeather: the readings the scene may show", () => {
  it("keeps fresh and stale readings, drops one dated after the clock", () => {
    const byRegion: RegionalWeather = {
      "28": at(T),
      "11": at(T - WEATHER_STALE_AFTER_MS - 60_000),
      "84": at(T + 16 * 60_000),
    };
    expect(sceneWeather(byRegion, T)).toEqual({ "28": at(T), "11": byRegion["11"] });
  });

  it("drops every reading under a clock in the past (?at=, the time-lapse)", () => {
    expect(sceneWeather({ "28": at(T) }, T - 86_400_000)).toEqual({});
  });

  it("gives nothing for nothing", () => {
    expect(sceneWeather({}, T)).toEqual({});
  });
});

describe("overrideWeather: the weather ?weather= imposes", () => {
  it("gives every region the same reading of the group asked, dated at the clock", () => {
    for (const group of WEATHER_GROUPS) {
      const all = overrideWeather(group, T);
      expect(Object.keys(all).sort()).toEqual([...WEATHER_POINT_IDS].sort());
      for (const region of WEATHER_POINT_IDS) {
        const r = all[region];
        expect(r?.group).toBe(group);
        expect(r?.timeMs).toBe(T);
      }
    }
  });

  it("places each imposed reading at its region's prefecture or its range's point", () => {
    const all = overrideWeather("snow", T);
    for (const region of REGION_CODES) {
      const ref = referencePoint(region);
      expect([all[region]?.latitude, all[region]?.longitude]).toEqual([
        ref?.latitude,
        ref?.longitude,
      ]);
    }
    for (const m of MASSIFS) expect(all[m.id]?.latitude).toBe(m.latitude);
  });

  it("uses a WMO code of its own group and values the parser would accept", () => {
    for (const group of WEATHER_GROUPS) {
      const r = overrideWeather(group, T)["28"];
      if (r === undefined) throw new Error("missing");
      expect(weatherGroup(r.weatherCode)).toBe(group);
      expect(r.cloudCoverPct).toBeGreaterThanOrEqual(0);
      expect(r.cloudCoverPct).toBeLessThanOrEqual(100);
      expect(r.windFromDeg).toBeGreaterThanOrEqual(0);
      expect(r.windFromDeg).toBeLessThanOrEqual(360);
      for (const v of [r.precipitationMm, r.snowfallCm, r.snowDepthM, r.windSpeedKmh])
        expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("is always shown, whatever the clock", () => {
    const all = overrideWeather("rain", T);
    expect(sceneWeather(all, T)).toEqual(all);
  });
});

describe("weatherFromQuery", () => {
  it("reads every group", () => {
    for (const group of WEATHER_GROUPS) expect(weatherFromQuery(`?weather=${group}`)).toBe(group);
  });

  it("ignores anything else", () => {
    for (const search of [
      "",
      "?weather=",
      "?weather=hail",
      "?weather=Rain",
      "?weather=rain&weather=snow",
      "?weather=__proto__",
      `?weather=rain&x=${"a".repeat(3000)}`,
    ])
      expect(weatherFromQuery(search)).toBeUndefined();
  });
});

describe("weatherState: what the page says about the weather", () => {
  it("says unavailable without a reading", () => {
    expect(weatherState({}, T)).toEqual({ kind: "unavailable" });
  });

  it("says live with the oldest shown reading's time", () => {
    expect(weatherState({ "28": at(T), "11": at(T - 15 * 60_000) }, T)).toEqual({
      kind: "live",
      timeMs: T - 15 * 60_000,
    });
  });

  it("says stale when one shown reading is over an hour old", () => {
    const old = T - WEATHER_STALE_AFTER_MS - 1;
    expect(weatherState({ "28": at(T), "11": at(old) }, T)).toEqual({ kind: "stale", timeMs: old });
  });

  it("leaves out a reading dated after the clock, and says ahead when all are", () => {
    expect(weatherState({ "28": at(T), "11": at(T + 3_600_000) }, T)).toEqual({
      kind: "live",
      timeMs: T,
    });
    expect(weatherState({ "28": at(T), "11": at(T + 900_000) }, T - 86_400_000)).toEqual({
      kind: "ahead",
      timeMs: T + 900_000,
    });
  });
});

describe("weatherPoint: where a region's weather is asked for", () => {
  it("is a mountain range's own point, on 0.1°, whoever the viewer", () => {
    const viewer = { region: "84" as const, position: pos(45.7, 4.8) };
    for (const m of MASSIFS) {
      expect(weatherPoint(m.id, null)).toEqual(pos(m.latitude, m.longitude));
      expect(weatherPoint(m.id, viewer)).toEqual(pos(m.latitude, m.longitude));
    }
  });

  it("is the region's prefecture, rounded to 0.1°, for every region", () => {
    for (const region of REGION_CODES) {
      const ref = referencePoint(region);
      if (ref === null) throw new Error(`no reference point for ${region}`);
      expect(weatherPoint(region, null)).toEqual(pos(ref.latitude, ref.longitude));
    }
  });

  it("is the viewer's rounded position for the viewer's region only", () => {
    // Étretat's cliffs (P-001), standing in for a viewer: never a real position.
    const viewer = { region: "28" as const, position: pos(49.7, 0.2) };
    expect(weatherPoint("28", viewer)).toEqual(viewer.position);
    expect(weatherPoint("11", viewer)).toEqual(weatherPoint("11", null));
  });
});

/**
 * The body of an answer to `url`: the Rouen recording, moved to the point asked, with
 * the cloud cover set to its rounded latitude so that two points' readings differ.
 */
function answerAt(url: string, timeSeconds: number): Record<string, unknown> {
  const query = new URL(url).searchParams;
  const latitude = Number(query.get("latitude"));
  return {
    ...ROUEN_BODY,
    latitude,
    longitude: Number(query.get("longitude")),
    current: {
      ...(ROUEN_BODY.current as Record<string, unknown>),
      time: timeSeconds,
      cloud_cover: Math.round(latitude),
    },
  };
}

describe("startWeatherFeed", () => {
  type Listener = () => void;
  let listeners: Listener[];
  let doc: { hidden: boolean; addEventListener: (type: string, l: Listener) => void };

  beforeEach(() => {
    vi.useFakeTimers({ now: T });
    listeners = [];
    doc = {
      hidden: false,
      addEventListener: (_type, l) => {
        listeners.push(l);
      },
    };
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A fetch that answers every call, and records the URLs asked. */
  function fakeFetch(answer: (url: string) => Response | Promise<Response>): {
    fetchFn: typeof fetch;
    urls: string[];
  } {
    const urls: string[] = [];
    const fetchFn = ((input: string) => {
      const url = input;
      urls.push(url);
      return Promise.resolve(answer(url));
    }) as typeof fetch;
    return { fetchFn, urls };
  }
  const ok = (url: string): Response =>
    new Response(JSON.stringify(answerAt(url, T / 1000)), { status: 200 });

  const clock = { now: (): number => T };

  it("asks once per region, at its prefecture, and per mountain range, and sends every reading", async () => {
    const { fetchFn, urls } = fakeFetch(ok);
    const sent: RegionalWeather[] = [];
    startWeatherFeed(clock, fetchFn, (w) => sent.push(w));
    await vi.advanceTimersByTimeAsync(0);
    expect(urls).toHaveLength(WEATHER_POINT_IDS.length);
    const last = sent.at(-1) ?? {};
    expect(Object.keys(last).sort()).toEqual([...WEATHER_POINT_IDS].sort());
    // Only rounded positions leave: one decimal.
    for (const url of urls) {
      const q = new URL(url).searchParams;
      expect(q.get("latitude")).toMatch(/^-?\d+\.\d$/);
      expect(q.get("longitude")).toMatch(/^-?\d+\.\d$/);
    }
  });

  it("refreshes every 15 minutes, not sooner", async () => {
    const { fetchFn, urls } = fakeFetch(ok);
    startWeatherFeed(clock, fetchFn, () => undefined);
    await vi.advanceTimersByTimeAsync(WEATHER_REFRESH_MS - 1000);
    expect(urls).toHaveLength(WEATHER_POINT_IDS.length);
    await vi.advanceTimersByTimeAsync(1000);
    expect(urls).toHaveLength(2 * WEATHER_POINT_IDS.length);
  });

  it("retries only the failed regions, a minute later, then twice as long", async () => {
    const failing = new Set<string>();
    const { fetchFn, urls } = fakeFetch((url) =>
      failing.has(new URL(url).searchParams.get("latitude") ?? "")
        ? new Response('{"error":true,"reason":"quota"}', { status: 429 })
        : ok(url),
    );
    const lyon = weatherPoint("84", null);
    failing.add(lyon?.latitude.toFixed(1) ?? "");
    const sent: RegionalWeather[] = [];
    startWeatherFeed(clock, fetchFn, (w) => sent.push(w));
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.at(-1)?.["84"]).toBeUndefined();
    expect(sent.at(-1)?.["28"]).toBeDefined();
    await vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS);
    expect(urls).toHaveLength(WEATHER_POINT_IDS.length + 1);
    await vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS);
    expect(urls).toHaveLength(WEATHER_POINT_IDS.length + 1);
    failing.clear();
    await vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS);
    expect(urls).toHaveLength(WEATHER_POINT_IDS.length + 2);
    expect(sent.at(-1)?.["84"]).toBeDefined();
  });

  it("asks the viewer's region at the viewer's point, and drops a late answer from the old one", async () => {
    let release: (() => void) | null = null;
    const { fetchFn, urls } = fakeFetch(
      (url) =>
        new Promise<Response>((resolve) => {
          const r = (): void => {
            resolve(ok(url));
          };
          // Normandie's first answer, from its prefecture, is held back.
          if (urls.length <= WEATHER_POINT_IDS.length && url.includes("latitude=49.4&"))
            release = r;
          else r();
        }),
    );
    const sent: RegionalWeather[] = [];
    const feed = startWeatherFeed(clock, fetchFn, (w) => sent.push(w));
    await vi.advanceTimersByTimeAsync(0);
    const viewer = { region: "28" as RegionCode, position: pos(49.7, 0.2) };
    feed.setViewer(viewer);
    await vi.advanceTimersByTimeAsync(0);
    expect(urls.at(-1)).toContain("latitude=49.7&longitude=0.2&");
    const fromViewer = sent.at(-1)?.["28"];
    expect(fromViewer).toBeDefined();
    // The prefecture's answer lands now: it must not replace the viewer's.
    expect(release).not.toBeNull();
    (release as unknown as () => void)();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.at(-1)?.["28"]).toEqual(fromViewer);
  });

  it("calls nothing and sends nothing when the viewer is told again what it already is", async () => {
    const { fetchFn, urls } = fakeFetch(ok);
    const sent: RegionalWeather[] = [];
    const feed = startWeatherFeed(clock, fetchFn, (w) => sent.push(w));
    await vi.advanceTimersByTimeAsync(0);
    const viewer = { region: "28" as RegionCode, position: pos(49.7, 0.2) };
    feed.setViewer(viewer);
    await vi.advanceTimersByTimeAsync(0);
    const [calls, sends] = [urls.length, sent.length];
    feed.setViewer({ ...viewer });
    feed.setViewer({ ...viewer });
    await vi.advanceTimersByTimeAsync(0);
    expect([urls.length, sent.length]).toEqual([calls, sends]);
    feed.setViewer(null);
    feed.setViewer(null);
    await vi.advanceTimersByTimeAsync(0);
    // Back to the prefecture: one call, for Normandie only.
    expect(urls.length).toBe(calls + 1);
  });

  it("tries the viewer's point again a minute later when its call fails", async () => {
    let failViewer = true;
    const { fetchFn, urls } = fakeFetch((url) =>
      failViewer && url.includes("latitude=49.7&")
        ? new Response('{"error":true,"reason":"server"}', { status: 503 })
        : ok(url),
    );
    const sent: RegionalWeather[] = [];
    const feed = startWeatherFeed(clock, fetchFn, (w) => sent.push(w));
    await vi.advanceTimersByTimeAsync(0);
    feed.setViewer({ region: "28", position: pos(49.7, 0.2) });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.at(-1)?.["28"]).toBeUndefined();
    const calls = urls.length;
    failViewer = false;
    await vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS);
    // Normandie only, at the viewer's point; not the 15-minute refresh of all.
    expect(urls.slice(calls)).toHaveLength(1);
    expect(urls.at(-1)).toContain("latitude=49.7&longitude=0.2&");
    expect(sent.at(-1)?.["28"]).toBeDefined();
  });

  it("asks the viewer's point as soon as the tab is back when it moved while hidden", async () => {
    const { fetchFn, urls } = fakeFetch(ok);
    const sent: RegionalWeather[] = [];
    const feed = startWeatherFeed(clock, fetchFn, (w) => sent.push(w));
    await vi.advanceTimersByTimeAsync(0);
    doc.hidden = true;
    for (const l of listeners) l();
    feed.setViewer({ region: "28", position: pos(49.7, 0.2) });
    await vi.advanceTimersByTimeAsync(0);
    const calls = urls.length;
    expect(calls).toBe(WEATHER_POINT_IDS.length);
    doc.hidden = false;
    for (const l of listeners) l();
    await vi.advanceTimersByTimeAsync(0);
    expect(urls.slice(calls).some((u) => u.includes("latitude=49.7&longitude=0.2&"))).toBe(true);
    await vi.advanceTimersByTimeAsync(SEND_AFTER_MS);
    expect(sent.at(-1)?.["28"]).toBeDefined();
  });

  it("keeps the retry of a new load when an older one, hidden and shown again, ends late", async () => {
    const lille = weatherPoint("32", null)?.latitude.toFixed(1) ?? "";
    let held: (() => void) | null = null;
    let round = 0;
    const { fetchFn, urls } = fakeFetch((url) => {
      if (new URL(url).searchParams.get("latitude") !== lille) return ok(url);
      round++;
      // First call: held until after the tab came back; second: fails.
      if (round === 1)
        return new Promise<Response>((resolve) => {
          held = () => {
            resolve(ok(url));
          };
        });
      if (round === 2) return new Response('{"error":true,"reason":"server"}', { status: 503 });
      return ok(url);
    });
    startWeatherFeed(clock, fetchFn, () => undefined);
    await vi.advanceTimersByTimeAsync(0);
    doc.hidden = true;
    for (const l of listeners) l();
    doc.hidden = false;
    for (const l of listeners) l();
    await vi.advanceTimersByTimeAsync(0);
    expect(round).toBe(2);
    (held as unknown as () => void)();
    await vi.advanceTimersByTimeAsync(0);
    const calls = urls.length;
    await vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS);
    expect(urls.slice(calls)).toHaveLength(1);
    expect(round).toBe(3);
  });

  it("shows the answers in hand within a second, without waiting for a slow call", async () => {
    const lille = weatherPoint("32", null)?.latitude.toFixed(1) ?? "";
    const { fetchFn } = fakeFetch((url) =>
      new URL(url).searchParams.get("latitude") === lille
        ? new Promise<Response>(() => undefined)
        : ok(url),
    );
    const sent: RegionalWeather[] = [];
    startWeatherFeed(clock, fetchFn, (w) => sent.push(w));
    await vi.advanceTimersByTimeAsync(0);
    // Only the "loading" note so far: the answers in hand wait for their batch.
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(SEND_AFTER_MS);
    expect(sent).toHaveLength(2);
    expect(Object.keys(sent.at(-1) ?? {})).toHaveLength(WEATHER_POINT_IDS.length - 1);
    expect(sent.at(-1)?.["32"]).toBeUndefined();
  });

  it("calls nothing while hidden, and catches up when shown again", async () => {
    const { fetchFn, urls } = fakeFetch(ok);
    startWeatherFeed(clock, fetchFn, () => undefined);
    await vi.advanceTimersByTimeAsync(0);
    doc.hidden = true;
    for (const l of listeners) l();
    await vi.advanceTimersByTimeAsync(2 * WEATHER_REFRESH_MS);
    expect(urls).toHaveLength(WEATHER_POINT_IDS.length);
    doc.hidden = false;
    for (const l of listeners) l();
    await vi.advanceTimersByTimeAsync(0);
    expect(urls).toHaveLength(2 * WEATHER_POINT_IDS.length);
  });
});
