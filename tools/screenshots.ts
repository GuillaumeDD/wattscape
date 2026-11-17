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
 * among them, in one picture. Then the plants (B-012), the towns (B-014), the
 * rivers (B-023) and the landmarks (B-016), as each section says; and the modern
 * theme (G-011, `step-6-modern-*.png`), its own plants (B-027, `step-7-*.png`) and
 * its own landmarks by lots (`step-8-modern-landmarks.png`, the second lot in
 * `step-9-modern-landmarks.png`, the third in `step-10-modern-landmarks.png`), at the sharp density a full HD screen gets (D-058,
 * `step-8-modern-sharp-*.png`).
 */
import { coarseLayer, fineLayer } from "../src/map/layers.ts";
import { kmOf, type CellRegion } from "../src/map/grid.ts";
import { FINE_ELEVATION_RLE } from "../src/map/relief.ts";
import { LESSER_RIVERS_PACKED } from "../src/map/rivers-fine.ts";
import { drawModernScene, MODERN_SHARP_DENSITY } from "../src/render/modern-theme.ts";
import { drawPixelScene } from "../src/render/pixel-theme.ts";
import { createSurface, hashSurface, type Surface } from "../src/render/surface.ts";
import { areaBox, type Camera, fitBox, flightAt } from "../src/scene/camera.ts";
import { LANDMARKS } from "../src/map/landmarks.ts";
import { detailForScale, bakedTowns, type Scene } from "../src/scene/scene.ts";
import { lightAt } from "../src/sky/light.ts";
import { MODERN_DENSITY, recordedTownLights, referenceScene } from "../e2e/reference-frames.ts";
import { writePng } from "./png.ts";

const OUT = process.argv[2] ?? "docs/screenshots";
const WIDTH = 480;
const HEIGHT = 270;
const coarse = coarseLayer();
const fine = fineLayer(FINE_ELEVATION_RLE, LESSER_RIVERS_PACKED);
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
    towns: bakedTowns(),
    plants: [],
    townLights: recordedTownLights(elevation < 0),
    landmarks: LANDMARKS,
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

// Step 3, B-014: the towns lit at night by their region's consumption, from the two
// recorded steps (DS-01) against the baked ranges (DS-12): Île-de-France and
// Normandie by day and at night; and Paris close up at four lights, 0, ⅓, ⅔ and 1
// of its range, 2 × 2.
for (const [name, focus] of [
  ["ile-de-france", "11"],
  ["normandie", "28"],
] as const)
  for (const [time, elevation] of [
    ["day", 35],
    ["night", -20],
  ] as const) {
    const camera = fitBox(areaBox(coarse, focus), WIDTH, HEIGHT);
    const surface = createSurface(WIDTH, HEIGHT);
    drawPixelScene(referenceScene(focus, camera, elevation), surface).animate(surface, 1.3);
    const file = `${OUT}/step-3-towns-${name}-${time}.png`;
    writePng(file, surface, 2);
    console.log(
      `${file}: ${JSON.stringify(referenceScene(focus, camera, elevation).townLights[focus])}`,
    );
  }
const lights = createSurface(WIDTH * 2 + 4, HEIGHT * 2 + 4);
const paris: Camera = { ...kmOf(48.86, 2.35), scale: 6 };
[0, 1 / 3, 2 / 3, 1].forEach((light, k) => {
  const frame = createSurface(WIDTH, HEIGHT);
  drawPixelScene({ ...referenceScene("11", paris, -20), townLights: { "11": light } }, frame);
  const left = (k % 2) * (WIDTH + 4);
  const top = Math.floor(k / 2) * (HEIGHT + 4);
  for (let y = 0; y < HEIGHT; y++)
    lights.data.set(
      frame.data.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4),
      ((top + y) * lights.width + left) * 4,
    );
});
writePng(`${OUT}/step-3-towns-paris-lights.png`, lights, 1);
console.log(`${OUT}/step-3-towns-paris-lights.png`);

