/**
 * The survey mode (B-032, D-073): a slow tour of the map, from region to region and
 * then over the whole of France, played, paused and stopped by the viewer. Pure: the
 * tour is a function of its stops (the cameras the app frames them with), of where
 * it started from, and of the tour's own time, which `TourClock` derives from the
 * animation clock; nothing here reads the clock or the DOM.
 *
 * Like the camera, the tour animates the scene and never decides what the world
 * holds, so it may use Math.exp, Math.log and Math.cosh (AGENTS.md § Determinism).
 */
import { type Eco2mixArea } from "../data/eco2mix.ts";
import { type Camera, ease } from "./camera.ts";

/**
 * The tour, clockwise from the north: each region borders the next, so every flight
 * is short and the map unrolls like a coastline; Île-de-France, in the middle, hands
 * over to the whole of France, which hands over to the north again.
 */
export const SURVEY_LOOP: readonly Eco2mixArea[] = [
  "32", // Hauts-de-France
  "44", // Grand Est
  "27", // Bourgogne-Franche-Comté
  "84", // Auvergne-Rhône-Alpes
  "93", // Provence-Alpes-Côte d'Azur
  "76", // Occitanie
  "75", // Nouvelle-Aquitaine
  "52", // Pays de la Loire
  "53", // Bretagne
  "28", // Normandie
  "24", // Centre-Val de Loire
  "11", // Île-de-France
  "FR",
];

/** How long the tour stays over a region, still, in ms. */
export const REGION_DWELL_MS = 40_000;
/** How long it stays over the whole of France, in ms. */
export const FRANCE_DWELL_MS = 60_000;
/** The shortest and the longest flight between two stops, in ms. */
export const SURVEY_FLIGHT_MIN_MS = 6000;
export const SURVEY_FLIGHT_MAX_MS = 12_000;
/**
 * How far the flight rises between two stops: van Wijk and Nuij's ρ (2003). Their
 * optimum is √2 ≈ 1.41; a lower value rises less, for a calmer flight.
 */
export const SURVEY_RHO = 1.2;
/** A pause slows the tour down to a stop, and a play speeds it up, over this long. */
export const TOUR_RAMP_MS = 1200;

export type SurveyCommand = "play" | "pause" | "stop";

/** What the survey mode is doing, for its controls. */
export interface SurveyState {
  readonly mode: "off" | "playing" | "paused";
  /** The area the tour flies to or stays over; null when it is off. */
  readonly area: Eco2mixArea | null;
}

/** The stop after `area` in the loop: the tour starts there, one flight away. */
export function firstStop(area: Eco2mixArea): number {
  const i = SURVEY_LOOP.indexOf(area);
  return (i + 1) % SURVEY_LOOP.length;
}

/** How long the tour stays at a stop. */
export function dwellMs(area: Eco2mixArea): number {
  return area === "FR" ? FRANCE_DWELL_MS : REGION_DWELL_MS;
}

/**
 * The smooth flight of van Wijk and Nuij ("Smooth and efficient zooming and
 * panning", 2003): the camera rises while it travels and comes down on arrival, so
 * that the ground slides across the screen at a steady pace. Distances are counted
 * as on screen: a kilometre north–south is half as many pixels (2:1 tiles).
 */
export interface SmoothPath {
  /** The path's length, in its own units: the flight's time is proportional to it. */
  readonly length: number;
  /** The camera at `s` (0–1) of the path's length, uneased. */
  at(s: number): Camera;
}

