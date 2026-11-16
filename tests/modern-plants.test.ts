import { describe, expect, it } from "vitest";
import { PLANT_SITES, type PlantSite } from "../src/map/plants";
import {
  type Brush,
  drawModernBody,
  drawModernMotion,
  type Ink,
} from "../src/render/art/modern-plants";
import {
  hasMotion,
  plantBox,
  type SpriteSize,
  SPRITES,
  spriteOf,
  turbineCount,
} from "../src/render/art/plants";
import { PALETTE, type Rgb } from "../src/render/palette";

/** What a brush was asked to draw. */
interface Fill {
  readonly kind: "fill";
  /** Where the shape is, measured on a grid of quarter pixels: its bounding box. */
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly colour: Rgb;
  readonly ink: Ink | undefined;
}
interface Spot {
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
function recorder(emissive = false): Brush & { readonly calls: (Fill | Spot)[] } {
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

const KINDS = Object.keys(SPRITES);
/** A real site of each sprite, the first of the register. */
const siteOf = (kind: string): PlantSite => {
  const site = PLANT_SITES.find((s) => spriteOf(s) === kind);
  if (site === undefined) throw new Error(`no site draws ${kind}`);
  return site;
};
const AX = 40;
const AY = 30;

function body(site: PlantSite, activity: number | null, size: SpriteSize, night = false) {
  const brush = recorder(night);
  drawModernBody(brush, site, activity, AX, AY, size);
  return brush.calls;
}

function motion(site: PlantSite, activity: number | null, size: SpriteSize, seconds: number) {
  const brush = recorder();
  drawModernMotion(brush, site, activity, AX, AY, size, seconds);
  return brush.calls;
}

const fills = (calls: readonly (Fill | Spot)[]): Fill[] =>
  calls.filter((c): c is Fill => c.kind === "fill");
const spots = (calls: readonly (Fill | Spot)[]): Spot[] =>
  calls.filter((c): c is Spot => c.kind === "spot");
const isLamp = (c: Fill): boolean => c.colour === PALETTE.lamp && c.ink?.unlit === true;

describe("the modern plants' bodies", () => {
  it("has a drawing for each of the eight sprites of the pixel art", () => {
    expect(KINDS).toHaveLength(8);
    for (const kind of KINDS)
      expect(fills(body(siteOf(kind), 0.5, "full")).length).toBeGreaterThan(0);
  });

  it("stays in the box of the pixel-art sprite, which the captions answer to", () => {
    for (const kind of KINDS)
      for (const size of ["full", "marker"] as const) {
        const site = siteOf(kind);
        const box = plantBox(site, AX, AY, size);
        // A parked rotor's blades reach past the masts, as the turning ones do.
        const slack = site.source === "wind" && size === "full" ? 3 : 0.75;
        for (const shape of fills(body(site, null, size))) {
          expect(shape.left, kind).toBeGreaterThanOrEqual(box.left - slack);
          expect(shape.right, kind).toBeLessThanOrEqual(box.right + slack);
          expect(shape.top, kind).toBeGreaterThanOrEqual(box.top - slack);
          expect(shape.bottom, kind).toBeLessThanOrEqual(box.bottom + 0.75);
        }
      }
  });

  it("casts a shadow at its foot, unlit; the only other spots are the cooling towers' mouths", () => {
    for (const kind of KINDS) {
      const all = spots(body(siteOf(kind), 0.5, "full"));
      const shadows = all.filter((s) => s.unlit);
      expect(shadows.length, kind).toBeGreaterThan(0);
      for (const s of shadows) {
        expect(s.colour).toEqual([0, 0, 0]);
        expect(Math.abs(s.cy - (AY + 1))).toBeLessThanOrEqual(0.5);
      }
      expect(all.length - shadows.length, kind).toBe(kind === "nuclearTowers" ? 2 : 0);
    }
  });

  it("stands one mast per turbine of the farm, on a foundation at sea", () => {
    for (const kind of ["wind", "windOffshore"]) {
      const site = siteOf(kind);
      const n = turbineCount(site);
      expect(fills(body(site, 0.5, "full"))).toHaveLength(site.offshore ? 2 * n : n);
    }
    expect(turbineCount(siteOf("windOffshore"))).toBe(5);
  });

  it("draws the blades still when the farm does not turn, and leaves the turning ones to the motion", () => {
    const site = siteOf("wind");
    const n = turbineCount(site);
    const turning = fills(body(site, 0.5, "full")).length;
    // Three blades and a hub per turbine.
    expect(fills(body(site, null, "full"))).toHaveLength(turning + 4 * n);
    expect(fills(body(site, 0, "full"))).toHaveLength(turning + 4 * n);
    expect(fills(motion(site, 0.5, "full", 1))).toHaveLength(4 * n);
  });

  it("lights its windows with the activity at night, as the pixel art, and none by day", () => {
    for (const [kind, windows] of [
      ["nuclear", 3],
      ["nuclearTowers", 1],
      ["thermal", 2],
      ["bioenergy", 1],
    ] as const) {
      const site = siteOf(kind);
      expect((SPRITES[kind] ?? []).join("").split("L").length - 1).toBe(windows);
      for (const activity of [null, 0, 0.2, 0.5, 0.8, 1]) {
        const lit = activity === null ? 0 : Math.round(activity * windows);
        expect(fills(body(site, activity, "full", true)).filter(isLamp), kind).toHaveLength(lit);
        expect(fills(body(site, activity, "full", false)).filter(isLamp)).toHaveLength(0);
      }
    }
  });

  it("is a dot of the source's colour on the national view", () => {
    for (const kind of KINDS) {
      const site = siteOf(kind);
      const [dot, ...others] = fills(body(site, 0.5, "marker"));
      expect(others).toHaveLength(0);
      expect(dot?.colour).toBe(PALETTE[site.source]);
    }
  });

  it("draws the same twice", () => {
    for (const kind of KINDS)
      expect(JSON.stringify(body(siteOf(kind), 0.5, "full", true))).toBe(
        JSON.stringify(body(siteOf(kind), 0.5, "full", true)),
      );
  });
});

describe("the modern plants' motion", () => {
  it("moves nothing without a figure or at no power", () => {
    for (const kind of KINDS)
      for (const size of ["full", "marker"] as const)
        for (const activity of [null, 0, -1, Number.NaN])
          expect(motion(siteOf(kind), activity, size, 1.3), kind).toHaveLength(0);
  });

  it("moves exactly the plants the loop is told move (hasMotion)", () => {
    for (const kind of KINDS)
      for (const size of ["full", "marker"] as const) {
        const site = siteOf(kind);
        // Glints come and go: over a few seconds, at full power.
        const drawn = [0.1, 0.6, 1.1, 1.6, 2.1, 2.6].some(
          (seconds) => motion(site, 1, size, seconds).length > 0,
        );
        expect(drawn, `${kind} ${size}`).toBe(hasMotion(site, size));
      }
  });

  it("turns the rotors by half a turn a second at full power, in proportion below", () => {
    const site = siteOf("wind");
    // The same turns: 2 s at half power, 1 s at full power.
    expect(JSON.stringify(motion(site, 0.5, "full", 2))).toBe(
      JSON.stringify(motion(site, 1, "full", 1)),
    );
    // A third of a turn later, the three blades are where they were.
    const tips = (seconds: number): string[] =>
      fills(motion(site, 1, "full", seconds))
        .map((f) => `${f.left.toFixed(1)},${f.top.toFixed(1)},${f.right.toFixed(1)}`)
        .sort();
    expect(tips(0.3 + 2 / 3)).toEqual(tips(0.3));
    expect(tips(0.3 + 1 / 3)).not.toEqual(tips(0.3));
  });

  it("raises the plumes higher the more a plant works", () => {
    for (const kind of ["nuclearTowers", "thermal", "bioenergy"]) {
      const site = siteOf(kind);
      const top = (activity: number): number =>
        Math.min(
          ...Array.from({ length: 40 }, (_, k) => k * 0.25).flatMap((seconds) =>
            spots(motion(site, activity, "full", seconds)).map((s) => s.cy),
          ),
        );
      expect(top(1), kind).toBeLessThan(top(0.5) - 1);
      expect(top(0.5), kind).toBeLessThan(top(0.1) - 0.5);
    }
  });

  it("steams from both cooling towers, above their mouths", () => {
    const site = siteOf("nuclearTowers");
    const puffs = spots(motion(site, 1, "full", 0.7));
    const box = plantBox(site, AX, AY, "full");
    const columns = new Set(puffs.map((s) => (s.cx < AX ? "west" : "east")));
    expect(columns.size).toBe(2);
    for (const s of puffs) expect(s.cy).toBeLessThanOrEqual(box.top + 1);
  });

  it("lets water down a dam in one to three streams with the activity", () => {
    const site = siteOf("hydro");
    for (const [activity, streams] of [
      [0.05, 1],
      [0.33, 1],
      [0.5, 2],
      [0.9, 3],
      [1, 3],
      [1.25, 3],
    ] as const)
      expect(fills(motion(site, activity, "full", 0.9))).toHaveLength(streams);
  });

  it("glints on more panels the more the sun gives, never on more than eight", () => {
    const site = siteOf("solar");
    const mean = (activity: number): number => {
      let total = 0;
      for (let step = 0; step < 200; step++) {
        const count = motion(site, activity, "full", step / 2 + 0.1).length;
        expect(count).toBeLessThanOrEqual(8);
        total += count;
      }
      return total / 200;
    };
    expect(mean(1)).toBeGreaterThan(mean(0.3) * 2);
    expect(mean(0.3)).toBeGreaterThan(0);
  });

  it("draws the same at the same time, and something else later", () => {
    for (const kind of ["wind", "nuclearTowers", "thermal", "hydro"]) {
      const site = siteOf(kind);
      const at = (seconds: number): string => JSON.stringify(motion(site, 0.7, "full", seconds));
      expect(at(1.3)).toBe(at(1.3));
      expect(at(1.3)).not.toBe(at(1.6));
    }
  });
});
