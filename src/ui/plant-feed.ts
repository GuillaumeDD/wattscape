/**
 * Keeps the plants' figures current (B-012): the latest step of every region, asked
 * for every 15 minutes while the tab is visible, never faster (ARCHITECTURE § Data
 * sources: rate limits); or a recorded sample, once. An answer that lands after the
 * tab was hidden is dropped; a failed refresh keeps the last good step, which the page
 * labels with its time, and tries again a minute later.
 */
import { animationClock, type Clock } from "../clock/clock";
import { fetchEco2mixRegions, freshness, type RegionalReadings } from "../data/eco2mix";
import { type Result } from "../data/fetch-json";

export const REFRESH_MS = 15 * 60 * 1000;
export const RETRY_MS = 60 * 1000;

/** What the page says about the plants' figures. */
export type FeedState =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | {
      /**
       * `ahead`: a step dated after the clock's time (a fixed `?at=` in the past, or
       * a wrong clock): not shown, the plants are idle. `replay`: a step of the
       * time-lapse (`?timelapse=day`).
       */
      readonly kind: "live" | "stale" | "sample" | "ahead" | "replay";
      readonly timeMs: number;
    };

/** The page's note for a step: live, stale, sample, ahead of the clock, or unavailable. */
export function feedState(
  readings: RegionalReadings | null,
  sample: boolean,
  nowMs: number,
): FeedState {
  if (readings === null) return { kind: "unavailable" };
  if (sample) return { kind: "sample", timeMs: readings.timeMs };
  const any = Object.values(readings.byRegion)[0];
  if (any === undefined) return { kind: "unavailable" };
  const f = freshness(any, nowMs);
  return {
    kind: f === "future" ? "ahead" : f === "stale" ? "stale" : "live",
    timeMs: readings.timeMs,
  };
}

/** Whether two notes say the same. */
function sameState(a: FeedState, b: FeedState): boolean {
  return a.kind === b.kind && ("timeMs" in a ? a.timeMs : 0) === ("timeMs" in b ? b.timeMs : 0);
}

export function startPlantFeed(
  clock: Clock,
  fetchFn: typeof fetch,
  onReadings: (readings: RegionalReadings | null, state: FeedState) => void,
): void {
  let last: RegionalReadings | null = null;
  let sent: { readonly readings: RegionalReadings | null; readonly state: FeedState } | null = null;
  let timer: number | null = null;
  let current: AbortController | null = null;
  let nextAt = 0;

  const schedule = (ms: number): void => {
    if (timer !== null) window.clearTimeout(timer);
    nextAt = animationClock.now() + ms;
    timer = window.setTimeout(() => {
      timer = null;
      void load();
    }, ms);
  };

  async function load(): Promise<void> {
    if (document.hidden) return;
    current?.abort();
    const controller = new AbortController();
    current = controller;
    const result: Result<RegionalReadings> = await fetchEco2mixRegions(fetchFn, controller.signal);
    // Hidden or superseded meanwhile: dropped, not shown as an outage.
    if (controller.signal.aborted || current !== controller) return;
    current = null;
    if (result.ok) last = result.reading;
    const state = feedState(last, false, clock.now());
    // A failed refresh that changes nothing redraws nothing.
    if (sent === null || sent.readings !== last || !sameState(sent.state, state)) {
      sent = { readings: last, state };
      onReadings(last, state);
    }
    schedule(result.ok ? REFRESH_MS : RETRY_MS);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      current?.abort();
      current = null;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    } else if (timer === null && current === null) {
      // Back in view: refresh now if the next refresh was due while hidden.
      schedule(Math.max(0, nextAt - animationClock.now()));
    }
  });
  sent = { readings: null, state: { kind: "loading" } };
  onReadings(null, sent.state);
  void load();
}
