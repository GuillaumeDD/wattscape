import { describe, expect, it } from "vitest";
import { REGION_CODES, type RegionCode } from "../src/data/eco2mix";
import { kindOfRegion } from "../src/map/grid";
import { coarseLayer } from "../src/map/layers";
import { areaBox, type Camera, fitBox } from "../src/scene/camera";
import {
  createTour,
  dwellMs,
  firstStop,
  FRANCE_DWELL_MS,
  rampLeftMs,
  REGION_DWELL_MS,
  setTourPlaying,
  smoothPath,
  startTourClock,
  SURVEY_FLIGHT_MAX_MS,
  SURVEY_FLIGHT_MIN_MS,
  SURVEY_LOOP,
  surveyFlightMs,
  TOUR_RAMP_MS,
  type TourClock,
  tourRate,
  tourTime,
} from "../src/scene/survey";
import { mulberry32 } from "./random";

const W = 480;
const H = 270;
const coarse = coarseLayer();
const stops: Camera[] = SURVEY_LOOP.map((a) =>
  fitBox(areaBox(coarse, a === "FR" ? null : a), W, H),
);
const france = stops[SURVEY_LOOP.indexOf("FR")] as Camera;
const random = mulberry32(32);

/** The gap between two cameras, as a share of the view: on screen, not in kilometres. */
function gap(a: Camera, b: Camera): number {
  const s = Math.min(a.scale, b.scale);
  return Math.max(
    (Math.abs(a.x - b.x) * s) / W,
    (Math.abs(a.y - b.y) * s) / 2 / H,
    Math.abs(Math.log(a.scale / b.scale)),
  );
}

/** Whether two regions share a cell edge on the 4 km layer. */
function bordering(a: number, b: number): boolean {
  const { columns, kinds } = coarse;
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] !== a) continue;
    const c = i % columns;
    if (kinds[i + columns] === b || kinds[i - columns] === b) return true;
    if ((c + 1 < columns && kinds[i + 1] === b) || (c > 0 && kinds[i - 1] === b)) return true;
  }
  return false;
}

describe("SURVEY_LOOP", () => {
  it("visits each of the 12 regions once, then the whole of France", () => {
    expect(SURVEY_LOOP).toHaveLength(13);
    expect([...SURVEY_LOOP].sort()).toEqual([...REGION_CODES, "FR"].sort());
    expect(SURVEY_LOOP.at(-1)).toBe("FR");
  });

  it("flies only between bordering regions, so every flight is short", () => {
    const regions = SURVEY_LOOP.filter((a): a is RegionCode => a !== "FR");
    for (let i = 1; i < regions.length; i++) {
      const [a, b] = [regions[i - 1], regions[i]];
      if (a === undefined || b === undefined) throw new Error("loop");
      expect(bordering(kindOfRegion(a), kindOfRegion(b)), `${a} → ${b}`).toBe(true);
    }
  });
});

describe("firstStop and dwellMs", () => {
  it("starts one stop after the area shown: the next region, or the north after France", () => {
    expect(SURVEY_LOOP[firstStop("FR")]).toBe("32");
    expect(SURVEY_LOOP[firstStop("28")]).toBe("24");
    expect(SURVEY_LOOP[firstStop("11")]).toBe("FR");
    for (const a of SURVEY_LOOP) expect(SURVEY_LOOP[firstStop(a)]).not.toBe(a);
  });

  it("stays longer over France than over a region", () => {
    expect(dwellMs("FR")).toBe(FRANCE_DWELL_MS);
    expect(dwellMs("28")).toBe(REGION_DWELL_MS);
    expect(FRANCE_DWELL_MS).toBeGreaterThan(REGION_DWELL_MS);
  });
});

