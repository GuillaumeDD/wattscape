/**
 * The six source sprites (B-012, ARCHITECTURE § Art direction): drawn in code from
 * small pixel maps, in the palette, with a darker edge and no outline. Each has a
 * still body, drawn with the terrain so that the relief in front hides it, and a
 * motion drawn on top every animation step, driven by one figure: its activity (the
 * regional load factor, 0 to 1, or null for idle; ARCHITECTURE § Data-to-scene
 * mapping). Idle, or at 0, nothing moves and nothing glows.
 *
 * Pure: the body depends on the plant only; the motion on the plant and the time,
 * through Math.sin and Math.cos, which only animate (AGENTS.md § Determinism).
 */
import { type PlantSite } from "../../map/plants.ts";
import { type ColourName, darken } from "../palette.ts";

/** Where a sprite puts its pixels: a palette colour under the light, or emitted (untinted). */
export interface Pen {
  put(x: number, y: number, colour: ColourName): void;
  /** A lit pixel (a window, a furnace): drawn untinted, at night only. */
  glow(x: number, y: number): void;
  /** Whether lit pixels show now (the sun is down). */
  readonly emissive: boolean;
}

/** A pixel map: one character per pixel, `.` transparent; rows top to bottom. */
type PixelMap = readonly string[];

/** What each character of a pixel map draws. `L` is a window, lit when the plant works. */
const INK: Readonly<Record<string, ColourName>> = {
  w: "snow",
  g: "rock",
  G: darken("rock", 1),
  n: "nuclear",
  N: darken("nuclear", 1),
  h: "hydro",
  f: "foam",
  b: "seaDeep",
  B: "sea",
  o: "solar",
  t: "thermal",
  T: darken("thermal", 1),
  e: "bioenergy",
  E: darken("bioenergy", 1),
  r: "roof",
  L: "soil",
};

/**
 * The full sprites, anchored at the middle of their bottom row. Nuclear with towers:
 * two cooling towers, narrow at the waist, and the reactor's dome; on the coast or a
 * river without towers: the dome and the turbine hall.
 */
export const SPRITES: Readonly<Record<string, PixelMap>> = {
  nuclearTowers: [
    ".ggg...ggg.....",
    ".gwg...gwg.....",
    "..gw....gw.....",
    "..gw....gw..nn.",
    ".gwwg..gwwgnnnN",
    "gwwwwggwwwwgnnN",
    "gwwwwggwwwwgLgN",
    "GGGGGGGGGGGGGGG",
  ],
  nuclear: [
    "..nn.........",
    ".nnnN........",
    ".nnnNggggggg.",
    "gwwwwwwwwwwwg",
    "gwLwwLwwLwwwg",
    "GGGGGGGGGGGGG",
  ],
  wind: [".G.", "GgG"],
  solar: ["..bBbBbBbB", ".bBbBbBbB.", "bBbBbBbB..", "GGGGGGGG.."],
  hydro: ["wwwwwwwwww", "gggggggggg", ".gggggggg.", "..gggggg..", "..GGGGGG.."],
  thermal: ["..gg....", "..tg....", "..gg....", "..tg....", "TtttgttT", "TtLtLttT", "GGGGGGGG"],
  bioenergy: [".g....", ".g....", "eeeeeE", "eLeeeE", "GGGGGG"],
};

/** The markers of the national view: a dot of the source's colour with a darker foot. */
const MARKER: PixelMap = [".c.", "ccc", "CCC"];

/** Which sprite a plant draws. */
export function spriteOf(site: PlantSite): string {
  return site.source === "nuclear" && site.towers ? "nuclearTowers" : site.source;
}

