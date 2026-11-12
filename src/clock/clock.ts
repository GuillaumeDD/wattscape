/**
 * The only reader of wall-clock time (ARCHITECTURE § Module layout). Everything else
 * takes a `Clock`, so tests and demos can fix the time.
 */
export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/**
 * A fixed clock, for `?at=` (demos, screenshots): the scene shows that instant, and
 * nothing that depends on the time of day moves.
 */
export function fixedClock(timeMs: number): Clock {
  return { now: () => timeMs };
}

/**
 * Monotonic milliseconds for animation only (camera flights, idle drift): never the
 * time of day, and unaffected by `?at=`.
 */
export const animationClock: Clock = {
  now: () => performance.now(),
};

/**
 * A replay, for the time-lapse (B-014): the span [startMs, startMs + spanMs) played
 * in `periodMs` of animation time, over and over, from the moment it is made. Like
 * `?at=`, it only ever shows instants that have passed.
 */
export function replayClock(
  startMs: number,
  spanMs: number,
  periodMs: number,
  animation: Clock = animationClock,
): Clock {
  const t0 = animation.now();
  return {
    now: () => {
      const elapsed = animation.now() - t0;
      const phase = (((elapsed % periodMs) + periodMs) % periodMs) / periodMs;
      return startMs + Math.floor(phase * spanMs);
    },
  };
}