describe("smoothPath", () => {
  const pairs: [Camera, Camera][] = stops.map((s, i) => [
    s,
    stops[(i + 1) % stops.length] as Camera,
  ]);
  // Random cameras too: far apart, close, zoomed in and out.
  for (let k = 0; k < 40; k++)
    pairs.push([
      { x: random() * 1100, y: random() * 1100, scale: 0.15 + random() * 4 },
      { x: random() * 1100, y: random() * 1100, scale: 0.15 + random() * 4 },
    ]);

  it("starts and ends at its cameras", () => {
    for (const [a, b] of pairs) {
      const path = smoothPath(a, b, W);
      expect(gap(path.at(0), a)).toBeLessThan(1e-9);
      expect(path.at(1)).toEqual(b);
      expect(gap(path.at(1 - 1e-9), b)).toBeLessThan(1e-6);
    }
  });

  it("moves smoothly: no step of 1/400 of the way jumps by more than 2 % of the view", () => {
    for (const [a, b] of pairs) {
      const path = smoothPath(a, b, W);
      let last = path.at(0);
      for (let i = 1; i <= 400; i++) {
        const next = path.at(i / 400);
        expect(gap(last, next)).toBeLessThan(0.02 + path.length * 0.01);
        last = next;
      }
    }
  });

  it("reads the same backwards: the flight from b to a retraces the one from a to b", () => {
    for (const [a, b] of pairs) {
      const there = smoothPath(a, b, W);
      const back = smoothPath(b, a, W);
      expect(back.length).toBeCloseTo(there.length, 9);
      for (const t of [0.1, 0.3, 0.5, 0.8])
        expect(gap(there.at(t), back.at(1 - t))).toBeLessThan(1e-6);
    }
  });

  it("rises a little between two regions, never above France", () => {
    let rose = 0;
    for (let i = 0; i + 1 < stops.length - 1; i++) {
      const [a, b] = [stops[i] as Camera, stops[i + 1] as Camera];
      const path = smoothPath(a, b, W);
      let lowest = Math.min(a.scale, b.scale);
      for (let k = 0; k <= 100; k++) lowest = Math.min(lowest, path.at(k / 100).scale);
      if (lowest < Math.min(a.scale, b.scale) * 0.999) rose++;
      // Measured 2026-11-21: at most 7 % above the farther stop (Bretagne → Normandie).
      expect(lowest, SURVEY_LOOP[i]).toBeGreaterThan(Math.min(a.scale, b.scale) / 1.15);
      expect(lowest, SURVEY_LOOP[i]).toBeGreaterThan(france.scale);
    }
    expect(rose).toBeGreaterThan(0);
  });

  it("rises higher with a higher ρ, between two stops far apart", () => {
    const [a, b] = [stops[0] as Camera, stops[6] as Camera];
    const lowest = (rho: number): number => {
      const path = smoothPath(a, b, W, rho);
      let low = Infinity;
      for (let k = 0; k <= 100; k++) low = Math.min(low, path.at(k / 100).scale);
      return low;
    };
    expect(lowest(1.6)).toBeLessThan(lowest(1.2));
    expect(lowest(1.2)).toBeLessThan(Math.min(a.scale, b.scale));
  });

  it("zooms in place evenly in log space", () => {
    const a: Camera = { x: 500, y: 500, scale: 0.5 };
    const b: Camera = { x: 500, y: 500, scale: 4 };
    const path = smoothPath(a, b, W);
    expect(path.at(0.5).scale).toBeCloseTo(Math.sqrt(0.5 * 4), 9);
    expect(path.at(0.5).x).toBe(500);
    expect(smoothPath(a, a, W).length).toBe(0);
  });
});

describe("surveyFlightMs", () => {
  it("lasts between the survey's bounds, longer for a longer path", () => {
    for (let i = 0; i < stops.length; i++) {
      const path = smoothPath(stops[i] as Camera, stops[(i + 1) % stops.length] as Camera, W);
      const ms = surveyFlightMs(path);
      expect(ms).toBeGreaterThanOrEqual(SURVEY_FLIGHT_MIN_MS);
      expect(ms).toBeLessThanOrEqual(SURVEY_FLIGHT_MAX_MS);
    }
    const short = smoothPath(stops[0] as Camera, stops[1] as Camera, W);
    const long = smoothPath(stops[0] as Camera, stops[5] as Camera, W);
    expect(surveyFlightMs(long)).toBeGreaterThan(surveyFlightMs(short));
    expect(surveyFlightMs({ length: Number.NaN, at: () => france })).toBe(SURVEY_FLIGHT_MIN_MS);
    // Regression: a flight that goes nowhere lasted 6 s, drawing the same frame.
    expect(surveyFlightMs(smoothPath(france, france, W))).toBe(0);
  });
});