function draw(
  pen: Pen,
  map: PixelMap,
  ax: number,
  ay: number,
  ink: (ch: string) => ColourName | null,
  lit: number,
): void {
  const height = map.length;
  const width = map[0]?.length ?? 0;
  const left = ax - Math.floor(width / 2);
  const top = ay - height + 1;
  let window = 0;
  for (let r = 0; r < height; r++) {
    const row = map[r] ?? "";
    for (let c = 0; c < row.length; c++) {
      const ch = row[c] ?? ".";
      if (ch === ".") continue;
      if (ch === "L") {
        // Windows light up one by one with the activity, at night only.
        if (pen.emissive && window < lit) pen.glow(left + c, top + r);
        else pen.put(left + c, top + r, INK.L ?? "soil");
        window++;
        continue;
      }
      const colour = ink(ch);
      if (colour !== null) pen.put(left + c, top + r, colour);
    }
  }
}

/** The number of windows of a sprite. */
function windows(map: PixelMap): number {
  return map.join("").split("L").length - 1;
}

/** How many wind turbines stand for a farm: one, two or three by capacity. */
export function turbineCount(mw: number): number {
  return mw >= 60 ? 3 : mw >= 30 ? 2 : 1;
}

/** Turbines are this many pixels apart, and this tall. */
const TURBINE_GAP = 5;
const MAST_PX = 7;

/** Size in pixels a sprite is drawn at: full, or the national view's markers. */
export type SpriteSize = "full" | "marker";

/**
 * The still body of a plant, its bottom row's middle at (ax, ay). Lit windows count
 * as still: they follow the activity, which changes every 15 minutes, not the time.
 */
export function drawBody(
  pen: Pen,
  site: PlantSite,
  activity: number | null,
  ax: number,
  ay: number,
  size: SpriteSize,
): void {
  if (size === "marker") {
    const c: ColourName = site.source;
    draw(pen, MARKER, ax, ay, (ch) => (ch === "c" ? c : darken(c, 1)), 0);
    return;
  }
  const map = SPRITES[spriteOf(site)] ?? [];
  const lit = activity === null ? 0 : Math.round(activity * windows(map));
  if (site.source === "wind") {
    const n = turbineCount(site.mw);
    for (let k = 0; k < n; k++) {
      const x = ax + (k - (n - 1) / 2) * TURBINE_GAP;
      const bx = Math.round(x);
      draw(pen, map, bx, ay, (ch) => INK[ch] ?? null, 0);
      for (let y = 2; y <= MAST_PX; y++) pen.put(bx, ay - y, "snow");
      pen.put(bx, ay - MAST_PX - 1, "rock");
    }
    return;
  }
  draw(pen, map, ax, ay, (ch) => INK[ch] ?? null, lit);
}

/** Fractional part, always in [0, 1). */
function frac(v: number): number {
  return v - Math.floor(v);
}

/** A small integer hash, for glints that come and go (no Math.random). */
function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/**
 * Puffs rising from (x, y): `count` puffs, one every 1 / rate seconds, each rising to
 * `height` pixels and growing, `colour` low and `fade` high.
 */
function puffs(
  pen: Pen,
  x: number,
  y: number,
  height: number,
  rate: number,
  seconds: number,
  colour: ColourName,
  fade: ColourName,
  big: boolean,
): void {
  const count = 3;
  for (let k = 0; k < count; k++) {
    const p = frac(seconds * (rate / count) + k / count);
    const py = Math.round(y - p * height);
    // Drifts east as it rises: the wind is not in the data yet (B-018).
    const px = Math.round(x + p * p * 3);
    const c = p < 0.6 ? colour : fade;
    const r = big ? (p < 0.3 ? 0 : 1) : 0;
    pen.put(px, py, c);
    if (r > 0) {
      pen.put(px - 1, py, c);
      pen.put(px + 1, py, c);
      pen.put(px, py - 1, c);
      if (p > 0.5) pen.put(px + 1, py - 1, c);
    }
  }
}

/** The tops of the cooling towers, from the sprite's anchor. */
const TOWER_TOPS: readonly (readonly [number, number])[] = [
  [-5, -8],
  [-1, -8],
];

