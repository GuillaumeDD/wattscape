/**
 * A brush (src/render/art/shapes.ts) that draws nothing and writes down what it was
 * asked, for the tests of the modern theme's drawings.
 */
import type { Brush, Ink } from "../src/render/art/shapes";
import { PALETTE, type Rgb } from "../src/render/palette";

/** What a brush was asked to draw. */
export interface Fill {
  readonly kind: "fill";
  /** Where the shape is, measured on a grid of quarter pixels: its bounding box. */
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly colour: Rgb;
  readonly ink: Ink | undefined;
}
export interface Spot {
  readonly kind: "spot";
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly colour: Rgb;
  readonly alpha: number;
  readonly unlit: boolean;
}

/** A brush that draws nothing and writes down what it was asked. */
export function recorder(emissive = false): Brush & { readonly calls: (Fill | Spot)[] } {
  const calls: (Fill | Spot)[] = [];
  return {
    emissive,
    calls,
    fill(left, top, right, bottom, distance, colour, ink) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let y = top + 0.125; y < bottom; y += 0.25)
        for (let x = left + 0.125; x < right; x += 0.25)
          if (distance(x, y) < 0) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      calls.push({ kind: "fill", left: x0, top: y0, right: x1, bottom: y1, colour, ink });
    },
    spot(cx, cy, rx, ry, colour, alpha, unlit = false) {
      calls.push({ kind: "spot", cx, cy, rx, ry, colour, alpha, unlit });
    },
  };
}

export const fills = (calls: readonly (Fill | Spot)[]): Fill[] =>
  calls.filter((c): c is Fill => c.kind === "fill");
export const spots = (calls: readonly (Fill | Spot)[]): Spot[] =>
  calls.filter((c): c is Spot => c.kind === "spot");
/** A lamp: the lamp's colour, drawn as it is. */
export const isLamp = (c: Fill): boolean => c.colour === PALETTE.lamp && c.ink?.unlit === true;