/** Writes each view by day and at night, with the plants of the two recorded steps. */
function dayAndNight(prefix: string, views: readonly [string, CellRegion | null, Camera][]): void {
  for (const [name, focus, camera] of views)
    for (const [time, elevation] of [
      ["day", 35],
      ["night", -20],
    ] as const) {
      const surface = createSurface(WIDTH, HEIGHT);
      drawPixelScene(referenceScene(focus, camera, elevation), surface).animate(surface, 1.3);
      const file = `${OUT}/${prefix}-${name}-${time}.png`;
      writePng(file, surface, 2);
      console.log(`${file}: scale ${camera.scale.toFixed(2)}, ${hashSurface(surface)}`);
    }
}

// Step 4, B-023: the rivers. The great ones on France seen whole; all of them in
// two regions and close up on the Loire between Orléans and Tours.
dayAndNight("step-4-rivers", [
  ["france", null, france],
  ["normandie", "28", normandie],
  ["auvergne-rhone-alpes", "84", fitBox(areaBox(coarse, "84"), WIDTH, HEIGHT)],
  ["loire", "24", { ...kmOf(47.6, 1.3), scale: 3 }],
]);

// Step 4, B-017: the diffuse sources by installed capacity (D-041), in the regions
// that hold the most wind and the most solar, and one with little wind: Hauts-de-France,
// Nouvelle-Aquitaine and Occitanie.
dayAndNight(
  "step-4-diffuse",
  (["32", "75", "76"] as const).map((region, k) => [
    ["hauts-de-france", "nouvelle-aquitaine", "occitanie"][k] ?? region,
    region,
    fitBox(areaBox(coarse, region), WIDTH, HEIGHT),
  ]),
);

// Step 4, B-016: a landmark in every region. Three regions as the app frames them,
// then each landmark from close (3 pixels per km), side by side in the order of
// src/map/landmarks.ts, by day and at night.
dayAndNight(
  "step-4-landmarks",
  (["11", "53", "93"] as const).map((region, k) => [
    ["ile-de-france", "bretagne", "provence-alpes-cote-d-azur"][k] ?? region,
    region,
    fitBox(areaBox(coarse, region), WIDTH, HEIGHT),
  ]),
);
// The second lot (D-048), in two regions that gained landmarks.
dayAndNight(
  "step-4-landmarks-2",
  (["32", "76"] as const).map((region, k) => [
    ["hauts-de-france", "occitanie"][k] ?? region,
    region,
    fitBox(areaBox(coarse, region), WIDTH, HEIGHT),
  ]),
);
// The third lot (D-049): the salt marshes, the lighthouse, the Puy de Dôme and the
// Calanques, in two of their regions.
dayAndNight(
  "step-4-landmarks-3",
  (["52", "84"] as const).map((region, k) => [
    ["pays-de-la-loire", "auvergne-rhone-alpes"][k] ?? region,
    region,
    fitBox(areaBox(coarse, region), WIDTH, HEIGHT),
  ]),
);
{
  const TILE_W = 96;
  const TILE_H = 64;
  const PER_ROW = 5;
  for (const [time, elevation] of [
    ["day", 35],
    ["night", -20],
  ] as const) {
    const sheet = createSurface(TILE_W * PER_ROW, TILE_H * Math.ceil(LANDMARKS.length / PER_ROW));
    LANDMARKS.forEach((landmark, k) => {
      const tile = createSurface(TILE_W, TILE_H);
      const camera = { x: landmark.x, y: landmark.y - 3, scale: 3 };
      const scene = { ...referenceScene(null, camera, elevation), width: TILE_W, height: TILE_H };
      drawPixelScene(scene, tile).animate(tile, 1.3);
      const left = (k % PER_ROW) * TILE_W;
      const top = Math.floor(k / PER_ROW) * TILE_H;
      for (let y = 0; y < TILE_H; y++)
        sheet.data.set(
          tile.data.subarray(y * TILE_W * 4, (y + 1) * TILE_W * 4),
          ((top + y) * sheet.width + left) * 4,
        );
    });
    const file = `${OUT}/step-4-landmarks-close-${time}.png`;
    writePng(file, sheet, 4);
    console.log(`${file}: ${hashSurface(sheet)}`);
  }
}