/** Whether a plant shows any motion at this size when working (for the loop to sleep). */
export function hasMotion(site: PlantSite, size: SpriteSize): boolean {
  if (site.source === "nuclear") return site.towers;
  return size === "full" || site.source === "thermal";
}

/**
 * The motion of a plant at `seconds` (animation time), over its body. Nothing moves
 * when the activity is null (no figure) or 0. Provisional formulas, ARCHITECTURE §
 * Data-to-scene mapping:
 *
 * - nuclear with towers, thermal, bioenergy: puffs whose height and rate grow with
 *   the activity;
 * - wind: rotors turning at up to half a turn a second (blades pass at 1.5 Hz);
 * - solar: glints on the panels, a share of them lit ∝ the activity;
 * - hydro: water falling from the spillway, in up to three streams ∝ the activity.
 */
export function drawMotion(
  pen: Pen,
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
  switch (site.source) {
    case "nuclear": {
      if (!site.towers) return;
      if (!big) {
        puffs(
          pen,
          ax,
          ay - 3,
          Math.round(2 + 4 * a),
          0.4 + 0.6 * a,
          seconds,
          "snow",
          "foam",
          false,
        );
        return;
      }
      for (const [dx, dy] of TOWER_TOPS)
        puffs(
          pen,
          ax + dx,
          ay + dy,
          Math.round(3 + 9 * a),
          0.4 + 0.6 * a,
          seconds,
          "snow",
          "foam",
          true,
        );
      return;
    }
    case "thermal":
      puffs(
        pen,
        ax - 1,
        ay - (big ? 7 : 3),
        Math.round(2 + (big ? 7 : 3) * a),
        0.3 + 0.7 * a,
        seconds,
        "thermal",
        "rock",
        big,
      );
      return;
    case "bioenergy":
      if (!big) return;
      puffs(
        pen,
        ax - 2,
        ay - 5,
        Math.round(2 + 4 * a),
        0.3 + 0.5 * a,
        seconds,
        "rock",
        "snow",
        false,
      );
      return;
    case "wind": {
      if (!big) return;
      const n = turbineCount(site.mw);
      // Half a turn a second at full load; each turbine a little out of step.
      const turns = seconds * 0.5 * a;
      for (let k = 0; k < n; k++) {
        const hx = Math.round(ax + (k - (n - 1) / 2) * TURBINE_GAP);
        const hy = ay - MAST_PX - 1;
        for (let b = 0; b < 3; b++) {
          const angle = 2 * Math.PI * (turns + b / 3 + k * 0.13);
          for (let l = 1; l <= 3; l++)
            pen.put(
              hx + Math.round(Math.sin(angle) * l),
              hy - Math.round(Math.cos(angle) * l * 0.8),
              "snow",
            );
        }
      }
      return;
    }
    case "solar": {
      if (!big) return;
      // A new set of glints every half second; about a third of the panels at full sun.
      const step = Math.floor(seconds * 2);
      const map = SPRITES.solar ?? [];
      const width = map[0]?.length ?? 0;
      const left = ax - Math.floor(width / 2);
      const top = ay - map.length + 1;
      for (let r = 0; r < map.length; r++)
        for (let c = 0; c < width; c++) {
          const ch = map[r]?.[c];
          if (ch !== "B") continue;
          if (hash3(site.x * 10 + c, site.y * 10 + r, step) % 1000 < a * 330)
            pen.put(left + c, top + r, "foam");
        }
      return;
    }
    case "hydro": {
      if (!big) return;
      const streams = Math.ceil(3 * a);
      for (let k = 0; k < streams; k++) {
        const x = ax - 2 + k * 2;
        for (let y = 0; y < 4; y++) {
          // Foam runs down the face, two pixels a step, four steps a second.
          const lit = (y + Math.floor(seconds * 4) + k) % 3 === 0;
          pen.put(x, ay - 3 + y, lit ? "foam" : "hydro");
        }
      }
      return;
    }
  }
}
