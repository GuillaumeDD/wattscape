import { describe, expect, it } from "vitest";
import { type Eco2mixReading, type RegionalReadings, STALE_AFTER_MS } from "../src/data/eco2mix";
import { feedState } from "../src/ui/plant-feed";

const T = Date.UTC(2026, 10, 12, 9, 45);
const readings = (timeMs: number): RegionalReadings => ({
  timeMs,
  byRegion: { "28": { area: "28", timeMs } as unknown as Eco2mixReading },
});

describe("feedState: what the page says about the plants' figures", () => {
  it("says live for a fresh step, with its time", () => {
    expect(feedState(readings(T), false, T + 60 * 60_000)).toEqual({ kind: "live", timeMs: T });
  });

  it("says stale past STALE_AFTER_MS, and still gives the time", () => {
    expect(feedState(readings(T), false, T + STALE_AFTER_MS + 1)).toEqual({
      kind: "stale",
      timeMs: T,
    });
  });

  it("says unavailable without a step or with no region", () => {
    expect(feedState(null, false, T)).toEqual({ kind: "unavailable" });
    expect(feedState({ timeMs: T, byRegion: {} }, false, T)).toEqual({ kind: "unavailable" });
  });

  it("says ahead for a step dated after the clock (a fixed ?at= in the past), not an outage", () => {
    expect(feedState(readings(T + 60 * 60_000), false, T)).toEqual({
      kind: "ahead",
      timeMs: T + 60 * 60_000,
    });
  });

  it("says sample for a recorded step, whatever its age", () => {
    expect(feedState(readings(T), true, T + 365 * 86_400_000)).toEqual({
      kind: "sample",
      timeMs: T,
    });
  });
});