describe("createTour", () => {
  const start: Camera = { x: 300, y: 400, scale: 2 };
  const tour = createTour(start, stops, firstStop("FR"), W);
  /** The tour's moments every 50 ms over `ms`. */
  const walk = (ms: number) => {
    const moments = [];
    for (let t = 0; t <= ms; t += 50) moments.push({ t, ...tour.at(t) });
    return moments;
  };
  const loopMs = SURVEY_LOOP.reduce(
    (sum, _a, i) =>
      sum +
      dwellMs(SURVEY_LOOP[i] ?? "FR") +
      surveyFlightMs(
        smoothPath(stops[(i + stops.length - 1) % stops.length] as Camera, stops[i] as Camera, W),
      ),
    0,
  );

  it("starts from the camera on screen, and flies first to the stop asked for", () => {
    const first = tour.at(0);
    expect(first.camera).toEqual(start);
    expect(first.flying).toBe(true);
    expect(first.area).toBe("32");
  });

  it("visits the stops in the loop's order, and stays still at each for its dwell", () => {
    const moments = walk(loopMs + 60_000);
    const visited: string[] = [];
    for (const m of moments) if (visited.at(-1) !== m.area) visited.push(m.area);
    expect(visited.slice(0, 14)).toEqual([...SURVEY_LOOP, "32"]);
    for (const m of moments.filter((m) => !m.flying)) {
      expect(m.camera).toEqual(stops[m.stop]);
      expect(m.area).toBe(SURVEY_LOOP[m.stop]);
    }
    // The still time is a whole dwell, counted down.
    const still = moments.filter((m) => !m.flying && m.area === "28");
    expect(Math.max(...still.map((m) => m.stillMs))).toBeLessThanOrEqual(REGION_DWELL_MS);
    expect(Math.max(...still.map((m) => m.stillMs))).toBeGreaterThan(REGION_DWELL_MS - 100);
    expect(still.length * 50).toBeGreaterThanOrEqual(REGION_DWELL_MS - 50);
  });

  it("never jumps: from a moment to the next, the camera moves by little", () => {
    const moments = walk(loopMs + 60_000);
    for (let i = 1; i < moments.length; i++) {
      const [a, b] = [moments[i - 1], moments[i]];
      if (a === undefined || b === undefined) continue;
      expect(gap(a.camera, b.camera), String(b.t)).toBeLessThan(0.05);
    }
  });

  it("goes round the loop for ever: a lap later, the same moment", () => {
    const opening = tour.at(0).stillMs; // 0 while flying: find the opening's end instead
    expect(opening).toBe(0);
    for (let k = 0; k < 20; k++) {
      // A moment after the opening leg, which lasts at most a flight and a region's stay.
      const t = SURVEY_FLIGHT_MAX_MS + REGION_DWELL_MS + random() * loopMs;
      const a = tour.at(t);
      const b = tour.at(t + 7 * loopMs);
      expect(b.area).toBe(a.area);
      expect(gap(a.camera, b.camera)).toBeLessThan(1e-9);
    }
  });

  it("cuts from stop to stop with reduced motion: never in flight", () => {
    const cut = createTour(start, stops, 0, W, true);
    for (let t = 0; t < 2 * loopMs; t += 1000) expect(cut.at(t).flying).toBe(false);
    expect(cut.at(0).camera).toEqual(stops[0]);
    expect(cut.at(REGION_DWELL_MS + 1).camera).toEqual(stops[1]);
  });

  it("starts with its stay when it starts at its first stop (a resize during a stay)", () => {
    const here = createTour(stops[3] as Camera, stops, 3, W);
    expect(here.at(0).flying).toBe(false);
    expect(here.at(0).stillMs).toBe(REGION_DWELL_MS);
    expect(here.at(REGION_DWELL_MS + 1).flying).toBe(true);
  });

  it("treats a bad tour time as its start", () => {
    expect(tour.at(Number.NaN).camera).toEqual(start);
    expect(tour.at(-5).camera).toEqual(start);
  });
});

