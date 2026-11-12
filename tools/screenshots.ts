/**
 * Draws reference frames of the scene (B-011) into docs/screenshots/, from fixed
 * inputs: the same files every run. Run by hand:
 *
 *   node --experimental-strip-types tools/screenshots.ts [out-dir]
 *
 * France and two regions (Normandie, Auvergne-Rhône-Alpes), each framed as the app
 * frames it in a 480 × 270 buffer, by day (sun at 35°), at the golden hour (2°) and
 * at night (−20°); a close view of the Mont Blanc massif; and four moments of the
 * flight from France to Normandie, the crossfade between the 4 km and 1 km layers
 * among them, in one picture.
 */
import { coarseLayer, fineLayer } from "../src/map/layers.ts";
import { kmOf, type CellRegion } from "../src/map/grid.ts";
import { FINE_ELEVATION_RLE } from "../src/map/relief.ts";
import { drawPixelScene } from "../src/render/pixel-theme.ts";
import { createSurface, hashSurface, type Surface } from "../src/render/surface.ts";
import { areaBox, type Camera, fitBox, flightAt } from "../src/scene/camera.ts";
import { detailForScale, prefectureTowns, type Scene } from "../src/scene/scene.ts";
import { lightAt } from "../src/sky/light.ts";
import { referenceScene } from "../e2e/reference-frames.ts";
import { writePng } from "./png.ts";

const OUT = process.argv[2] ?? "docs/screenshots";
const WIDTH = 480;
const HEIGHT = 270;
const coarse = coarseLayer();
const fine = fineLayer(FINE_ELEVATION_RLE);
const views: [string, CellRegion | null, Camera][] = [
  ["france", null, fitBox(areaBox(coarse, null), WIDTH, HEIGHT)],
  ["normandie", "28", fitBox(areaBox(coarse, "28"), WIDTH, HEIGHT)],
  ["auvergne-rhone-alpes", "84", fitBox(areaBox(coarse, "84"), WIDTH, HEIGHT)],
  ["mont-blanc", "84", { ...kmOf(45.83, 6.86), scale: 4 }],
];
function draw(camera: Camera, focus: CellRegion | null, elevation: number): Surface {
  const surface = createSurface(WIDTH, HEIGHT);
  const scene: Scene = {
    width: WIDTH,
    height: HEIGHT,
    camera,
    light: lightAt(elevation),
    focus,
    coarse,
    fine,
    detail: detailForScale(camera.scale),
    towns: prefectureTowns(),
    plants: [],
  };
  drawPixelScene(scene, surface);
  return surface;
}

for (const [name, focus, camera] of views) {
  for (const [time, elevation] of [
    ["day", 35],
    ["golden", 2],
    ["night", -20],
  ] as const) {
    const surface = draw(camera, focus, elevation);
    const file = `${OUT}/step-3-${name}-${time}.png`;
    writePng(file, surface, 2);
    console.log(`${file}: scale ${camera.scale.toFixed(2)}, ${hashSurface(surface)}`);
  }
}

// The flight France → Normandie at four moments, 2 × 2, with a 4-pixel gap.
const france = fitBox(areaBox(coarse, null), WIDTH, HEIGHT);
const normandie = fitBox(areaBox(coarse, "28"), WIDTH, HEIGHT);
const sheet = createSurface(WIDTH * 2 + 4, HEIGHT * 2 + 4);
[0, 0.45, 0.6, 1].forEach((t, k) => {
  const frame = draw(flightAt(france, normandie, t), "28", 35);
  const left = (k % 2) * (WIDTH + 4);
  const top = Math.floor(k / 2) * (HEIGHT + 4);
  for (let y = 0; y < HEIGHT; y++)
    sheet.data.set(
      frame.data.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4),
      ((top + y) * sheet.width + left) * 4,
    );
});
writePng(`${OUT}/step-3-flight.png`, sheet, 1);
console.log(`${OUT}/step-3-flight.png`);

// Step 3, B-012: the plants, driven by two recorded steps of every region (day at
// 09:45 UTC, night at 01:00 UTC, 2026-11-12), in two regions and close up; and
// Normandie at four animation times, 2 × 2.
const plantViews: [string, CellRegion | null, Camera][] = [
  ["france", null, france],
  ["normandie", "28", normandie],
  ["auvergne-rhone-alpes", "84", fitBox(areaBox(coarse, "84"), WIDTH, HEIGHT)],
  ["rhone", "84", { ...kmOf(45.0, 4.9), scale: 2 }],
  ["seine-maritime", "28", { ...kmOf(49.75, 0.9), scale: 3 }],
];
for (const [name, focus, camera] of plantViews)
  for (const [time, elevation] of [
    ["day", 35],
    ["night", -20],
  ] as const) {
    const surface = createSurface(WIDTH, HEIGHT);
    drawPixelScene(referenceScene(focus, camera, elevation), surface).animate(surface, 1.3);
    const file = `${OUT}/step-3-plants-${name}-${time}.png`;
    writePng(file, surface, 2);
    console.log(`${file}: scale ${camera.scale.toFixed(2)}, ${hashSurface(surface)}`);
  }
const motion = createSurface(WIDTH * 2 + 4, HEIGHT * 2 + 4);
const close: Camera = { ...kmOf(49.8, 0.75), scale: 4 };
const still = createSurface(WIDTH, HEIGHT);
const drawn = drawPixelScene(referenceScene("28", close, 35), still);
[0, 0.4, 0.8, 1.2].forEach((seconds, k) => {
  const frame = createSurface(WIDTH, HEIGHT);
  frame.data.set(still.data);
  drawn.animate(frame, seconds);
  const left = (k % 2) * (WIDTH + 4);
  const top = Math.floor(k / 2) * (HEIGHT + 4);
  for (let y = 0; y < HEIGHT; y++)
    motion.data.set(
      frame.data.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4),
      ((top + y) * motion.width + left) * 4,
    );
});
writePng(`${OUT}/step-3-plants-motion.png`, motion, 1);
console.log(`${OUT}/step-3-plants-motion.png`);
