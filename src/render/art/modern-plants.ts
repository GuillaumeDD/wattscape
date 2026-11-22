/**
 * The plants of the modern theme (B-027): the same plants at the same places as the
 * pixel art's (./plants.ts), within the same boxes, moved by the same figures with
 * the same formulas (ARCHITECTURE § Data-to-scene mapping), but drawn as shapes with
 * smooth edges at the theme's own pixels, lit from the north-west, a soft shadow at
 * their foot. Original drawings, in code; no asset.
 *
 * Coordinates are scene pixels, fractions allowed: pixel (x, y) of the pixel art
 * covers [x, x + 1) × [y, y + 1). Pure: a brush in, calls out.
 */
import type { PlantSite } from "../../map/plants.ts";
import { PALETTE, type Rgb } from "../palette.ts";
import {
  MAST_PX,
  type SpriteSize,
  SPRITES,
  beaconLit,
  spriteOf,
  TURBINE_GAP,
  turbineCount,
} from "./plants.ts";
import { BLACK, box, type Brush, clamp, DARK, disc, LAMP, line, round, shadow } from "./shapes.ts";

export type { Brush, Ink } from "./shapes.ts";

const SNOW = PALETTE.snow;
const CONCRETE: Rgb = [226, 226, 220];
const SLAB: Rgb = [150, 150, 146];
const STEEL: Rgb = [176, 182, 180];
const SMOKE: Rgb = [112, 106, 102];
/** The yellow of an offshore foundation's transition piece. */
const FOUNDATION: Rgb = [214, 170, 60];

const frac = (v: number): number => v - Math.floor(v);

/** A small integer hash, for glints that come and go (no Math.random): ./plants.ts's. */
function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/** A window: a lamp at night when lit, a dark pane otherwise. */
function pane(brush: Brush, x: number, y: number, lit: boolean): void {
  if (brush.emissive && lit) {
    brush.spot(x, y, 1.3, 1.3, LAMP, 0.45, true);
    disc(brush, x, y, 0.42, LAMP, { unlit: true });
  } else box(brush, x - 0.35, y - 0.35, x + 0.35, y + 0.35, DARK);
}

/** How many of a sprite's windows are lit: as the pixel art, ∝ the activity. */
function litWindows(site: PlantSite, activity: number | null): number {
  const windows = (SPRITES[spriteOf(site)] ?? []).join("").split("L").length - 1;
  return activity === null ? 0 : Math.round(activity * windows);
}

/** Where the turbines of a farm stand: the middle of each mast. */
function turbines(site: PlantSite, ax: number): number[] {
  const n = turbineCount(site);
  return Array.from(
    { length: n },
    (_, k) => Math.round(ax + (k - (n - 1) / 2) * TURBINE_GAP) + 0.5,
  );
}

/** The hub above the ground, and the blades' length. */
const HUB = MAST_PX - 0.8;
const BLADE = 3;

/** Three blades from the hub, each along a unit vector (east, up), and the hub's nose. */
function blades(
  brush: Brush,
  x: number,
  hub: number,
  along: readonly (readonly [number, number])[],
): void {
  for (const [east, up] of along)
    line(brush, x, hub, x + east * BLADE, hub - up * BLADE, 0.36, 0.14, SNOW);
  disc(brush, x, hub, 0.5, STEEL);
}

/**
 * The blades of a rotor that stands still: one up, two down. Written out, so that no
 * sine decides a pixel of the still frame (AGENTS.md § Determinism).
 */
const PARKED = [
  [0, 1],
  [0.866, -0.5],
  [-0.866, -0.5],
] as const;

/** The blades at a number of turns: an animation, where a sine may differ by an ulp. */
function turned(turns: number): [number, number][] {
  return [0, 1, 2].map((b) => {
    const angle = 2 * Math.PI * (turns + b / 3);
    return [Math.sin(angle), Math.cos(angle)];
  });
}