export function smoothPath(from: Camera, to: Camera, width: number, rho = SURVEY_RHO): SmoothPath {
  const w0 = width / from.scale;
  const w1 = width / to.scale;
  const dx = to.x - from.x;
  const dy = (to.y - from.y) / 2;
  const d = Math.hypot(dx, dy);
  const rho2 = rho * rho;
  const scaleOf = (w: number): number => width / w;
  if (!(d * rho2 > 1e-6 * Math.max(w0, w1))) {
    // In place: a zoom alone, evenly in log space.
    const k = Math.log(w1 / w0);
    return {
      length: Math.abs(k) / rho,
      at(s) {
        const t = Math.min(1, Math.max(0, s));
        if (t <= 0) return from;
        return {
          x: from.x + dx * t,
          y: from.y + 2 * dy * t,
          scale: t >= 1 ? to.scale : scaleOf(w0 * Math.exp(k * t)),
        };
      },
    };
  }
  const b = (w: number, sign: number): number =>
    (w1 * w1 - w0 * w0 + sign * rho2 * rho2 * d * d) / (2 * w * rho2 * d);
  const r = (bi: number): number => Math.log(Math.sqrt(bi * bi + 1) - bi);
  const r0 = r(b(w0, 1));
  const r1 = r(b(w1, -1));
  const length = (r1 - r0) / rho;
  return {
    length,
    at(s) {
      const t = Math.min(1, Math.max(0, s));
      if (t <= 0) return from;
      if (t >= 1) return to;
      const q = rho * length * t + r0;
      const u = (w0 / rho2) * (Math.cosh(r0) * Math.tanh(q) - Math.sinh(r0));
      const w = (w0 * Math.cosh(r0)) / Math.cosh(q);
      const share = u / d;
      return { x: from.x + dx * share, y: from.y + 2 * dy * share, scale: scaleOf(w) };
    },
  };
}

/**
 * How long the flight along `path` lasts: steady, between the survey's bounds; none
 * for a path that goes nowhere (the camera is already there).
 */
export function surveyFlightMs(path: SmoothPath): number {
  if (path.length < 1e-3) return 0;
  const ms = SURVEY_FLIGHT_MIN_MS + 2500 * path.length;
  return Number.isFinite(ms) ? Math.min(SURVEY_FLIGHT_MAX_MS, ms) : SURVEY_FLIGHT_MIN_MS;
}

/** One leg of the tour: a flight to a stop, then the stay there. */
interface Leg {
  readonly stop: number;
  readonly path: SmoothPath;
  readonly flightMs: number;
  readonly dwellMs: number;
}

/** Where the tour is at a moment. */
export interface TourMoment {
  readonly camera: Camera;
  /** The stop the tour flies to, or stays at: its area is the one in focus. */
  readonly stop: number;
  readonly area: Eco2mixArea;
  /** Whether the camera is in flight; else it stays still. */
  readonly flying: boolean;
  /** Tour time until the camera next moves (0 while it flies). */
  readonly stillMs: number;
}

export interface Tour {
  /** The tour `tau` ms of tour time after it started. */
  at(tau: number): TourMoment;
}

/**
 * The tour of `stops` (one camera per area of `SURVEY_LOOP`, framed for the view),
 * from `start`, the camera on screen when it starts: a flight to stop `first`, its
 * stay, a flight to the next, and so on, round the loop for ever. With `cut`
 * (reduced motion) the flights take no time: the view changes from stop to stop.
 */
