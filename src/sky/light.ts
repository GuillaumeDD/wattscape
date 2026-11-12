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

/**
 * Sky gradient keyframes: zenith and horizon colours at given solar elevations. In
 * between, each end moves from one keyframe's colour to the next by dithering, so the
 * sky never jumps; beyond the ends it stays. Night is the night sky; at −4° the
 * horizon is blue; at sunrise and sunset it is golden under a blue zenith; at 6° the
 * day's sky.
 */
export const SKY_KEYFRAMES: readonly (readonly [number, ColourName, ColourName])[] = [
  [-12, "skyNight", "skyNight"],
  [-4, "skyNight", "skyBlueHour"],
  [0, "skyBlueHour", "skyGolden"],
  [6, "skyDay", "skyDay"],
];

/** The most darkness the tint counts: past it every chain has reached skyNight. */
const MAX_DARKNESS = 16;

export interface Light {
  readonly period: Period;
  /** Land darkness in palette steps, 0 (day) to 2 (night), fractional in between. */
  readonly darkness: number;
  /** Sky gradient, zenith (top) to horizon (bottom): each end is a mix (0–16) of a
   * colour and the next keyframe's, at `skyLevel`. */
  readonly skyTop: ColourName;
  readonly skyTopNext: ColourName;
  readonly skyHorizon: ColourName;
  readonly skyHorizonNext: ColourName;
  readonly skyLevel: number;
  /** Whether windows, beacons and other emissive pixels are drawn: sun below the horizon. */
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

/** The sky's two ends at a solar elevation, and how far each is towards the next. */
function skyAt(
  elevation: number,
): Pick<Light, "skyTop" | "skyTopNext" | "skyHorizon" | "skyHorizonNext" | "skyLevel"> {
  const first = SKY_KEYFRAMES[0] ?? [0, "skyNight", "skyNight"];
  const last = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1] ?? first;
  let from = first;
  let to = first;
  let fraction = 0;
  if (elevation >= last[0]) from = to = last;
  else if (elevation > first[0]) {
    // NaN fails both tests above and stays at night.
    for (let i = 1; i < SKY_KEYFRAMES.length; i++) {
      to = SKY_KEYFRAMES[i] ?? last;
      from = SKY_KEYFRAMES[i - 1] ?? first;
      if (elevation < to[0]) break;
    }
    fraction = (elevation - from[0]) / (to[0] - from[0]);
  }
  return {
    skyTop: from[1],
    skyTopNext: to[1],
    skyHorizon: from[2],
    skyHorizonNext: to[2],
    skyLevel: ditherLevel(fraction),
  };
}

export function lightAt(elevation: number): Light {
  return {
    period: periodOf(elevation),
    darkness: darknessAt(elevation),
    ...skyAt(elevation),
    emissive: !(elevation >= 0), // NaN reads as night
  };
}

/**
 * The sky's colour at (x, y), `level` (0–16) of the way from zenith to horizon. The
 * keyframe mix uses the Bayer pattern shifted by (1, 2), so that it does not line up
 * with the gradient's own.
 */
export function skyColour(light: Light, level: number, x: number, y: number): ColourName {
  const next = takesSecond(x + 1, y + 2, light.skyLevel);
  if (takesSecond(x, y, level)) return next ? light.skyHorizonNext : light.skyHorizon;
  return next ? light.skyTopNext : light.skyTop;
}

/**
 * The colour a land pixel at (x, y) is drawn in under `darkness`: its own colour,
 * whole steps darker, and one more step on the share of pixels the fraction asks for
 * (ordered dithering, so the change is even across the land). A darkness that is not
 * a number reads as night; past 16 steps every colour is skyNight anyway.
 */
export function tinted(colour: ColourName, darkness: number, x: number, y: number): ColourName {
  const d = Number.isNaN(darkness)
    ? darknessAt(Number.NaN)
    : Math.min(MAX_DARKNESS, Math.max(0, darkness));
  const whole = Math.floor(d);
  const level = ditherLevel(d - whole);
  if (level === DITHER_LEVELS) return darken(colour, whole + 1);
  return darken(colour, whole + (takesSecond(x, y, level) ? 1 : 0));
}