/** A cooling tower `height` tall on `foot`, narrow at the waist. */
function coolingTower(brush: Brush, cx: number, foot: number, height: number): void {
  const half = (y: number): number => {
    const t = clamp((foot - y) / height, 0, 1);
    return 2.5 * (0.62 + (0.38 * (2 * t - 1.3) * (2 * t - 1.3)) / 1.69);
  };
  const top = foot - height;
  brush.fill(
    cx - 3.5,
    top - 1,
    cx + 3.5,
    foot + 1,
    (x, y) => Math.max(Math.abs(x - cx) - half(y), top - y, y - foot),
    CONCRETE,
    { shade: (x, y) => 1 - 0.2 * clamp((x - cx) / half(y) / 2 + 0.5, 0, 1) },
  );
  // Its mouth.
  brush.spot(cx, top + 0.35, half(top) * 0.85, 0.45, DARK, 0.4);
}

/** A reactor building: a cylinder `width` wide under a dome. */
function reactor(brush: Brush, cx: number, foot: number, width: number, wall: number): void {
  const r = width / 2;
  const spring = foot - wall;
  brush.fill(
    cx - r - 1,
    spring - r - 1,
    cx + r + 1,
    foot + 1,
    (x, y) => {
      const dx = x - cx;
      const dy = y - spring;
      return y < spring ? Math.sqrt(dx * dx + dy * dy) - r : Math.max(Math.abs(dx) - r, y - foot);
    },
    CONCRETE,
    { shade: round(cx, r) },
  );
}

/**
 * The still body of a plant, the middle of its bottom row at pixel (ax, ay), as
 * ./plants.ts's `drawBody`. Lit windows count as still, and so do the blades of a
 * farm that does not turn (no figure, or none of its power): `drawMotion` draws the
 * turning ones.
 */
