/**
 * Light keyframes (ARCHITECTURE § Sky, light and weather): from the sun's geometric
 * elevation, the period of the day, the sky's colours, how dark the land is, and
 * whether emissive pixels (windows, beacons) show. Darkness is counted in palette
 * steps (`DARKER` in src/render/palette.ts) and a fractional step is drawn by
 * dithering between two whole ones, so the land always stays in palette. Pure.
 */
import { DITHER_LEVELS, ditherLevel, takesSecond } from "../render/dither.ts";
import { type ColourName, darken } from "../render/palette.ts";

export type Period = "night" | "blueHour" | "goldenHour" | "day";

/** Lower bounds, in degrees of geometric solar elevation, of each period. */
export const PERIOD_FLOORS = { blueHour: -12, goldenHour: -4, day: 6 } as const;

/**
 * Darkness of the land, in palette steps, at given solar elevations; linear in
 * between, constant beyond the ends. Day is 0; the sun on the horizon, 1 step; full
 * night (below −12°, past nautical twilight), 2 steps, so the land still reads.
 */
export const DARKNESS_KEYFRAMES: readonly (readonly [number, number])[] = [
  [-12, 2],
  [-4, 1.5],
  [0, 1],
  [6, 0],
];

export interface Light {
  readonly period: Period;
  /** Land darkness in palette steps, 0 (day) to 2 (night), fractional in between. */
  readonly darkness: number;
  /** Sky gradient, zenith (top) to horizon (bottom). */
  readonly skyTop: ColourName;
  readonly skyHorizon: ColourName;
  /** Whether windows, beacons and other emissive pixels are drawn. */
  readonly emissive: boolean;
}

export function periodOf(elevation: number): Period {
  if (elevation >= PERIOD_FLOORS.day) return "day";
  if (elevation >= PERIOD_FLOORS.goldenHour) return "goldenHour";
  if (elevation >= PERIOD_FLOORS.blueHour) return "blueHour";
  return "night";
}

/** Land darkness at a solar elevation, by the keyframes above. */
export function darknessAt(elevation: number): number {
  const first = DARKNESS_KEYFRAMES[0] ?? [0, 0];
  const last = DARKNESS_KEYFRAMES[DARKNESS_KEYFRAMES.length - 1] ?? [0, 0];
  if (!(elevation > first[0])) return first[1]; // NaN reads as night, never as day
  if (elevation >= last[0]) return last[1];
  for (let i = 1; i < DARKNESS_KEYFRAMES.length; i++) {
    const [e1, d1] = DARKNESS_KEYFRAMES[i] ?? last;
    const [e0, d0] = DARKNESS_KEYFRAMES[i - 1] ?? first;
    if (elevation <= e1) return d0 + ((elevation - e0) / (e1 - e0)) * (d1 - d0);
  }
  return last[1];
}

const SKY: Readonly<Record<Period, readonly [ColourName, ColourName]>> = {
  night: ["skyNight", "skyNight"],
  blueHour: ["skyNight", "skyBlueHour"],
  goldenHour: ["skyBlueHour", "skyGolden"],
  day: ["skyDay", "skyDay"],
};

export function lightAt(elevation: number): Light {
  const period = periodOf(elevation);
  const [skyTop, skyHorizon] = SKY[period];
  return {
    period,
    darkness: darknessAt(elevation),
    skyTop,
    skyHorizon,
    emissive: period === "night" || period === "blueHour",
  };
}

/**
 * The colour a land pixel at (x, y) is drawn in under `darkness`: its own colour,
 * whole steps darker, and one more step on the share of pixels the fraction asks for
 * (ordered dithering, so the change is even across the land).
 */
export function tinted(colour: ColourName, darkness: number, x: number, y: number): ColourName {
  const whole = Math.floor(Math.max(0, darkness));
  const level = ditherLevel(Math.max(0, darkness) - whole);
  if (level === DITHER_LEVELS) return darken(colour, whole + 1);
  return darken(colour, whole + (takesSecond(x, y, level) ? 1 : 0));
}
