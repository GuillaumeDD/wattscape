/**
 * The scene view alone (src/ui/scene-view.ts), at a fixed time, for e2e/scene.spec.ts
 * to drive with the mouse and the keyboard.
 */
import { fixedClock } from "../src/clock/clock";
import { mountSceneView } from "../src/ui/scene-view";

const canvas = document.getElementById("scene");
if (canvas instanceof HTMLCanvasElement) {
  const area = new URLSearchParams(location.search).get("area") === "28" ? "28" : "FR";
  mountSceneView(canvas, fixedClock(Date.UTC(2026, 5, 21, 12)), area);
}