export function createTour(
  start: Camera,
  stops: readonly Camera[],
  first: number,
  width: number,
  cut = false,
): Tour {
  const n = stops.length;
  const stopAt = (i: number): Camera => {
    const camera = stops[((i % n) + n) % n];
    if (camera === undefined) throw new Error("tour: no stops");
    return camera;
  };
  const leg = (from: Camera, stop: number): Leg => {
    const path = smoothPath(from, stopAt(stop), width);
    const area = SURVEY_LOOP[stop] ?? "FR";
    return { stop, path, flightMs: cut ? 0 : surveyFlightMs(path), dwellMs: dwellMs(area) };
  };
  const firstStop = ((first % n) + n) % n;
  const opening = leg(start, firstStop);
  // After the opening leg, the tour goes round the loop: n legs, the same each time.
  const loop: Leg[] = [];
  for (let k = 1; k <= n; k++) loop.push(leg(stopAt(firstStop + k - 1), (firstStop + k) % n));
  const period = loop.reduce((sum, l) => sum + l.flightMs + l.dwellMs, 0);

  const momentOf = (l: Leg, t: number): TourMoment => {
    const area = SURVEY_LOOP[l.stop] ?? "FR";
    if (t < l.flightMs)
      return {
        camera: l.path.at(ease(t / l.flightMs)),
        stop: l.stop,
        area,
        flying: true,
        stillMs: 0,
      };
    return {
      camera: stopAt(l.stop),
      stop: l.stop,
      area,
      flying: false,
      stillMs: l.flightMs + l.dwellMs - t,
    };
  };

  return {
    at(tau) {
      const t = Number.isFinite(tau) && tau > 0 ? tau : 0;
      const openingMs = opening.flightMs + opening.dwellMs;
      if (t < openingMs || !(period > 0)) return momentOf(opening, t);
      let rest = (t - openingMs) % period;
      for (const l of loop) {
        const ms = l.flightMs + l.dwellMs;
        if (rest < ms) return momentOf(l, rest);
        rest -= ms;
      }
      // Rounding at the end of the loop: the first leg again, from its start.
      const again = loop[0] ?? opening;
      return momentOf(again, 0);
    },
  };
}

/**
 * The tour's own time: it runs with the animation clock while the tour plays, and
 * stands still while it is paused. A pause slows it down to a stop, and a play speeds
 * it up, over `TOUR_RAMP_MS` (none with reduced motion), so the camera never jerks.
 */
export interface TourClock {
  /** Tour time at the last change. */
  readonly tau: number;
  /** Animation-clock time of the last change. */
  readonly wall: number;
  /** The speed at the last change: 0 (still) to 1 (the animation clock's). */
  readonly rate: number;
  /** Whether the tour plays: the speed ramps towards 1, else towards 0. */
  readonly playing: boolean;
  readonly rampMs: number;
}

export function startTourClock(wall: number, rampMs = TOUR_RAMP_MS): TourClock {
  return { tau: 0, wall, rate: rampMs > 0 ? 0 : 1, playing: true, rampMs };
}

/** The speed of the tour clock at `wall`. */
export function tourRate(clock: TourClock, wall: number): number {
  const dt = Math.max(0, wall - clock.wall);
  const target = clock.playing ? 1 : 0;
  if (clock.rampMs <= 0) return target;
  const step = dt / clock.rampMs;
  return clock.playing ? Math.min(1, clock.rate + step) : Math.max(0, clock.rate - step);
}

/** The tour time at `wall`: the integral of the speed, which ramps linearly. */
export function tourTime(clock: TourClock, wall: number): number {
  const dt = Math.max(0, wall - clock.wall);
  const target = clock.playing ? 1 : 0;
  if (clock.rampMs <= 0) return clock.tau + target * dt;
  // The ramp lasts until the speed reaches its target, then the speed holds.
  const rampDt = Math.min(dt, Math.abs(target - clock.rate) * clock.rampMs);
  const rateEnd = tourRate(clock, clock.wall + rampDt);
  return clock.tau + ((clock.rate + rateEnd) / 2) * rampDt + target * (dt - rampDt);
}

/** The clock played or paused at `wall`, from the time and speed it has then. */
export function setTourPlaying(clock: TourClock, wall: number, playing: boolean): TourClock {
  if (clock.playing === playing) return clock;
  return {
    tau: tourTime(clock, wall),
    wall,
    rate: tourRate(clock, wall),
    playing,
    rampMs: clock.rampMs,
  };
}

/** Animation-clock ms until the tour clock runs at its target speed (0 once it does). */
export function rampLeftMs(clock: TourClock, wall: number): number {
  const target = clock.playing ? 1 : 0;
  return Math.abs(target - tourRate(clock, wall)) * clock.rampMs;
}