describe("TourClock", () => {
  /** The naive reference: the speed summed by steps of 1 ms. */
  function naive(events: readonly { wall: number; playing: boolean }[], wall: number): number {
    let rate = 0;
    let playing = true;
    let tau = 0;
    let e = 0;
    for (let t = 0; t < wall; t++) {
      while (e < events.length && (events[e]?.wall ?? Infinity) <= t)
        playing = events[e++]?.playing ?? playing;
      const next = playing
        ? Math.min(1, rate + 1 / TOUR_RAMP_MS)
        : Math.max(0, rate - 1 / TOUR_RAMP_MS);
      tau += (rate + next) / 2;
      rate = next;
    }
    return tau;
  }

  it("ramps up from a stop, then runs with the animation clock", () => {
    const clock = startTourClock(1000);
    expect(tourTime(clock, 1000)).toBe(0);
    expect(tourRate(clock, 1000 + TOUR_RAMP_MS / 2)).toBeCloseTo(0.5, 9);
    expect(tourTime(clock, 1000 + TOUR_RAMP_MS)).toBeCloseTo(TOUR_RAMP_MS / 2, 9);
    expect(tourTime(clock, 1000 + TOUR_RAMP_MS + 5000)).toBeCloseTo(TOUR_RAMP_MS / 2 + 5000, 9);
    expect(rampLeftMs(clock, 1000)).toBe(TOUR_RAMP_MS);
    expect(rampLeftMs(clock, 1000 + TOUR_RAMP_MS)).toBe(0);
  });

  it("slows down to a stop on pause, and stands still after", () => {
    let clock = startTourClock(0);
    clock = setTourPlaying(clock, 10_000, false);
    const atPause = tourTime(clock, 10_000);
    expect(tourTime(clock, 10_000 + TOUR_RAMP_MS)).toBeCloseTo(atPause + TOUR_RAMP_MS / 2, 9);
    expect(tourTime(clock, 10_000 + 60_000)).toBeCloseTo(atPause + TOUR_RAMP_MS / 2, 9);
    expect(rampLeftMs(clock, 10_000 + 60_000)).toBe(0);
  });

  it("matches a step-by-step sum of its speed, for random plays and pauses", () => {
    for (let k = 0; k < 20; k++) {
      const events: { wall: number; playing: boolean }[] = [];
      let clock: TourClock = startTourClock(0);
      let wall = 0;
      let playing = true;
      for (let i = 0; i < 6; i++) {
        wall += Math.floor(random() * 2500);
        playing = !playing;
        events.push({ wall, playing });
        clock = setTourPlaying(clock, wall, playing);
      }
      for (const t of [wall, wall + 400, wall + 3000])
        expect(Math.abs(tourTime(clock, t) - naive(events, t))).toBeLessThan(1);
    }
  });

  it("is continuous at a change, and a repeated command changes nothing", () => {
    const clock = startTourClock(0);
    const paused = setTourPlaying(clock, 500, false);
    expect(tourTime(paused, 500)).toBeCloseTo(tourTime(clock, 500), 9);
    expect(setTourPlaying(paused, 900, false)).toBe(paused);
  });

  it("switches at once with no ramp (reduced motion)", () => {
    let clock = startTourClock(0, 0);
    expect(tourTime(clock, 3000)).toBe(3000);
    clock = setTourPlaying(clock, 3000, false);
    expect(tourTime(clock, 9000)).toBe(3000);
    expect(rampLeftMs(clock, 3000)).toBe(0);
  });
});
