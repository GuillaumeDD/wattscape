/**
 * Ordered (Bayer) dithering: the only way the scene draws a gradient, by mixing two
 * palette colours pixel by pixel (ARCHITECTURE § Art direction). Integer arithmetic
 * only, so every engine draws the same pixels.
 */
import { type ColourName, PALETTE } from "./palette.ts";
import { setPixel, type Surface } from "./surface.ts";

/** The 4 × 4 Bayer matrix: each threshold 0–15 once, spread as evenly as possible. */
export const BAYER_4: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Mix levels: 0 is all the first colour, 16 all the second. */
export const DITHER_LEVELS = 16;

/** The mix level (0–16) nearest to a fraction; out-of-range and NaN fractions clamp. */
export function ditherLevel(fraction: number): number {
  if (!(fraction > 0)) return 0;
  if (fraction >= 1) return DITHER_LEVELS;
  return Math.round(fraction * DITHER_LEVELS);
}

/**
 * Whether the pixel at (x, y) takes the second colour at a mix `level` (0–16). Over
 * any 4 × 4 block, exactly `level` pixels do. Negative coordinates wrap like
 * positive ones, so a pattern does not jump at the origin.
 */
export function takesSecond(x: number, y: number, level: number): boolean {
  return (BAYER_4[y & 3]?.[x & 3] ?? 0) < level;
}

/** Fills a rectangle with a mix of two palette colours at a mix `level` (0–16). */
export function fillDithered(
  surface: Surface,
  left: number,
  top: number,
  width: number,
  height: number,
  first: ColourName,
  second: ColourName,
  level: number,
): void {
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      setPixel(surface, x, y, PALETTE[takesSecond(x, y, level) ? second : first]);
    }
  }
}

/**
 * A vertical gradient from `first` (top row) to `second` (bottom row) through the 17
 * mix levels, as the sky, fog and water depth are drawn.
 */
export function fillGradient(
  surface: Surface,
  left: number,
  top: number,
  width: number,
  height: number,
  first: ColourName,
  second: ColourName,
): void {
  for (let row = 0; row < height; row++) {
    // Integer division: the row's level, from 0 on the top row to 16 on the bottom one.
    const level = height > 1 ? Math.floor((row * DITHER_LEVELS) / (height - 1)) : 0;
    fillDithered(surface, left, top + row, width, 1, first, second, level);
  }
}
