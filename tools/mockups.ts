/**
 * Draws the art direction mockups (B-010) from the baked map, the palette and the
 * light keyframes, into docs/screenshots/. Run by hand:
 *
 *   node --experimental-strip-types tools/mockups.ts
 *
 * France and Normandie, by day (sun at 35°), at the golden hour (sun at 2°) and at
 * night (sun at −20°). Fixed inputs: the same files every run.
 */
import { drawMapView } from "../src/render/map-view.ts";
import { hashSurface } from "../src/render/surface.ts";
import { lightAt } from "../src/sky/light.ts";
import { writePng } from "./png.ts";

const OUT = process.argv[2] ?? "docs/screenshots";
const views: [string, number, "28" | undefined][] = [
  ["france", 2, undefined],
  ["normandie", 8, "28"],
];
for (const [name, tile, region] of views) {
  for (const [time, elevation] of [
    ["day", 35],
    ["golden", 2],
    ["night", -20],
  ] as const) {
    const surface = drawMapView({
      tile,
      light: lightAt(elevation),
      ...(region === undefined ? {} : { region }),
    });
    const file = `${OUT}/step-2-mockup-${name}-${time}.png`;
    writePng(file, surface, 2);
    console.log(`${file}: ${surface.width} × ${surface.height}, ${hashSurface(surface)}`);
  }
}
