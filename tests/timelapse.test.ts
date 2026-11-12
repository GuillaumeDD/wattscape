import { describe, expect, it } from "vitest";
import { type Clock, replayClock } from "../src/clock/clock";
import {
  eco2mixHistoryUrl,
  HISTORY_MS,
  HISTORY_ROWS,
  parseEco2mixHistory,
  REGION_CODES,
  type RegionalReadings,
  stepAt,
} from "../src/data/eco2mix";
import { replayState } from "../src/ui/replay-feed";
import { timelapseFromQuery } from "../src/ui/settings";
import history from "./fixtures/eco2mix/2026-11-12-history-3h.json";
import { mulberry32 } from "./random";

const rows = history as Record<string, unknown>[];

describe("eco2mixHistoryUrl", () => {
  it("asks the export endpoint for a day and an hour of published steps, oldest first", () => {
    const end = Date.UTC(2026, 10, 12, 18, 30, 15, 700);
    const url = new URL(eco2mixHistoryUrl(end));
    expect(url.origin + url.pathname).toBe(
      "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-regional-tr/exports/json",
    );
    expect(url.searchParams.get("where")).toBe(
      "consommation is not null and date_heure >= date'2026-11-11T17:30:15Z' and date_heure <= date'2026-11-12T18:30:15Z'",
    );
    expect(url.searchParams.get("order_by")).toBe("date_heure");
    expect(url.searchParams.get("limit")).toBe(String(HISTORY_ROWS));
    expect(HISTORY_ROWS).toBe(12 * 101);
  });
});

describe("parseEco2mixHistory (recorded 2026-11-12, 09:00–12:00 UTC)", () => {
  it("groups the rows into steps of every region, oldest first", () => {
    const result = parseEco2mixHistory(rows);
    if (!result.ok) throw new Error(result.reason);
    const steps = result.reading;
    expect(steps).toHaveLength(12);
    expect(new Date(steps[0]?.timeMs ?? 0).toISOString()).toBe("2026-11-12T09:00:00.000Z");
    for (let k = 1; k < steps.length; k++)
      expect((steps[k]?.timeMs ?? 0) - (steps[k - 1]?.timeMs ?? 0)).toBe(15 * 60_000);
    for (const step of steps)
      expect(Object.keys(step.byRegion).sort()).toEqual([...REGION_CODES].sort());
    expect(steps[0]?.byRegion["28"]?.consumptionMw).toBeGreaterThan(1000);
  });

  it("leaves out a region whose row is invalid, at that step only", () => {
    const broken = rows.map((r, i) => (i === 0 ? { ...r, consommation: "lots" } : r));
    const result = parseEco2mixHistory(broken);
    if (!result.ok) throw new Error(result.reason);
    const first = rows[0]?.code_insee_region as string;
    expect(Object.keys(result.reading[0]?.byRegion ?? {})).not.toContain(first);
    expect(Object.keys(result.reading[1]?.byRegion ?? {})).toContain(first);
  });

  it("is unavailable for anything that is not the API's shape", () => {
    expect(parseEco2mixHistory({ results: rows }).ok).toBe(false);
    expect(parseEco2mixHistory([]).ok).toBe(false);
    expect(parseEco2mixHistory(null).ok).toBe(false);
    expect(parseEco2mixHistory([...rows, rows[0]]).ok).toBe(false); // a region twice in a step
    expect(parseEco2mixHistory([...rows, { ...rows[0], code_insee_region: "94" }]).ok).toBe(false);
    expect(parseEco2mixHistory([...rows, "row"]).ok).toBe(false);
    const many = Array.from({ length: HISTORY_ROWS + 1 }, () => rows[0]);
    expect(parseEco2mixHistory(many)).toEqual({ ok: false, reason: "too many rows" });
  });
});

describe("stepAt", () => {
  const steps: RegionalReadings[] = [10, 20, 30, 40].map((timeMs) => ({ timeMs, byRegion: {} }));

  it("gives the latest step at or before the time, or null before the first", () => {
    expect(stepAt(steps, 5)).toBeNull();
    expect(stepAt(steps, 10)?.timeMs).toBe(10);
    expect(stepAt(steps, 29)?.timeMs).toBe(20);
    expect(stepAt(steps, 1e9)?.timeMs).toBe(40);
    expect(stepAt([], 50)).toBeNull();
  });

  it("agrees with a linear scan on random steps and times", () => {
    const random = mulberry32(14);
    for (let n = 0; n < 200; n++) {
      const times = Array.from({ length: Math.floor(random() * 20) }, () =>
        Math.floor(random() * 1000),
      ).sort((a, b) => a - b);
      const list = [...new Set(times)].map((timeMs) => ({ timeMs, byRegion: {} }));
      const t = Math.floor(random() * 1100) - 50;
      const naive = list.filter((s) => s.timeMs <= t).at(-1) ?? null;
      expect(stepAt(list, t)).toBe(naive);
    }
  });
});

describe("replayClock", () => {
  const fake = (): Clock & { t: number } => {
    const c = { t: 1000, now: () => c.t };
    return c;
  };

  it("plays the span in the period, from its start, over and over", () => {
    const animation = fake();
    const clock = replayClock(Date.UTC(2026, 10, 11, 18), HISTORY_MS, 60_000, animation);
    expect(clock.now()).toBe(Date.UTC(2026, 10, 11, 18));
    animation.t += 30_000;
    expect(clock.now()).toBe(Date.UTC(2026, 10, 12, 6));
    animation.t += 30_000;
    expect(clock.now()).toBe(Date.UTC(2026, 10, 11, 18));
    animation.t += 15_000;
    expect(clock.now()).toBe(Date.UTC(2026, 10, 12, 0));
  });

  it("never shows an instant past the span's end", () => {
    const animation = fake();
    const clock = replayClock(0, HISTORY_MS, 60_000, animation);
    for (let k = 0; k < 500; k++) {
      animation.t += 997;
      expect(clock.now()).toBeGreaterThanOrEqual(0);
      expect(clock.now()).toBeLessThan(HISTORY_MS);
    }
  });
});

describe("timelapseFromQuery and replayState", () => {
  it("accepts ?timelapse=day only", () => {
    expect(timelapseFromQuery("?timelapse=day")).toBe("day");
    expect(timelapseFromQuery("")).toBeUndefined();
    expect(timelapseFromQuery("?timelapse=week")).toBeUndefined();
    expect(timelapseFromQuery("?timelapse=day&timelapse=day")).toBeUndefined();
    expect(timelapseFromQuery(`?timelapse=day&x=${"a".repeat(3000)}`)).toBeUndefined();
  });

  it("labels a replayed step with its own time, and none as unavailable", () => {
    expect(replayState({ timeMs: 42, byRegion: {} })).toEqual({ kind: "replay", timeMs: 42 });
    expect(replayState(null)).toEqual({ kind: "unavailable" });
  });
});
