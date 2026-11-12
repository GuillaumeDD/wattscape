/**
 * The scene view alone (src/ui/scene-view.ts), at a fixed time, for e2e/scene.spec.ts
 * to drive with the mouse and the keyboard. With `?plants=live`, the plants' feed
 * (src/ui/plant-feed.ts) runs too, at the time of the recorded step the test serves,
 * and `#plants-note` tells its state. With `?plants=replay`, the time-lapse's feed
 * (src/ui/replay-feed.ts) replays the three hours the test serves in 6 seconds, and
 * the note tells the state and the step's time.
 */
import { fixedClock, replayClock } from "../src/clock/clock";
import { startPlantFeed } from "../src/ui/plant-feed";
import { startReplayFeed } from "../src/ui/replay-feed";
import { mountSceneView } from "../src/ui/scene-view";

const params = new URLSearchParams(location.search);
const canvas = document.getElementById("scene");
if (canvas instanceof HTMLCanvasElement) {
  const area = params.get("area") === "28" ? "28" : "FR";
  const live = params.get("plants") === "live";
  const replay = params.get("plants") === "replay";
  // 2026-11-12 10:30 UTC: 45 minutes after the step recorded that day.
  const clock = fixedClock(live ? Date.UTC(2026, 10, 12, 10, 30) : Date.UTC(2026, 5, 21, 12));
  if (replay) {
    // 2026-11-12, 09:00 to 12:00 UTC, the recorded hours, in 6 seconds.
    const end = Date.UTC(2026, 10, 12, 12);
    const span = 3 * 60 * 60 * 1000;
    const fast = replayClock(end - span, span, 6000);
    const view = mountSceneView(canvas, fast, area, true);
    startReplayFeed(
      fast,
      end,
      (input, init) => fetch(input, init),
      (readings, state) => {
        const note = document.getElementById("plants-note");
        if (note)
          note.textContent = `${state.kind} ${"timeMs" in state ? String(state.timeMs) : ""}`;
        view.setReadings(readings, true);
      },
    );
  }
  const view = replay ? null : mountSceneView(canvas, clock, area);
  if (live && view !== null)
    startPlantFeed(
      clock,
      (input, init) => fetch(input, init),
      (readings, state) => {
        const note = document.getElementById("plants-note");
        if (note) note.textContent = state.kind;
        view.setReadings(readings);
      },
    );
}