export function drawModernBody(
  brush: Brush,
  site: PlantSite,
  activity: number | null,
  ax: number,
  ay: number,
  size: SpriteSize,
): void {
  const x = ax + 0.5;
  const foot = ay + 1;
  if (size === "marker") {
    // The national view: a dot of the source's colour, darker at its foot.
    brush.spot(x + 0.3, foot, 1.9, 0.7, BLACK, 0.3, true);
    disc(brush, x, foot - 1.45, 1.45, PALETTE[site.source], {
      shade: (_, y) => (y > foot - 1 ? 0.72 : 1),
    });
    return;
  }
  const lit = litWindows(site, activity);
  switch (spriteOf(site)) {
    case "wind":
    case "windOffshore": {
      const turning = activity !== null && activity > 0;
      for (const tx of turbines(site, ax)) {
        brush.spot(tx + 0.8, foot, 1.7, 0.7, BLACK, 0.3, true);
        if (site.offshore) box(brush, tx - 0.8, foot - 1, tx + 0.8, foot + 0.1, FOUNDATION);
        line(brush, tx, foot, tx, foot - HUB, 0.42, 0.25, SNOW, { shade: round(tx, 0.42, 0.25) });
        if (!turning) blades(brush, tx, foot - HUB, PARKED);
      }
      return;
    }
    case "nuclearTowers": {
      const left = ax - 7;
      shadow(brush, left + 7.5, foot, 15);
      box(brush, left + 0.3, foot - 0.7, left + 14.7, foot, SLAB);
      coolingTower(brush, left + 2.5, foot - 0.5, 6.5);
      coolingTower(brush, left + 8.5, foot - 0.5, 6.5);
      reactor(brush, left + 12.7, foot - 0.5, 3, 2.6);
      pane(brush, left + 12.7, foot - 1.6, lit >= 1);
      return;
    }
    case "nuclear": {
      const left = ax - 6;
      shadow(brush, left + 6.5, foot, 13);
      box(brush, left + 0.3, foot - 2.6, left + 12.7, foot, [206, 208, 204]);
      box(brush, left + 0.3, foot - 2.6, left + 12.7, foot - 2.2, STEEL);
      reactor(brush, left + 3.4, foot, 3.4, 3);
      reactor(brush, left + 8.2, foot, 3.4, 3);
      for (const [k, wx] of [5.8, 10.6, 11.9].entries())
        pane(brush, left + wx, foot - 1.2, k < lit);
      return;
    }
    case "solar": {
      const left = ax - 5;
      // A slanted array: its top edge two pixels to the east of its bottom one.
      const top = foot - 4;
      const bottom = foot - 0.9;
      const shear = (y: number): number => ((bottom - y) * 2) / (bottom - top);
      shadow(brush, left + 5, foot, 9);
      box(brush, left + 0.6, bottom - 0.2, left + 8, foot - 0.3, SLAB);
      brush.fill(
        left - 1,
        top - 1,
        left + 11,
        bottom + 1,
        (px, py) =>
          Math.max(
            Math.abs(px - shear(py) - (left + 4)) - 4,
            Math.abs(py - (top + bottom) / 2) - (bottom - top) / 2,
          ),
        PALETTE.seaDeep,
        // The sky on the glass: lighter towards the top.
        { shade: (_, py) => 1 + (0.9 * (bottom - py)) / (bottom - top) },
      );
      return;
    }
    case "hydro": {
      const left = ax - 5;
      const cx = left + 5;
      const top = foot - 5;
      // A dam across its valley: as wide as the valley at its crest, narrower below.
      const half = (y: number): number => 5 - clamp((y - top - 0.75) * 0.55, 0, 2.3);
      shadow(brush, cx, foot, 7);
      brush.fill(
        left - 1,
        top - 1,
        left + 11,
        foot + 1,
        (px, py) => Math.max(Math.abs(px - cx) - half(py), top - py, py - foot),
        [172, 170, 164],
        { shade: (px, py) => (1 - 0.14 * clamp((px - left) / 10, 0, 1)) * (1 - 0.05 * (py - top)) },
      );
      box(brush, left + 0.1, top, left + 9.9, top + 0.75, SNOW);
      return;
    }
    case "thermal": {
      const left = ax - 4;
      shadow(brush, left + 4, foot, 8);
      // The stack, with its red band, behind the hall.
      box(brush, left + 2.3, foot - 7, left + 3.5, foot - 2, STEEL, {
        shade: round(left + 2.9, 0.6),
      });
      box(brush, left + 2.3, foot - 6.2, left + 3.5, foot - 5.5, PALETTE.roof);
      box(brush, left + 0.2, foot - 3, left + 7.8, foot, PALETTE.thermal, {
        shade: round(left + 4, 3.8, 0.15),
      });
      box(brush, left + 0.2, foot - 3, left + 7.8, foot - 2.55, DARK, { alpha: 0.45 });
      pane(brush, left + 2.5, foot - 1.3, lit >= 1);
      pane(brush, left + 4.5, foot - 1.3, lit >= 2);
      return;
    }
    case "bioenergy": {
      const left = ax - 3;
      shadow(brush, left + 3, foot, 6);
      box(brush, left + 1.15, foot - 5, left + 1.9, foot - 2.5, STEEL);
      box(brush, left + 0.2, foot - 3, left + 5.8, foot, PALETTE.bioenergy, {
        shade: round(left + 3, 2.8, 0.25),
      });
      box(brush, left + 0.2, foot - 3, left + 5.8, foot - 2.55, DARK, { alpha: 0.35 });
      pane(brush, left + 1.5, foot - 1.3, lit >= 1);
      return;
    }
  }
}

/**
 * Puffs rising from (x, y), as ./plants.ts's: three puffs, one every 1 / rate
 * seconds, each rising to `height` pixels, growing and thinning as it goes, and
 * drifting east (the wind is not in the data yet, B-018).
 */
