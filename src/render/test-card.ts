/**
 * A test card that exercises the palette, the dithering and the light keyframes. Its
 * hash is the frame-hash check that Node and Chromium draw the same pixels
 * (AGENTS.md § Determinism; tests/render.test.ts and e2e/frame-hash.spec.ts). It is
 * also a quick way to look at the palette (tools/preview-palette.ts).
 */
import { fillDithered, fillGradient } from "./dither.ts";
import { COLOUR_NAMES, type ColourName, PALETTE } from "./palette.ts";
import { createSurface, setPixel, type Surface } from "./surface.ts";
import { lightAt, tinted } from "../sky/light.ts";

export const TEST_CARD_WIDTH = 96;
export const TEST_CARD_HEIGHT = 72;

/** Solar elevations of the tint strips: day, golden hour, sunset, blue hour, night. */
export const TEST_CARD_ELEVATIONS: readonly number[] = [30, 3, -1, -7.5, -20];

export function drawTestCard(): Surface {
  const s = createSurface(TEST_CARD_WIDTH, TEST_CARD_HEIGHT);
  fillDithered(s, 0, 0, TEST_CARD_WIDTH, TEST_CARD_HEIGHT, "skyNight", "skyNight", 0);
  // Row 1: the 24 colours, 4 × 8 each.
  COLOUR_NAMES.forEach((name, i) => {
    fillDithered(s, i * 4, 0, 4, 8, name, name, 0);
  });
  // Row 2: the five skies, as gradients from zenith to horizon.
  TEST_CARD_ELEVATIONS.forEach((elevation, i) => {
    const light = lightAt(elevation);
    fillGradient(s, i * 19, 8, 19, 24, light.skyTop, light.skyHorizon);
  });
  // Row 3: the 17 mix levels between two land colours.
  for (let level = 0; level <= 16; level++) {
    fillDithered(s, level * 5, 32, 5, 8, "grass", "field", level);
  }
  // Rows 4 to 8: a strip of land colours under each light, lamps where emissive.
  const land: readonly ColourName[] = [
    "forest",
    "grass",
    "meadow",
    "field",
    "sand",
    "soil",
    "rock",
    "snow",
    "roof",
  ];
  TEST_CARD_ELEVATIONS.forEach((elevation, row) => {
    const light = lightAt(elevation);
    for (let x = 0; x < TEST_CARD_WIDTH; x++) {
      const name = land[Math.floor(x / 11)] ?? "sea";
      for (let y = 40 + row * 6; y < 46 + row * 6; y++) {
        setPixel(s, x, y, PALETTE[tinted(name, light.darkness, x, y)]);
      }
      if (light.emissive && x % 11 === 5) setPixel(s, x, 42 + row * 6, PALETTE.lamp);
    }
  });
  return s;
}
