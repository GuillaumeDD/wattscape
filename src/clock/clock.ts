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
