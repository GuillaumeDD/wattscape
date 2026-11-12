/**
 * The scene view alone (src/ui/scene-view.ts), at a fixed time, for e2e/scene.spec.ts
 * to drive with the mouse and the keyboard. With `?plants=live`, the plants' feed
 * (src/ui/plant-feed.ts) runs too, at the time of the recorded step the test serves,
 * and `#plants-note` tells its state.
 */
import { fixedClock } from "../src/clock/clock";
import { startPlantFeed } from "../src/ui/plant-feed";
import { mountSceneView } from "../src/ui/scene-view";

const params = new URLSearchParams(location.search);
const canvas = document.getElementById("scene");
if (canvas instanceof HTMLCanvasElement) {
  const area = params.get("area") === "28" ? "28" : "FR";
  const live = params.get("plants") === "live";
  // 2026-11-12 10:30 UTC: 45 minutes after the step recorded that day.
  const clock = fixedClock(live ? Date.UTC(2026, 10, 12, 10, 30) : Date.UTC(2026, 5, 21, 12));
  const view = mountSceneView(canvas, clock, area);
  if (live)
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
