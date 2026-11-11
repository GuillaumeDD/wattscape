/**
 * The moon's phase from the mean synodic month: the time since a known new moon,
 * modulo the average lunation. The true new moon wanders up to about 15 hours from
 * the mean one, so the phase is right to within a day (ARCHITECTURE § Sky), which is
 * enough to draw it. Checked against an independent ephemeris (S-012) in
 * tests/moon.test.ts.
 */

/** Mean synodic month, days (Meeus, "Astronomical Algorithms", ch. 49). */
export const SYNODIC_MONTH_DAYS = 29.530588861;

const MS_PER_DAY = 86_400_000;

/**
 * The mean new moon of k = 0 (Meeus, ch. 49): JDE 2451550.09766, that is
 * 2000-01-06 14:20:37 TT, ms since the epoch. TT runs about a minute ahead of UTC,
 * which is negligible here.
 */
const MEAN_NEW_MOON_MS = (2_451_550.09766 - 2_440_587.5) * MS_PER_DAY;

export interface MoonPhase {
  /** Days since the last mean new moon, in [0, {@link SYNODIC_MONTH_DAYS}). */
  readonly ageDays: number;
  /** Position in the cycle, [0, 1): 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  readonly cycle: number;
  /**
   * Lit fraction of the disc, [0, 1], from the cycle. Uses `Math.cos`: it may only
   * shape how the moon is drawn, never what the world contains.
   */
  readonly illuminated: number;
}

/** The moon's phase at `timeMs` (ms since the epoch); `null` for a non-finite time. */
export function moonPhase(timeMs: number): MoonPhase | null {
  if (!Number.isFinite(timeMs)) return null;
  const days = (timeMs - MEAN_NEW_MOON_MS) / MS_PER_DAY;
  const ageDays = ((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const cycle = ageDays / SYNODIC_MONTH_DAYS;
  return { ageDays, cycle, illuminated: (1 - Math.cos(2 * Math.PI * cycle)) / 2 };
}
