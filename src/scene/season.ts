/**
 * The season of a date (B-022, D-008): four keyframes, mid-January, mid-April,
 * mid-July and mid-October, and between two of them a change that spreads across
 * the map over six weeks, patch by patch, never on one day for all. Pure, + − × /
 * and integer hashing only: where a patch has turned decides what is drawn.
 */
import { valueNoise } from "./clouds.ts";

export const SEASONS = ["winter", "spring", "summer", "autumn"] as const;
export type Season = (typeof SEASONS)[number];

/** The season a frame shows: `share` of the land (0–1) has turned from `from` to `to`. */
export interface SeasonState {
  readonly from: Season;
  readonly to: Season;
  readonly share: number;
}

/**
 * Each season at its fullest, in days since 1 January (0-based): the 15th of its
 * month. Counted the same in a leap year, so from March on it falls a day earlier
 * there (the 14th): a day in a six-week change.
 */
const KEYFRAME_DAYS: Readonly<Record<Season, number>> = {
  winter: 14,
  spring: 104,
  summer: 195,
  autumn: 287,
};

/** How long the change from one season to the next takes, days. */
export const TURN_DAYS = 42;

/**
 * The share is kept to steps of 1/32, so the land is redrawn about once a day at
 * most (42 days in 32 steps).
 */
const SHARE_STEPS = 32;

const DAY_MS = 86_400_000;

/** The season at an instant, from its date (UTC). */
export function seasonAt(timeMs: number): SeasonState {
  if (!Number.isFinite(timeMs)) return { from: "summer", to: "summer", share: 0 };
  const year = new Date(timeMs).getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const length = (Date.UTC(year + 1, 0, 1) - start) / DAY_MS;
  const day = (timeMs - start) / DAY_MS;
  for (let k = 0; k < SEASONS.length; k++) {
    const from = SEASONS[k] ?? "winter";
    const to = SEASONS[(k + 1) % SEASONS.length] ?? "winter";
    const a = KEYFRAME_DAYS[from];
    // The next keyframe, a year later for winter after autumn.
    const b = KEYFRAME_DAYS[to] + (to === "winter" ? length : 0);
    // Before mid-January, the days count from the past year's autumn.
    const d = from === "autumn" && day < KEYFRAME_DAYS.winter ? day + length : day;
    if (d < a || d >= b) continue;
    const middle = (a + b) / 2;
    const t = (d - (middle - TURN_DAYS / 2)) / TURN_DAYS;
    const share = Math.round(Math.min(1, Math.max(0, t)) * SHARE_STEPS) / SHARE_STEPS;
    if (share >= 1) return { from: to, to, share: 0 };
    return share > 0 ? { from, to, share } : { from, to: from, share: 0 };
  }
  return { from: "summer", to: "summer", share: 0 };
}

/** The noise that places the patches: smooth over about 60 km. */
const PATCH_KM = 60;
const PATCH_SEED = 97;

/**
 * The noise's own quantiles, measured once on a fixed lattice of the noise (pure
 * arithmetic, the same in every engine): mapping a value through them spreads the
 * points evenly over the change, so that each step of the share turns about as
 * much land as the next, and none turns on the first or the last day all at once.
 */
const QUANTILES: readonly number[] = (() => {
  const values: number[] = [];
  for (let j = 0; j < 96; j++)
    for (let i = 0; i < 96; i++)
      values.push(valueNoise(i * 0.37 + 0.11, j * 0.41 + 0.07, PATCH_SEED));
  values.sort((a, b) => a - b);
  const steps = 64;
  const q: number[] = [];
  for (let k = 0; k <= steps; k++)
    q.push(values[Math.round((k / steps) * (values.length - 1))] ?? k / steps);
  q[0] = 0;
  q[steps] = 1;
  return q;
})();

/**
 * Where a point of the map stands in the change, in [0, 1): it shows the next season
 * once the state's share passes it. The noise, flattened by its quantiles, so that
 * the change spreads by patches at an even pace.
 */
export function turnAt(xKm: number, yKm: number): number {
  const v = valueNoise(xKm / PATCH_KM, yKm / PATCH_KM, PATCH_SEED);
  const steps = QUANTILES.length - 1;
  let lo = 0;
  let hi = steps;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((QUANTILES[mid] ?? 0) <= v) lo = mid;
    else hi = mid;
  }
  const a = QUANTILES[lo] ?? 0;
  const b = QUANTILES[hi] ?? 1;
  const f = b > a ? (v - a) / (b - a) : 0;
  return Math.min(0.999, (lo + f) / steps);
}

/** The season a point of the map shows. */
export function seasonOf(state: SeasonState, xKm: number, yKm: number): Season {
  return state.share > 0 && turnAt(xKm, yKm) < state.share ? state.to : state.from;
}

/** How wide the soft edge of a patch is, in shares of the change. */
const EDGE = 0.3;

/**
 * How far a point has turned to the next season, 0–1, with a soft edge: for a theme
 * that blends colours (the modern one) rather than picking one. The share is
 * stretched by the edge's width, so every point is still at 0 as the change starts
 * and already at 1 as it ends: the blend never jumps.
 */
export function turnedAt(state: SeasonState, xKm: number, yKm: number): number {
  if (!(state.share > 0)) return 0;
  const share = state.share * (1 + EDGE) - EDGE / 2;
  const t = Math.min(1, Math.max(0, (share - turnAt(xKm, yKm)) / EDGE + 0.5));
  return t * t * (3 - 2 * t);
}
