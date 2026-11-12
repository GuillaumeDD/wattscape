/**
 * The time-lapse's figures (B-014, `?timelapse=day`): every region's published steps
 * over the day before `endMs`, asked for once, then the step the replay clock is at,
 * handed on each time it changes. The light follows the same clock, so the plants and
 * the towns show, at every instant of the replay, the figures RTE published for it.
 */
import { type Clock } from "../clock/clock";
import { fetchEco2mixHistory, type RegionalReadings, stepAt } from "../data/eco2mix";
import { type FeedState } from "./plant-feed";

/** How often the replay looks for a new step: every 100 ms, 24 minutes of a day in a minute. */
const TICK_MS = 100;

/** The note for the step a replay shows, or "unavailable" before its first step. */
export function replayState(step: RegionalReadings | null): FeedState {
  return step === null ? { kind: "unavailable" } : { kind: "replay", timeMs: step.timeMs };
}

export function startReplayFeed(
  clock: Clock,
  endMs: number,
  fetchFn: typeof fetch,
  onReadings: (readings: RegionalReadings | null, state: FeedState) => void,
): void {
  onReadings(null, { kind: "loading" });
  fetchEco2mixHistory(endMs, fetchFn)
    .then((result) => {
      if (!result.ok) {
        onReadings(null, { kind: "unavailable" });
        return;
      }
      const steps = result.reading;
      let shown: RegionalReadings | null | undefined;
      const tick = (): void => {
        const step = stepAt(steps, clock.now());
        if (step === shown) return;
        shown = step;
        onReadings(step, replayState(step));
      };
      tick();
      window.setInterval(() => {
        if (!document.hidden) tick();
      }, TICK_MS);
    })
    .catch(() => {
      onReadings(null, { kind: "unavailable" });
    });
}