// The modern theme (G-011), at 2 output pixels per scene pixel: France and two
// regions as the app frames them, by day and at night, with the recorded plants.
for (const [name, focus] of [
  ["france", null],
  ["normandie", "28"],
  ["auvergne-rhone-alpes", "84"],
] as const)
  for (const [time, elevation] of [
    ["day", 35],
    ["night", -20],
  ] as const) {
    const camera = fitBox(areaBox(coarse, focus), WIDTH, HEIGHT);
    const surface = createSurface(WIDTH * MODERN_DENSITY, HEIGHT * MODERN_DENSITY);
    drawModernScene(referenceScene(focus, camera, elevation), surface).animate(surface, 1.3);
    const file = `${OUT}/step-6-modern-${name}-${time}.png`;
    writePng(file, surface);
    console.log(`${file}: ${hashSurface(surface)}`);
  }

// The modern theme's own plants (B-027): two regions with most kinds of plants, by
// day and at night, their motion at 1.3 s.
for (const [name, focus] of [
  ["normandie", "28"],
  ["centre-val-de-loire", "24"],
] as const)
  for (const [time, elevation] of [
    ["day", 35],
    ["night", -20],
  ] as const) {
    const camera = fitBox(areaBox(coarse, focus), WIDTH, HEIGHT);
    const surface = createSurface(WIDTH * MODERN_DENSITY, HEIGHT * MODERN_DENSITY);
    drawModernScene(referenceScene(focus, camera, elevation), surface).animate(surface, 1.3);
    const file = `${OUT}/step-7-modern-plants-${name}-${time}.png`;
    writePng(file, surface);
    console.log(`${file}: ${hashSurface(surface)}`);
  }

// The modern theme's own landmarks (B-027), lot by lot: each one close up, by day
// (left) and at night (right), without the plants, at the sharp density (D-058), as
// a full HD screen shows them, twice enlarged.
for (const [file, lot] of [
  [
    "step-8-modern-landmarks.png",
    [
      "etretat",
      "portCranes",
      "harbourLight",
      "montSaintMichel",
      "eiffelTower",
      "rouenCathedral",
      "seaLighthouse",
    ],
  ],
  [
    "step-9-modern-landmarks.png",
    [
      "slagHeaps",
      "lilleBelfry",
      "amiensCathedral",
      "strasbourgCathedral",
      "hautKoenigsbourg",
      "chartresCathedral",
      "chambord",
    ],
  ],
  [
    "step-10-modern-landmarks.png",
    [
      "nantesCastle",
      "carnacStones",
      "saltMarshes",
      "pilatDune",
      "fortBoyard",
      "placeDeLaBourse",
      "carcassonne",
    ],
  ],
] as const) {
  const drawn = LANDMARKS.filter((l) => (lot as readonly string[]).includes(l.sprite));
  const [w, h] = [40, 26];
  const density = MODERN_SHARP_DENSITY;
  const sheet = createSurface(w * density * 2, h * density * drawn.length);
  drawn.forEach((landmark, row) => {
    [35, -20].forEach((elevation, column) => {
      const camera = { x: landmark.x, y: landmark.y - 8, scale: 1 };
      const scene = { ...referenceScene(null, camera, elevation), width: w, height: h, plants: [] };
      const surface = createSurface(w * density, h * density);
      drawModernScene(scene, surface);
      for (let y = 0; y < surface.height; y++)
        sheet.data.set(
          surface.data.subarray(y * surface.width * 4, (y + 1) * surface.width * 4),
          ((row * surface.height + y) * sheet.width + column * surface.width) * 4,
        );
    });
  });
  writePng(`${OUT}/${file}`, sheet, 2);
  console.log(`${OUT}/${file}: ${hashSurface(sheet)}`);
}

// The modern theme at the sharp density (D-058), as a full HD screen shows it: two
// regions, by day and at night, their plants' motion at 1.3 s.
for (const [name, focus] of [
  ["normandie", "28"],
  ["ile-de-france", "11"],
] as const)
  for (const [time, elevation] of [
    ["day", 35],
    ["night", -20],
  ] as const) {
    const camera = fitBox(areaBox(coarse, focus), WIDTH, HEIGHT);
    const surface = createSurface(WIDTH * MODERN_SHARP_DENSITY, HEIGHT * MODERN_SHARP_DENSITY);
    drawModernScene(referenceScene(focus, camera, elevation), surface).animate(surface, 1.3);
    const file = `${OUT}/step-8-modern-sharp-${name}-${time}.png`;
    writePng(file, surface);
    console.log(`${file}: ${hashSurface(surface)}`);
  }
