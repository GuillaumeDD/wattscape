/**
 * The reference frames whose hashes are recorded in tests/fixtures/frames/hashes.json:
 * Node draws them in tests/render.test.ts and tests/pixel-theme.test.ts, Chromium in
 * e2e/frame-hash.spec.ts, and both must agree (AGENTS.md § Determinism). Fixed inputs
 * only: a 480 × 270 buffer, cameras framed as the app frames an area, fixed lights.
 */
import { kmOf, type CellRegion } from "../src/map/grid.ts";
import { coarseLayer, fineLayer } from "../src/map/layers.ts";
import { FINE_ELEVATION_RLE } from "../src/map/relief.ts";
import { drawPixelScene } from "../src/render/pixel-theme.ts";
import { createSurface, type Surface } from "../src/render/surface.ts";
import { drawTestCard } from "../src/render/test-card.ts";
import { areaBox, type Camera, fitBox } from "../src/scene/camera.ts";
import { detailForScale, prefectureTowns } from "../src/scene/scene.ts";
import { lightAt } from "../src/sky/light.ts";

export const FRAME_WIDTH = 480;
export const FRAME_HEIGHT = 270;

function scene(focus: CellRegion | null, camera: Camera, sunElevation: number): Surface {
  const out = createSurface(FRAME_WIDTH, FRAME_HEIGHT);
  drawPixelScene(
    {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      camera,
      light: lightAt(sunElevation),
      focus,
      coarse: coarseLayer(),
      fine: fineLayer(FINE_ELEVATION_RLE),
      detail: detailForScale(camera.scale),
      towns: prefectureTowns(),
    },
    out,
  );
  return out;
}

const framed = (region: CellRegion | null): Camera =>
  fitBox(areaBox(coarseLayer(), region), FRAME_WIDTH, FRAME_HEIGHT);

/** Every reference frame, by the name its hash is recorded under. */
export const REFERENCE_FRAMES: Readonly<Record<string, () => Surface>> = {
  "test-card": drawTestCard,
  "scene-france-day": () => scene(null, framed(null), 35),
  "scene-france-night": () => scene(null, framed(null), -20),
  "scene-normandie-golden": () => scene("28", framed("28"), 2),
  "scene-normandie-night": () => scene("28", framed("28"), -20),
  "scene-auvergne-rhone-alpes-day": () => scene("84", framed("84"), 35),
  // Halfway between the 4 km and the 1 km layers: a crossfade (detail 8).
  "scene-crossfade-day": () => scene(null, { ...kmOf(45.5, 3), scale: 0.6 }, 35),
  "scene-mont-blanc-day": () => scene("84", { ...kmOf(45.83, 6.86), scale: 4 }, 35),
};
