/**
 * The shapes the modern theme's drawings are made of (B-027): a brush, given by the
 * theme, and what to fill with it. Coordinates are scene pixels, fractions allowed:
 * pixel (x, y) of the pixel art covers [x, x + 1) × [y, y + 1). Pure, and with
 * additions, multiplications, divisions and square roots only (AGENTS.md §
 * Determinism).
 */
import { PALETTE, type Rgb } from "../palette.ts";

/** How a filled shape is drawn. */
export interface Ink {
  /** Its opacity, 1 by default. */
  readonly alpha?: number;
  /** Drawn as it is, not under the scene's light: a lamp, a shadow. */
  readonly unlit?: boolean;
  /** A factor on the colour at each place: the shading of a round wall. */
  readonly shade?: (x: number, y: number) => number;
}

/** What a theme gives to draw shapes with. */
export interface Brush {
  /** Whether lit windows show now (the sun is down). */
  readonly emissive: boolean;
  /**
   * Fills, within a box, where `distance` is negative: the distance to the shape's
   * edge in scene pixels, about; the edge is smoothed over one output pixel. With
   * `span`, only between the two x it gives at each y: a shape that fills little of
   * its box (a slanted line) need not be measured all over it. The span may be
   * wider than the shape, never narrower: it saves time, it changes no pixel.
   */
  fill(
    left: number,
    top: number,
    right: number,
    bottom: number,
    distance: (x: number, y: number) => number,
    colour: Rgb,
    ink?: Ink,
    span?: (y: number) => readonly [number, number],
  ): void;
  /** A soft spot: an ellipse, `alpha` at its centre, nothing at its rim. */
  spot(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    colour: Rgb,
    alpha: number,
    unlit?: boolean,
  ): void;
}

export const DARK: Rgb = [58, 52, 48];
export const BLACK: Rgb = [0, 0, 0];
export const LAMP = PALETTE.lamp;

export const clamp = (v: number, low: number, high: number): number =>
  v < low ? low : v > high ? high : v;

/** Lit from the west: 1 on the left edge of a wall `half` wide around `cx`, less on the right. */
export const round =
  (cx: number, half: number, dim = 0.2) =>
  (x: number): number =>
    1 - dim * clamp((x - cx) / half / 2 + 0.5, 0, 1);

export function box(
  brush: Brush,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colour: Rgb,
  ink?: Ink,
): void {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hw = (x1 - x0) / 2;
  const hh = (y1 - y0) / 2;
  brush.fill(
    x0 - 1,
    y0 - 1,
    x1 + 1,
    y1 + 1,
    (x, y) => Math.max(Math.abs(x - cx) - hw, Math.abs(y - cy) - hh),
    colour,
    ink,
  );
}

export function disc(
  brush: Brush,
  cx: number,
  cy: number,
  r: number,
  colour: Rgb,
  ink?: Ink,
): void {
  brush.fill(
    cx - r - 1,
    cy - r - 1,
    cx + r + 1,
    cy + r + 1,
    (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r,
    colour,
    ink,
  );
}

/** A line from a to b, `ra` thick at a (as a radius) and `rb` at b, with round ends. */
export function line(
  brush: Brush,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ra: number,
  rb: number,
  colour: Rgb,
  ink?: Ink,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy || 1;
  const r = Math.max(ra, rb) + 1;
  const flat = Math.abs(dy) < 1e-9;
  // The span's reach: the line's half-width, and half an output pixel over which its
  // edge fades (an output pixel is never wider than a scene pixel).
  const reach = Math.max(ra, rb) + 0.5;
  brush.fill(
    Math.min(ax, bx) - r,
    Math.min(ay, by) - r,
    Math.max(ax, bx) + r,
    Math.max(ay, by) + r,
    (x, y) => {
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / length2, 0, 1);
      const ex = x - ax - t * dx;
      const ey = y - ay - t * dy;
      return Math.sqrt(ex * ex + ey * ey) - (ra + (rb - ra) * t);
    },
    colour,
    ink,
    // At a height y, what lies within reach of the line lies within reach of its
    // points between y - reach and y + reach: of a slanted line, a short run of a row.
    (y) => {
      if (flat) return [Math.min(ax, bx) - reach, Math.max(ax, bx) + reach];
      const t0 = clamp((y - reach - ay) / dy, 0, 1);
      const t1 = clamp((y + reach - ay) / dy, 0, 1);
      const x0 = ax + t0 * dx;
      const x1 = ax + t1 * dx;
      return [Math.min(x0, x1) - reach, Math.max(x0, x1) + reach];
    },
  );
}

/** The distance to a convex polygon, its corners given clockwise on screen (y down). */
export function inside(
  corners: readonly (readonly [number, number])[],
): (x: number, y: number) => number {
  const edges = corners.map(([x0, y0], k) => {
    const [x1, y1] = corners[(k + 1) % corners.length] ?? [x0, y0];
    const length = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) || 1;
    // The normal that points out of a clockwise polygon.
    return [x0, y0, (y1 - y0) / length, -(x1 - x0) / length] as const;
  });
  return (x, y) => {
    let d = -Infinity;
    for (const [x0, y0, nx, ny] of edges) d = Math.max(d, (x - x0) * nx + (y - y0) * ny);
    return d;
  };
}

/** A convex polygon, its corners clockwise on screen. */
export function polygon(
  brush: Brush,
  corners: readonly (readonly [number, number])[],
  colour: Rgb,
  ink?: Ink,
): void {
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  brush.fill(
    Math.min(...xs) - 1,
    Math.min(...ys) - 1,
    Math.max(...xs) + 1,
    Math.max(...ys) + 1,
    inside(corners),
    colour,
    ink,
  );
}

/** The shadow at the foot of something `width` wide, cast to the east. */
export function shadow(brush: Brush, cx: number, foot: number, width: number): void {
  brush.spot(
    cx + width * 0.12,
    foot,
    width * 0.6 + 0.8,
    Math.max(0.7, width / 9),
    BLACK,
    0.3,
    true,
  );
}

/** A lamp: a dot of light and its halo, drawn as they are. For the night only. */
export function lamp(brush: Brush, x: number, y: number, r = 0.42): void {
  brush.spot(x, y, r * 3, r * 3, LAMP, 0.45, true);
  disc(brush, x, y, r, LAMP, { unlit: true });
}