function puffs(
  brush: Brush,
  x: number,
  y: number,
  height: number,
  rate: number,
  seconds: number,
  colour: Rgb,
  big: boolean,
): void {
  const count = 3;
  for (let k = 0; k < count; k++) {
    const p = frac(seconds * (rate / count) + k / count);
    // Each puff trails two fainter ones, so the three read as one plume.
    for (let trail = 0; trail < 3; trail++) {
      const q = p - trail * 0.11;
      if (q < 0) break;
      const r = big ? 1.1 + 1.5 * q : 0.7 + 0.6 * q;
      brush.spot(
        x + q * q * 3,
        y - q * height,
        r,
        r,
        colour,
        (0.85 - 0.25 * trail) * (1 - 0.8 * q),
      );
    }
  }
}

/**
 * The motion of a plant at `seconds` (animation time), over its body: the formulas of
 * ./plants.ts's `drawMotion` (ARCHITECTURE § Data-to-scene mapping), and nothing when
 * the activity is null (no figure) or 0.
 */
export function drawModernMotion(
  brush: Brush,
  site: PlantSite,
  activity: number | null,
  ax: number,
  ay: number,
  size: SpriteSize,
  seconds: number,
): void {
  if (activity === null || !(activity > 0)) return;
  const a = Math.min(1, activity);
  const big = size === "full";
  const x = ax + 0.5;
  const foot = ay + 1;
  switch (site.source) {
    case "nuclear": {
      if (!site.towers) {
        // The pixel art's beacon, on the top of the west dome; a halo around it at night.
        if (!big || !beaconLit(a, seconds)) return;
        const bx = ax - 6 + 3.4;
        const by = foot - 5.1;
        if (brush.emissive) brush.spot(bx, by, 1.9, 1.9, LAMP, 0.35, true);
        disc(brush, bx, by, 0.42, PALETTE.nuclear, { unlit: true });
        return;
      }
      if (!big) {
        puffs(brush, x, foot - 3, 2 + 4 * a, 0.4 + 0.6 * a, seconds, SNOW, false);
        return;
      }
      for (const cx of [ax - 7 + 2.5, ax - 7 + 8.5])
        puffs(brush, cx, foot - 7.2, 3 + 9 * a, 0.4 + 0.6 * a, seconds, SNOW, true);
      return;
    }
    case "thermal":
      puffs(
        brush,
        big ? ax - 4 + 2.9 : x,
        foot - (big ? 7.3 : 3),
        2 + (big ? 7 : 3) * a,
        0.3 + 0.7 * a,
        seconds,
        SMOKE,
        big,
      );
      return;
    case "bioenergy":
      if (!big) return;
      puffs(brush, ax - 3 + 1.5, foot - 5.3, 2 + 4 * a, 0.3 + 0.5 * a, seconds, STEEL, false);
      return;
    case "wind": {
      if (!big) return;
      // Half a turn a second at full load; each turbine a little out of step.
      const turns = seconds * 0.5 * a;
      for (const [k, tx] of turbines(site, ax).entries())
        blades(brush, tx, foot - HUB, turned(turns + k * 0.13));
      return;
    }
    case "solar": {
      if (!big) return;
      // A new set of glints every half second; about a third of the panels at full sun.
      const step = Math.floor(seconds * 2);
      const left = ax - 5;
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 4; c++)
          if (hash3(site.x * 10 + c, site.y * 10 + r, step) % 1000 < a * 330)
            brush.spot(
              left + 1 + c * 2 + (1 - r) * 1.3,
              foot - 1.7 - (1 - r) * 1.5,
              0.9,
              0.7,
              PALETTE.foam,
              0.8,
            );
      return;
    }
    case "hydro": {
      if (!big) return;
      const streams = Math.ceil(3 * a);
      const phase = Math.floor(seconds * 4);
      for (let k = 0; k < streams; k++) {
        const sx = ax - 2 + k * 2 + 0.5;
        line(brush, sx, foot - 4, sx, foot - 0.3, 0.35, 0.45, PALETTE.foam);
        // Foam runs down the face, four steps a second.
        for (let j = 0; j < 4; j++)
          if ((((j - phase + k) % 3) + 3) % 3 === 0)
            brush.spot(sx, foot - 3.5 + j, 0.7, 0.7, SNOW, 0.9);
      }
      return;
    }
  }
}
