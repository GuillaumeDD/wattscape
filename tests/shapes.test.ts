import { describe, expect, it } from "vitest";
import { type Brush, line } from "../src/render/art/shapes";
import { PALETTE } from "../src/render/palette";

type Distance = (x: number, y: number) => number;
type Span = (y: number) => readonly [number, number];

/** What `line` hands the brush: its box, its distance and its span. */
function asked(...args: Parameters<typeof line> extends [Brush, ...infer R] ? R : never) {
  const got: { box: number[]; distance: Distance; span: Span | undefined }[] = [];
  const brush: Brush = {
    emissive: false,
    fill(left, top, right, bottom, distance, _colour, _ink, span) {
      got.push({ box: [left, top, right, bottom], distance, span });
    },
    spot: () => undefined,
  };
  line(brush, ...args);
  const [first] = got;
  if (first === undefined) throw new Error("line filled nothing");
  return first;
}

/** A small deterministic sequence in [0, 1), for the tests only. */
function sequence(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe("the shapes (src/render/art/shapes.ts)", () => {
  it("gives a line a span that holds every point its edge reaches, so no pixel is lost", () => {
    const next = sequence(7);
    // Random lines, with a flat one and an upright one among them.
    const lines: [number, number, number, number, number, number][] = [
      [2, 5, 9, 5, 0.3, 0.1],
      [4, 1, 4, 8, 0.36, 0.14],
    ];
    for (let k = 0; k < 150; k++)
      lines.push([
        next() * 20,
        next() * 20,
        next() * 20,
        next() * 20,
        0.02 + next() * 0.6,
        0.02 + next() * 0.6,
      ]);
    for (const [ax, ay, bx, by, ra, rb] of lines) {
      const { box, distance, span } = asked(ax, ay, bx, by, ra, rb, PALETTE.snow);
      if (span === undefined) throw new Error("no span");
      const [left = 0, top = 0, right = 0, bottom = 0] = box;
      // Wherever a pixel of one scene pixel or finer gets some colour (distance under
      // half a pixel), the span holds it.
      const outside: string[] = [];
      for (let y = top; y < bottom; y += 1 / 8) {
        const [from, to] = span(y);
        for (let x = left; x < right; x += 1 / 8)
          if (distance(x, y) < 0.5 && (x < from || x > to))
            outside.push(`(${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
      expect(outside, `line ${String([ax, ay, bx, by, ra, rb])}`).toEqual([]);
    }
  });

  it("keeps a slanted line's span much narrower than its box", () => {
    const { box, span } = asked(0, 0, 10, 10, 0.2, 0.2, PALETTE.snow);
    if (span === undefined) throw new Error("no span");
    const [from, to] = span(5);
    expect(to - from).toBeLessThan(((box[2] ?? 0) - (box[0] ?? 0)) / 3);
  });
});
