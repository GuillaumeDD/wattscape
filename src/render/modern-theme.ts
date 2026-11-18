/**
 * The modern theme (PRD G-011, ARCHITECTURE § Art direction): the same scene as the
 * pixel-art theme, drawn smooth. A shaded relief in continuous tints, a sea in a
 * gradient, towns that glow at night, rivers as lines, a sky in a gradient and a
 * vignette; several output pixels per scene pixel, so nothing reads as a pixel.
 *
 * Same view as the pixel-art theme (north up, 2:1, seen from the south, D-017) and
 * the same offsets, so a camera frames the same ground in both. The plants and the
 * landmarks have their own drawings (./art/modern-plants.ts,
 * ./art/modern-landmarks.ts, B-027).
 *
 * Pure, and the same in every engine: additions, multiplications, divisions, floors
 * and square roots (exactly rounded by IEEE 754) decide every pixel of the still
 * frame; no Math.sin, exp or hypot (AGENTS.md § Determinism). Only the turning
 * blades, an animation, take a sine.
 */
import { ELEVATION_CLASSES, FOREIGN, kindOfRegion, SEA } from "../map/grid.ts";
import { type Landmark } from "../map/landmarks.ts";
import { type TerrainLayer } from "../map/layers.ts";
import { RIVER_UNITS_PER_KM } from "../map/river-lines.ts";
import { HIGHEST_METRES, RISE_METRES_PER_KM } from "../scene/camera.ts";
import { type Scene, type ScenePlant, type Town } from "../scene/scene.ts";
import { landmarkBox } from "./art/landmarks.ts";
import { type Brush } from "./art/shapes.ts";
import { drawModernLandmark } from "./art/modern-landmarks.ts";
import { drawModernBody, drawModernMotion } from "./art/modern-plants.ts";
import { hasMotion, plantBox, type SpriteSize } from "./art/plants.ts";
import { DITHER_LEVELS } from "./dither.ts";
import { type Rgb } from "./palette.ts";
import {
  lampLevels,
  plantMarkId,
  SPRITES_FROM_SCALE,
  townCells,
  visiblePlants,
} from "./pixel-theme.ts";
import { type Surface } from "./surface.ts";
import type { Drawn, Mark, Rect, Theme } from "./theme.ts";

/**
 * The most output pixels a frame is drawn at, beyond a density of 2: a frame costs
 * about 35 ns a pixel (ARCHITECTURE § Performance), and a moving camera draws one
 * every 33 ms.
 */
export const MODERN_PIXEL_BUDGET = 600_000;

/**
 * Output pixels per scene pixel, for a scene of `width` × `height` shown at `factor`
 * device pixels per scene pixel: 2, or more in a small window, up to the device's
 * own pixels, while the budget allows; the canvas scales the rest up, smoothly.
 * Where that gives 2 and the screen has 4 or more, the sharp density, 4: the map
 * is still drawn at 2 (`modernMapDensity`), what stands on it at 4 (D-058).
 * While the camera moves (`moving`), half of the map's density, rounded down: a
 * quarter of its pixels or fewer, softer for the time of the movement (PRD Q-34,
 * D-056).
 */
export function modernDensity(
  width: number,
  height: number,
  factor: number,
  moving = false,
): number {
  let d = Number.isFinite(factor) ? Math.max(2, Math.floor(factor)) : 2;
  while (d > 2 && width * height * d * d > MODERN_PIXEL_BUDGET) d--;
  if (moving) return Math.floor(d / 2);
  return d === 2 && Number.isFinite(factor) && factor >= MODERN_SHARP_DENSITY
    ? MODERN_SHARP_DENSITY
    : d;
}

/**
 * The sharp density (D-058): where the screen has 4 pixels or more per scene pixel
 * and the budget gives the map 2, the frame has 4. The map, soft, is still drawn at
 * 2 and spread over the frame; the plants and the landmarks, small and where the
 * eye rests, are drawn at the frame's 4, the pixels of a full HD screen.
 */
export const MODERN_SHARP_DENSITY = 4;

/** The pixels per scene pixel the map is drawn at, in a frame of a density. */
export function modernMapDensity(density: number): number {
  return density === MODERN_SHARP_DENSITY ? MODERN_SHARP_DENSITY / 2 : density;
}

/**
 * Spreads a picture of `width` × `height` pixels over a surface twice as large each
 * way, smoothly: each pixel of `out` is read between the centres of the four
 * nearest of `from`, three quarters from the nearer and one from the farther each
 * way (at the edges, the nearest alone). In whole numbers, the same bytes in every
 * engine; two bytes of a pixel at a time, which makes it twice as fast: about
 * 10 ms for a full HD frame, where byte by byte took 22 (measured in Node).
 */
export function spread(from: Uint8ClampedArray, width: number, height: number, out: Surface): void {
  if (out.width !== width * 2 || out.height !== height * 2 || from.length !== width * height * 4)
    throw new Error("the surface is not twice the picture");
  const source = new Uint32Array(from.buffer, from.byteOffset, width * height);
  const target = new Uint32Array(out.data.buffer, out.data.byteOffset, out.width * out.height);
  const wide = out.width;
  // A pixel is four bytes: the first and the third are summed in one number, the
  // second and the fourth in another, with room between them for the sums (the
  // same on a machine of either byte order).
  const PAIR = 0x00ff00ff;
  /** A row of `from` spread along x: for each pixel of `out`, its two pairs, times 4. */
  const along = (row: number, odd: Uint32Array, even: Uint32Array): void => {
    const start = row * width;
    for (let x = 0; x < width; x++) {
      const here = source[start + x] ?? 0;
      const before = source[start + Math.max(0, x - 1)] ?? 0;
      const after = source[start + Math.min(width - 1, x + 1)] ?? 0;
      const o = (here & PAIR) * 3;
      const e = ((here >>> 8) & PAIR) * 3;
      odd[2 * x] = o + (before & PAIR);
      even[2 * x] = e + ((before >>> 8) & PAIR);
      odd[2 * x + 1] = o + (after & PAIR);
      even[2 * x + 1] = e + ((after >>> 8) & PAIR);
    }
  };
  let rows = [
    { odd: new Uint32Array(wide), even: new Uint32Array(wide) },
    { odd: new Uint32Array(wide), even: new Uint32Array(wide) },
    { odd: new Uint32Array(wide), even: new Uint32Array(wide) },
  ] as const;
  const ROUND = 0x00080008;
  for (let y = 0; y < height; y++) {
    // The rows before, here and after, spread along x; each is spread once.
    const [before, here, after] = rows;
    if (y === 0) {
      along(0, here.odd, here.even);
      before.odd.set(here.odd);
      before.even.set(here.even);
    }
    along(Math.min(height - 1, y + 1), after.odd, after.even);
    let up = 2 * y * wide;
    let down = up + wide;
    for (let x = 0; x < wide; x++) {
      const o = (here.odd[x] ?? 0) * 3;
      const e = (here.even[x] ?? 0) * 3;
      target[up++] =
        (((o + (before.odd[x] ?? 0) + ROUND) >>> 4) & PAIR) |
        ((((e + (before.even[x] ?? 0) + ROUND) >>> 4) & PAIR) << 8);
      target[down++] =
        (((o + (after.odd[x] ?? 0) + ROUND) >>> 4) & PAIR) |
        ((((e + (after.even[x] ?? 0) + ROUND) >>> 4) & PAIR) << 8);
    }
    rows = [here, after, before];
  }
}

const hex = (s: string): Rgb => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];

/** The land's tints by altitude in metres, a relief map's; linear in between. */
export const MODERN_TINTS: readonly (readonly [number, Rgb])[] = [
  [0, hex("#b7c59a")],
  [150, hex("#a3b98a")],
  [300, hex("#86a678")],
  [500, hex("#6c9069")],
  [800, hex("#55785e")],
  [1300, hex("#8f948b")],
  [1900, hex("#b9b8b0")],
  [2400, hex("#f3f4f1")],
];
const SEA_SHALLOW = hex("#6f9fc0");
const SEA_MID = hex("#44709c");
const SEA_DEEP = hex("#2b4a76");
const SURF = hex("#cfe3ec");
const RIVER = hex("#7fb0d0");
const TOWN_DAY = hex("#e2c7b0");
const ABROAD = hex("#c3c8bd");
const LAMP = hex("#ffd98a");
const STAR = hex("#fffaeb");
/** The light's colour at sunset (darkness 1) and at night (darkness 2), as factors. */
const DUSK: Rgb = [0.86, 0.66, 0.6];
const NIGHT: Rgb = [0.2, 0.27, 0.46];
/** The sky, zenith then horizon, by day, at sunset and at night. */
const SKY: readonly (readonly [Rgb, Rgb])[] = [
  [hex("#a9cde6"), hex("#e4eef3")],
  [hex("#56659c"), hex("#f2b88c")],
  [hex("#080c1c"), hex("#18203f")],
];
/** The land melts into the sky over this many kilometres from the map's north edge. */
const HAZE_KM = 140;
/** How much darker the corners are than the centre. */
const VIGNETTE = 0.3;
/** How strongly the relief is shaded: the slope is multiplied by this. */
const SHADE_EXAGGERATION = 6;

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0); // NaN → 0
const smooth = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** The land's tint at an altitude. */
export function modernTint(metres: number): Rgb {
  for (let i = MODERN_TINTS.length - 1; i >= 0; i--) {
    const [at, colour] = MODERN_TINTS[i] ?? [0, SEA_DEEP];
    if (metres >= at) {
      const next = MODERN_TINTS[i + 1];
      return next === undefined ? colour : mix(colour, next[1], (metres - at) / (next[0] - at));
    }
  }
  return MODERN_TINTS[0]?.[1] ?? SEA_DEEP;
}

/** The sea's colour at a distance from the coast, in kilometres. */
export function modernSea(km: number): Rgb {
  return mix(mix(SEA_SHALLOW, SEA_MID, smooth(0, 14, km)), SEA_DEEP, smooth(10, 60, km));
}

/** The light as factors on the land's colour: white by day, warm at sunset, blue at night. */
export function modernLight(darkness: number): Rgb {
  const d = Number.isNaN(darkness) ? 2 : Math.min(2, Math.max(0, darkness));
  return d <= 1 ? mix([1, 1, 1], DUSK, d) : mix(DUSK, NIGHT, d - 1);
}

/** The sky's colour, `t` (0–1) of the way from the zenith to the horizon. */
export function modernSky(darkness: number, t: number): Rgb {
  const d = Number.isNaN(darkness) ? 2 : Math.min(2, Math.max(0, darkness));
  const k = d <= 1 ? 0 : 1;
  const [from, to] = [SKY[k] ?? SKY[0], SKY[k + 1] ?? SKY[0]];
  if (from === undefined || to === undefined) return SEA_DEEP;
  return mix(mix(from[0], from[1], t), mix(to[0], to[1], t), d - k);
}

/** One pass of a [1 2 1] blur each way, in integers; the edge cells go on. */
function blur(src: Uint16Array, columns: number, rows: number): Uint16Array {
  const mid = new Uint16Array(src.length);
  for (let r = 0; r < rows; r++) {
    const row = r * columns;
    for (let c = 0; c < columns; c++) {
      const a = src[row + (c > 0 ? c - 1 : c)] ?? 0;
      const b = src[row + (c < columns - 1 ? c + 1 : c)] ?? 0;
      mid[row + c] = (a + 2 * (src[row + c] ?? 0) + b + 2) >> 2;
    }
  }
  const out = new Uint16Array(src.length);
  for (let r = 0; r < rows; r++) {
    const up = (r > 0 ? r - 1 : r) * columns;
    const down = (r < rows - 1 ? r + 1 : r) * columns;
    const row = r * columns;
    for (let c = 0; c < columns; c++)
      out[row + c] = ((mid[up + c] ?? 0) + 2 * (mid[row + c] ?? 0) + (mid[down + c] ?? 0) + 2) >> 2;
  }
  return out;
}

/**
 * Distance of each sea cell to the land, in thirds of a cell, capped at 300 (a
 * hundred cells): a 3-4 chamfer, two sweeps, so the sea's bands follow the coast in
 * rounded curves (the layer's own `seaDistance` counts steps, in diamonds), then one
 * blur. Integers only.
 */
export function coastDistance(land: Uint8Array, columns: number, rows: number): Uint16Array {
  const FAR = 300;
  const d = new Uint16Array(land.length);
  for (let i = 0; i < d.length; i++) d[i] = land[i] === 255 ? 0 : FAR;
  const relax = (i: number, r: number, c: number, dr: number, dc: number, cost: number): void => {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= rows || cc >= columns) return;
    const v = (d[rr * columns + cc] ?? FAR) + cost;
    if (v < (d[i] ?? FAR)) d[i] = v;
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      if (d[i] === 0) continue;
      relax(i, r, c, 0, -1, 3);
      relax(i, r, c, -1, 0, 3);
      relax(i, r, c, -1, -1, 4);
      relax(i, r, c, -1, 1, 4);
    }
  for (let r = rows - 1; r >= 0; r--)
    for (let c = columns - 1; c >= 0; c--) {
      const i = r * columns + c;
      if (d[i] === 0) continue;
      relax(i, r, c, 0, 1, 3);
      relax(i, r, c, 1, 0, 3);
      relax(i, r, c, 1, 1, 4);
      relax(i, r, c, 1, -1, 4);
    }
  return blur(d, columns, rows);
}

/** What the theme works out once per layer and town list: nothing here follows the light. */
interface Ground {
  readonly towns: readonly Town[];
  /** Altitude of each cell in metres, smoothed; 0 at sea and abroad. */
  readonly height: Uint16Array;
  /** 255 on land, 0 at sea. */
  readonly land: Uint8Array;
  /** The sea's colour at each cell, RGB; on land, the surf's. */
  readonly sea: Uint8ClampedArray;
  /** The land's colour by day, RGB, before the veil. */
  readonly day: Uint8ClampedArray;
  /** The sea cells that touch land, where the texture carries the land's colour on. */
  readonly shore: Int32Array;
  /** `townCells` of the layer. */
  readonly cells: Uint8Array;
  /** The texture drawn last, and what it was made for. */
  texture: Texture | null;
}

/** The land as a frame draws it: RGB by day with the veil, and the lamps in alpha. */
interface Texture {
  readonly focus: number;
  readonly lamps: string;
  readonly dusk: number;
  readonly rgba: Uint8ClampedArray;
}

const grounds = new WeakMap<TerrainLayer, Ground>();

function groundOf(layer: TerrainLayer, towns: readonly Town[]): Ground {
  const known = grounds.get(layer);
  if (known?.towns === towns) return known;
  const { columns, rows, km, kinds, elevation } = layer;
  const n = kinds.length;
  const raw = new Uint16Array(n);
  const land = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const kind = kinds[i] ?? SEA;
    land[i] = kind === SEA ? 0 : 255;
    raw[i] = kind === SEA || kind === FOREIGN ? 0 : (ELEVATION_CLASSES[elevation[i] ?? 0] ?? 0);
  }
  const offshore = coastDistance(land, columns, rows);
  // The classes are steps (50 m low down, 400 m high up): two passes round them off.
  const height = blur(blur(raw, columns, rows), columns, rows);
  const cells = townCells(layer, towns);
  const sea = new Uint8ClampedArray(n * 3);
  const day = new Uint8ClampedArray(n * 3);
  const surf = mix(SEA_SHALLOW, SURF, 0.5);
  // The sea's colour by distance and the land's tint by altitude, worked out once
  // per value rather than per cell.
  const waters = new Float64Array(301 * 3);
  for (let d = 0; d <= 300; d++) waters.set(modernSea((d * km) / 3), d * 3);
  const tints = new Float64Array((HIGHEST_METRES + 1) * 3);
  for (let m = 0; m <= HIGHEST_METRES; m++) tints.set(modernTint(m), m * 3);
  const shore: number[] = [];
  // Slopes are read over about 4 km on both layers, so the shading shows whole
  // slopes, not every bump, and stays alike from one layer to the other.
  const reach = Math.max(1, Math.round(2 / km));
  const run = 2 * reach * km * 1000;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      const isLand = land[i] === 255;
      if (!isLand) {
        const w = (offshore[i] ?? 0) * 3;
        sea[i * 3] = waters[w] ?? 0;
        sea[i * 3 + 1] = waters[w + 1] ?? 0;
        sea[i * 3 + 2] = waters[w + 2] ?? 0;
        let touches = false;
        for (let dr = -1; dr <= 1 && !touches; dr++)
          for (let dc = -1; dc <= 1 && !touches; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            touches =
              rr >= 0 && cc >= 0 && rr < rows && cc < columns && land[rr * columns + cc] === 255;
          }
        if (touches) shore.push(i);
        continue;
      }
      sea[i * 3] = surf[0];
      sea[i * 3 + 1] = surf[1];
      sea[i * 3 + 2] = surf[2];
      // Hill shading, one light from the north-west: a slope that faces it is
      // lighter, one that turns away darker, flat ground as it is.
      const west = height[r * columns + Math.max(0, c - reach)] ?? 0;
      const east = height[r * columns + Math.min(columns - 1, c + reach)] ?? 0;
      const north = height[Math.max(0, r - reach) * columns + c] ?? 0;
      const south = height[Math.min(rows - 1, r + reach) * columns + c] ?? 0;
      const gx = ((east - west) / run) * SHADE_EXAGGERATION;
      const gy = ((south - north) / run) * SHADE_EXAGGERATION;
      const facing = (gx + gy + 1) / Math.sqrt(gx * gx + gy * gy + 1);
      const shade = Math.min(1.18, Math.max(0.52, 0.5 + 0.5 * facing));
      const t = Math.min(HIGHEST_METRES, height[i] ?? 0) * 3;
      // A town: a warm wash by day; its lamps come with the texture.
      const wash = cells[i] !== 0 ? 0.8 : 0;
      for (let k = 0; k < 3; k++) {
        const tint = (tints[t + k] ?? 0) * shade;
        day[i * 3 + k] = tint + ((TOWN_DAY[k] ?? 0) - tint) * wash;
      }
    }
  const ground: Ground = {
    towns,
    height,
    land,
    sea,
    day,
    shore: Int32Array.from(shore),
    cells,
    texture: null,
  };
  grounds.set(layer, ground);
  return ground;
}

/**
 * The land's texture for a frame: the day colours, veiled abroad and outside the
 * region in focus; one cell into the sea, the mean of the land around, so the coast
 * is cut clean by the land's mask; and in alpha the lamps, a glow around each town of
 * a region with a figure, stronger the more the region consumes.
 */
function textureOf(layer: TerrainLayer, ground: Ground, scene: Scene): Uint8ClampedArray {
  const focus = scene.focus === null ? -1 : kindOfRegion(scene.focus);
  const levels = lampLevels(scene);
  const lamps = levels.join();
  // By day the land around is paler than the region; a pale veil under the night's
  // light would outshine it, so as the sun sets the veil turns to a shade, in eight
  // steps (the texture is made again at each).
  const d = scene.light.darkness;
  const dusk = Number.isNaN(d) ? 8 : Math.round(8 * clamp01(d - 0.5));
  const known = ground.texture;
  if (known?.focus === focus && known.lamps === lamps && known.dusk === dusk) return known.rgba;
  const pale = 0.65 * (1 - dusk / 8);
  const dim = 1 - 0.4 * (dusk / 8);
  const { columns, rows, kinds } = layer;
  const n = kinds.length;
  const rgba = new Uint8ClampedArray(n * 4);
  const glow = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const kind = kinds[i] ?? SEA;
    if (kind === SEA) continue;
    let r = ground.day[i * 3] ?? 0;
    let g = ground.day[i * 3 + 1] ?? 0;
    let b = ground.day[i * 3 + 2] ?? 0;
    if (kind === FOREIGN || (focus !== -1 && kind !== focus)) {
      // The land around recedes: paler and greyer, its relief still there.
      const grey = (r + g + b) / 3;
      r = (r + (grey + (ABROAD[0] - grey) * 0.7 - r) * pale) * dim;
      g = (g + (grey + (ABROAD[1] - grey) * 0.7 - g) * pale) * dim;
      b = (b + (grey + (ABROAD[2] - grey) * 0.7 - b) * pale) * dim;
    }
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    const level = levels[kind] ?? -1;
    if (ground.cells[i] !== 0 && level >= 0) glow[i] = Math.round((255 * level) / DITHER_LEVELS);
  }
  // A lone town is one cell: the blur leaves it a quarter of its light.
  const halo = blur(glow, columns, rows);
  for (let i = 0; i < n; i++) if (ground.land[i] === 255) rgba[i * 4 + 3] = (halo[i] ?? 0) * 2.2;
  for (const i of ground.shore) {
    const r = Math.floor(i / columns);
    const c = i - r * columns;
    let count = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= columns) continue;
        const j = rr * columns + cc;
        if (ground.land[j] !== 255) continue;
        count++;
        sr += rgba[j * 4] ?? 0;
        sg += rgba[j * 4 + 1] ?? 0;
        sb += rgba[j * 4 + 2] ?? 0;
      }
    if (count === 0) continue;
    rgba[i * 4] = sr / count;
    rgba[i * 4 + 1] = sg / count;
    rgba[i * 4 + 2] = sb / count;
  }
  ground.texture = { focus, lamps, dusk, rgba };
  return rgba;
}

/** Where a frame is drawn: its pixels, what each shows of the ground, and the view. */
interface Frame {
  readonly data: Uint8ClampedArray;
  /**
   * For each pixel, the row of the ground it shows (as the row of the frame that
   * ground would be on if it were flat), or -32768 for the sky: what stands on the
   * ground north of it is hidden by it.
   */
  readonly depth: Int16Array;
  readonly width: number;
  readonly height: number;
  /** Output pixels per scene pixel. */
  readonly density: number;
  /** Output pixels per kilometre east–west. */
  readonly scale: number;
  /** Ground pixel (ox, oy), in output pixels, is at the frame's top-left corner. */
  readonly ox: number;
  readonly oy: number;
  /** The light's factors, and the vignette's squared distances per column and row. */
  readonly light: Rgb;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
}

const SKY_DEPTH = -32768;

/** The vignette's factor at squared distances from the centre (1 at an edge's middle). */
function vignette(x2: number, y2: number): number {
  // smooth(0.3, 2.1) of the squared distance: nothing near the centre, all at the corners.
  const t = clamp01((x2 + y2 - 0.3) / 1.8);
  return 1 - VIGNETTE * t * t * (3 - 2 * t);
}

function frameOf(scene: Scene, data: Uint8ClampedArray, depth: Int16Array, density: number): Frame {
  const s = scene.camera.scale;
  const width = scene.width * density;
  const height = scene.height * density;
  const vx = new Float64Array(width);
  const vy = new Float64Array(height);
  for (let x = 0; x < width; x++) {
    const v = ((x + 0.5) / width) * 2 - 1;
    vx[x] = v * v;
  }
  for (let y = 0; y < height; y++) {
    const v = ((y + 0.5) / height) * 2 - 1;
    vy[y] = v * v;
  }
  return {
    data,
    depth,
    width,
    height,
    density,
    scale: s * density,
    // The pixel-art theme's own offsets, so both themes frame the same ground and
    // the picture moves when they do.
    ox: (Math.round(scene.camera.x * s) - Math.floor(scene.width / 2)) * density,
    oy: (Math.round((scene.camera.y * s) / 2) - Math.floor(scene.height / 2)) * density,
    light: modernLight(scene.light.darkness),
    vx,
    vy,
  };
}

/** A small integer hash of a pixel, for the stars (no Math.random). */
function pixelHash(x: number, y: number): number {
  let h = Math.imul(y, 0x27d4eb2d) ^ Math.imul(x, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/**
 * Draws the sky and one terrain layer: each row of the ground from the front
 * (south) to the back (north) under a horizon that rises with the relief, so a
 * mountain hides what is behind it. Past the grid's west, east and south edges the
 * edge cells go on; north of it is the sky.
 */
function drawTerrain(frame: Frame, scene: Scene, layer: TerrainLayer): void {
  const ground = groundOf(layer, scene.towns);
  const land = textureOf(layer, ground, scene);
  const { height: metres, land: mask, sea } = ground;
  const { data, depth, width, height, scale, ox, oy, light, vx, vy } = frame;
  const { km, columns, rows } = layer;
  const [lr, lg, lb] = light;
  const darkness = scene.light.darkness;
  const lit = scene.light.emissive;
  const rise = scale / RISE_METRES_PER_KM; // output pixels per metre of altitude
  const lift = Math.ceil(HIGHEST_METRES * rise) + 1;
  // The coast is cut where the land's mask crosses a half, over about 1.5 pixels.
  const sharp = Math.max(1, (km * scale) / 1.5);
  const haze = modernSky(darkness, 1);
  // Each column's cells and weights, worked out once.
  const west = new Int32Array(width);
  const east = new Int32Array(width);
  const across = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    const fx = Math.min(columns - 1, Math.max(0, (x + 0.5 + ox) / scale / km - 0.5));
    const c0 = Math.floor(fx);
    west[x] = c0;
    east[x] = Math.min(columns - 1, c0 + 1);
    across[x] = fx - c0;
  }
  // The horizon of each column: the highest pixel drawn so far. Rows of the ground
  // are walked from the front to the back, and along each row, so that the map and
  // the frame are both read in the order they lie in memory.
  const horizon = new Int32Array(width).fill(height);
  let open = width;
  for (let row = height - 1 + lift; row >= 0 && open > 0; row--) {
    const ky = (2 * (row + 0.5 + oy)) / scale;
    if (ky < 0) break;
    const fy = Math.min(rows - 1, Math.max(0, ky / km - 0.5));
    const r0 = Math.floor(fy);
    const ty = fy - r0;
    const sy = 1 - ty;
    const north = r0 * columns;
    const south = Math.min(rows - 1, r0 + 1) * columns;
    const fog = ky < HAZE_KM ? smooth(HAZE_KM, 0, ky) * 0.55 : 0;
    for (let x = 0; x < width; x++) {
      const above = horizon[x] ?? 0;
      if (above <= 0) continue;
      const tx = across[x] ?? 0;
      const sx = 1 - tx;
      const i00 = north + (west[x] ?? 0);
      const i01 = north + (east[x] ?? 0);
      const i10 = south + (west[x] ?? 0);
      const i11 = south + (east[x] ?? 0);
      const w00 = sx * sy;
      const w01 = tx * sy;
      const w10 = sx * ty;
      const w11 = tx * ty;
      const h =
        (metres[i00] ?? 0) * w00 +
        (metres[i01] ?? 0) * w01 +
        (metres[i10] ?? 0) * w10 +
        (metres[i11] ?? 0) * w11;
      const top = Math.floor(row - h * rise);
      if (top >= above) continue;
      const a =
        ((mask[i00] ?? 0) * w00 +
          (mask[i01] ?? 0) * w01 +
          (mask[i10] ?? 0) * w10 +
          (mask[i11] ?? 0) * w11) /
        255;
      const t = clamp01((a - 0.5) * sharp + 0.5);
      let r = 0;
      let g = 0;
      let b = 0;
      let lamp = 0;
      if (t > 0) {
        const j00 = i00 * 4;
        const j01 = i01 * 4;
        const j10 = i10 * 4;
        const j11 = i11 * 4;
        r =
          (land[j00] ?? 0) * w00 +
          (land[j01] ?? 0) * w01 +
          (land[j10] ?? 0) * w10 +
          (land[j11] ?? 0) * w11;
        g =
          (land[j00 + 1] ?? 0) * w00 +
          (land[j01 + 1] ?? 0) * w01 +
          (land[j10 + 1] ?? 0) * w10 +
          (land[j11 + 1] ?? 0) * w11;
        b =
          (land[j00 + 2] ?? 0) * w00 +
          (land[j01 + 2] ?? 0) * w01 +
          (land[j10 + 2] ?? 0) * w10 +
          (land[j11 + 2] ?? 0) * w11;
        if (lit)
          lamp =
            (((land[j00 + 3] ?? 0) * w00 +
              (land[j01 + 3] ?? 0) * w01 +
              (land[j10 + 3] ?? 0) * w10 +
              (land[j11 + 3] ?? 0) * w11) /
              255) *
            t;
      }
      if (t < 1) {
        const j00 = i00 * 3;
        const j01 = i01 * 3;
        const j10 = i10 * 3;
        const j11 = i11 * 3;
        const u = 1 - t;
        r =
          r * t +
          ((sea[j00] ?? 0) * w00 +
            (sea[j01] ?? 0) * w01 +
            (sea[j10] ?? 0) * w10 +
            (sea[j11] ?? 0) * w11) *
            u;
        g =
          g * t +
          ((sea[j00 + 1] ?? 0) * w00 +
            (sea[j01 + 1] ?? 0) * w01 +
            (sea[j10 + 1] ?? 0) * w10 +
            (sea[j11 + 1] ?? 0) * w11) *
            u;
        b =
          b * t +
          ((sea[j00 + 2] ?? 0) * w00 +
            (sea[j01 + 2] ?? 0) * w01 +
            (sea[j10 + 2] ?? 0) * w10 +
            (sea[j11 + 2] ?? 0) * w11) *
            u;
      }
      // Under the light; the lamps are added after it, untinted.
      r = r * lr + LAMP[0] * lamp;
      g = g * lg + LAMP[1] * lamp;
      b = b * lb + LAMP[2] * lamp;
      if (fog > 0) {
        r += (haze[0] - r) * fog;
        g += (haze[1] - g) * fog;
        b += (haze[2] - b) * fog;
      }
      const x2 = vx[x] ?? 0;
      for (let y = top > 0 ? top : 0; y < above; y++) {
        const v = vignette(x2, vy[y] ?? 0);
        const p = y * width + x;
        data[p * 4] = r * v;
        data[p * 4 + 1] = g * v;
        data[p * 4 + 2] = b * v;
        data[p * 4 + 3] = 255;
        depth[p] = row;
      }
      horizon[x] = top;
      if (top <= 0) open--;
    }
  }
  // The sky above: a gradient down to the middle of the frame, and stars at night.
  const night = clamp01(darkness - 1.2) / 0.8;
  for (let y = 0; y < height && open > 0; y++) {
    const sky = modernSky(darkness, clamp01((2 * y) / height));
    const y2 = vy[y] ?? 0;
    for (let x = 0; x < width; x++) {
      if (y >= (horizon[x] ?? 0)) continue;
      const v = vignette(vx[x] ?? 0, y2);
      let star = 0;
      if (night > 0) {
        const hash = pixelHash(x, y);
        if (hash % 1499 === 0) star = night * (0.35 + ((hash >>> 12) % 8) / 12);
      }
      const p = y * width + x;
      data[p * 4] = (sky[0] + (STAR[0] - sky[0]) * star) * v;
      data[p * 4 + 1] = (sky[1] + (STAR[1] - sky[1]) * star) * v;
      data[p * 4 + 2] = (sky[2] + (STAR[2] - sky[2]) * star) * v;
      data[p * 4 + 3] = 255;
      depth[p] = SKY_DEPTH;
    }
  }
}

/** The smoothed altitude at a point of the map, in metres. */
function altitudeAt(layer: TerrainLayer, ground: Ground, x: number, y: number): number {
  const { km, columns, rows } = layer;
  const fx = Math.min(columns - 1, Math.max(0, x / km - 0.5));
  const fy = Math.min(rows - 1, Math.max(0, y / km - 0.5));
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fy);
  const c1 = Math.min(columns - 1, c0 + 1);
  const r1 = Math.min(rows - 1, r0 + 1);
  const tx = fx - c0;
  const ty = fy - r0;
  const h = ground.height;
  const north = (h[r0 * columns + c0] ?? 0) * (1 - tx) + (h[r0 * columns + c1] ?? 0) * tx;
  const south = (h[r1 * columns + c0] ?? 0) * (1 - tx) + (h[r1 * columns + c1] ?? 0) * tx;
  return north * (1 - ty) + south * ty;
}

/**
 * Draws the layer's rivers as lines on the ground, on French land only (an estuary
 * is sea already, and the map stops at the border), dimmer outside the region in
 * focus, and hidden by the relief in front of them.
 */
function drawRivers(frame: Frame, scene: Scene, layer: TerrainLayer): void {
  const ground = groundOf(layer, scene.towns);
  const { data, depth, width, height, scale, ox, oy, light, vx, vy, density } = frame;
  const { km, columns, rows, kinds } = layer;
  const focus = scene.focus === null ? -1 : kindOfRegion(scene.focus);
  const rise = scale / RISE_METRES_PER_KM;
  const s = scene.camera.scale;
  const far = mix(RIVER, ABROAD, 0.6);
  for (const river of layer.courses) {
    // Wider when closer, and for the great rivers.
    const great = river.reach >= 300 ? 1 : 0.6;
    const w = density * great * Math.min(1, Math.max(0.5, 0.4 + 0.12 * s));
    for (const line of river.lines) {
      let ax = 0;
      let ay = 0;
      let on = false;
      for (let k = 0; k + 1 < line.length; k += 2) {
        const x = (line[k] ?? 0) / RIVER_UNITS_PER_KM;
        const y = (line[k + 1] ?? 0) / RIVER_UNITS_PER_KM;
        const c = Math.floor(x / km);
        const r = Math.floor(y / km);
        const kind =
          c < 0 || r < 0 || c >= columns || r >= rows ? SEA : (kinds[r * columns + c] ?? SEA);
        const bx = x * scale - ox;
        const row = (y * scale) / 2 - oy;
        const by = row - altitudeAt(layer, ground, x, y) * rise;
        if (kind === SEA || kind === FOREIGN) {
          on = false;
          continue;
        }
        if (!on) {
          ax = bx;
          ay = by;
          on = true;
          continue;
        }
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        // Steps shorter than a pixel are joined to the next.
        if (len2 < 1 && k + 3 < line.length) continue;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - w));
        const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx) + w));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - w));
        const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by) + w));
        const colour = focus !== -1 && kind !== focus ? far : RIVER;
        // The ground it runs on, a pixel and a half of slack for the rounding.
        const limit = row + 1.5 * density;
        for (let py = y0; py <= y1; py++)
          for (let px = x0; px <= x1; px++) {
            const p = py * width + px;
            if ((depth[p] ?? 0) > limit) continue;
            const ex = px + 0.5 - ax;
            const ey = py + 0.5 - ay;
            const t = len2 > 0 ? clamp01((ex * dx + ey * dy) / len2) : 0;
            const fx = ex - t * dx;
            const fy = ey - t * dy;
            const alpha = clamp01(w / 2 + 0.5 - Math.sqrt(fx * fx + fy * fy));
            if (alpha <= 0) continue;
            const v = vignette(vx[px] ?? 0, vy[py] ?? 0) * alpha;
            const keep = 1 - alpha;
            data[p * 4] = (data[p * 4] ?? 0) * keep + colour[0] * light[0] * v;
            data[p * 4 + 1] = (data[p * 4 + 1] ?? 0) * keep + colour[1] * light[1] * v;
            data[p * 4 + 2] = (data[p * 4 + 2] ?? 0) * keep + colour[2] * light[2] * v;
          }
        ax = bx;
        ay = by;
      }
    }
  }
}

/** Something that stands on the ground: its anchor in scene pixels, and its ground's row. */
interface Standing {
  readonly x: number;
  readonly y: number;
  /** The frame row of the ground under it, in output pixels: what `Frame.depth` counts. */
  readonly row: number;
}

interface PlacedPlant extends Standing {
  readonly plant: ScenePlant;
}

interface PlacedLandmark extends Standing {
  readonly landmark: Landmark;
}

/** Where a point of the map stands on the frame. */
function standingAt(
  frame: Frame,
  scene: Scene,
  layer: TerrainLayer,
  x: number,
  y: number,
): Standing {
  const s = scene.camera.scale;
  const { density } = frame;
  const metres = altitudeAt(layer, groundOf(layer, scene.towns), x, y);
  return {
    x: Math.floor(x * s) - frame.ox / density,
    y: Math.floor((y * s) / 2 - (metres * s) / RISE_METRES_PER_KM) - frame.oy / density,
    row: (y * frame.scale) / 2 - frame.oy,
  };
}

interface MutableRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** What draws on the ground: the brush of the plants and the landmarks. */
interface Tools extends Brush {
  /** What is drawn next stands there: the relief in front of it hides it. */
  stand(on: Standing): void;
  /** The boxes drawn in so far, one for each thing that stood, in the pixels drawn. */
  touched(): readonly Rect[];
}

/**
 * The tools for what stands on the ground, under the light (softened at night, so a
 * plant still reads) and hidden where the relief in front covers it; lamps are drawn
 * as they are.
 *
 * The brush fills shapes, their edge smoothed over one output pixel (the plants,
 * ./art/modern-plants.ts, and the landmarks, ./art/modern-landmarks.ts).
 *
 * They draw into `target`: the frame's own pixels, or finer ones (the frame then
 * still says what the relief hides, and the vignette).
 */
function toolsOf(frame: Frame, emissive: boolean, target: Surface): Tools {
  const { depth, vx, vy } = frame;
  const { data, width, height } = target;
  // The pixels drawn per scene pixel, and the frame's pixels per pixel drawn: `target`
  // is the frame's own surface, or a finer one the frame was spread over.
  const density = (width * frame.density) / frame.width;
  const back = frame.density / density;
  const columns = frame.width;
  // The frame's column and row under each pixel drawn, worked out once.
  const column = new Int32Array(width);
  for (let px = 0; px < width; px++) column[px] = Math.floor(px * back);
  const row = new Int32Array(height);
  for (let py = 0; py < height; py++) row[py] = Math.floor(py * back);
  /** Whether the relief in front hides what stands at a pixel of a row of the frame's. */
  const hidden = (px: number, at: number): boolean => (depth[at + (column[px] ?? 0)] ?? 0) > limit;
  /** The vignette at a pixel, `y2` its row's share. */
  const dim = (px: number, y2: number): number => vignette(vx[column[px] ?? 0] ?? 0, y2);
  /**
   * Lays a colour over pixel `p`, covering the share `a` of it; (r, g, b) is the
   * colour times that share.
   */
  const lay = (p: number, a: number, r: number, g: number, b: number): void => {
    const i = p * 4;
    data[i] = (data[i] ?? 0) * (1 - a) + r;
    data[i + 1] = (data[i + 1] ?? 0) * (1 - a) + g;
    data[i + 2] = (data[i + 2] ?? 0) * (1 - a) + b;
  };
  // The boxes of what was drawn, one for each thing that stands.
  const touched: MutableRect[] = [];
  let current: MutableRect | null = null;
  const touch = (x0: number, y0: number, x1: number, y1: number): void => {
    if (!(x0 < x1 && y0 < y1)) return;
    if (current === null) {
      current = { left: x0, top: y0, right: x1, bottom: y1 };
      touched.push(current);
      return;
    }
    current.left = Math.min(current.left, x0);
    current.top = Math.min(current.top, y0);
    current.right = Math.max(current.right, x1);
    current.bottom = Math.max(current.bottom, y1);
  };
  const soft = emissive ? 0.3 : 0;
  const light: Rgb = [
    frame.light[0] + (1 - frame.light[0]) * soft,
    frame.light[1] + (1 - frame.light[1]) * soft,
    frame.light[2] + (1 - frame.light[2]) * soft,
  ];
  let limit = 0;
  const spot: Brush["spot"] = (cx, cy, rx, ry, colour, alpha, unlit = false) => {
    if (!(rx > 0) || !(ry > 0)) return;
    const r = colour[0] * (unlit ? 1 : light[0]);
    const g = colour[1] * (unlit ? 1 : light[1]);
    const b = colour[2] * (unlit ? 1 : light[2]);
    const x0 = Math.max(0, Math.floor((cx - rx) * density));
    const x1 = Math.min(width, Math.ceil((cx + rx) * density));
    const y0 = Math.max(0, Math.floor((cy - ry) * density));
    const y1 = Math.min(height, Math.ceil((cy + ry) * density));
    touch(x0, y0, x1, y1);
    for (let py = y0; py < y1; py++) {
      const dy = ((py + 0.5) / density - cy) / ry;
      const left = 1 - dy * dy;
      if (!(left > 0)) continue;
      // The row's run inside the ellipse, a pixel wider each side: no pixel lost.
      const half = Math.sqrt(left) * rx;
      const xa = Math.max(x0, Math.floor((cx - half) * density) - 1);
      const xb = Math.min(x1, Math.ceil((cx + half) * density) + 1);
      const at = (row[py] ?? 0) * columns;
      const y2 = vy[row[py] ?? 0] ?? 0;
      for (let px = xa; px < xb; px++) {
        const dx = ((px + 0.5) / density - cx) / rx;
        const a = (1 - dx * dx - dy * dy) * alpha;
        if (!(a > 0)) continue;
        if (hidden(px, at)) continue;
        const v = dim(px, y2) * a;
        lay(py * width + px, a, r * v, g * v, b * v);
      }
    }
  };
  return {
    emissive,
    stand(on) {
      // Two scene pixels of slack: its foot stands on the ground, not behind it.
      limit = on.row + 2 * frame.density;
      current = null;
    },
    touched: () => touched,
    spot,
    fill(left, top, right, bottom, distance, colour, ink, span) {
      const unlit = ink?.unlit === true;
      const opacity = ink?.alpha ?? 1;
      const shade = ink?.shade;
      const r = colour[0] * (unlit ? 1 : light[0]);
      const g = colour[1] * (unlit ? 1 : light[1]);
      const b = colour[2] * (unlit ? 1 : light[2]);
      const x0 = Math.max(0, Math.floor(left * density));
      const x1 = Math.min(width, Math.ceil(right * density));
      const y0 = Math.max(0, Math.floor(top * density));
      const y1 = Math.min(height, Math.ceil(bottom * density));
      touch(x0, y0, x1, y1);
      for (let py = y0; py < y1; py++) {
        const y = (py + 0.5) / density;
        // The pixels whose centres are in the span, if there is one.
        const [from, to] = span === undefined ? [-Infinity, Infinity] : span(y);
        const xa = Math.max(x0, Math.floor(from * density));
        const xb = Math.min(x1, Math.ceil(to * density));
        const at = (row[py] ?? 0) * columns;
        const y2 = vy[row[py] ?? 0] ?? 0;
        for (let px = xa; px < xb; px++) {
          const x = (px + 0.5) / density;
          // The edge over one output pixel: half covered where the distance is 0.
          const a = clamp01(0.5 - distance(x, y) * density) * opacity;
          if (!(a > 0)) continue;
          if (hidden(px, at)) continue;
          const v = dim(px, y2) * a * (shade === undefined ? 1 : shade(x, y));
          lay(py * width + px, a, r * v, g * v, b * v);
        }
      }
    },
  };
}

/** The buffers of the frame drawn last, reused while the size stays the same. */
let depths: [Int16Array, Int16Array] | null = null;
let spare: Uint8ClampedArray | null = null;
let ground: Uint8ClampedArray | null = null;

/**
 * Draws a scene: the 4 km layer, the 1 km one, or a blend of both, then the rivers,
 * the landmarks and the plants' still bodies. `out` is the scene's size times a
 * whole number, the density. Returns what moves; `animate` reads what this frame
 * hides behind the relief, so it is to be called before the next frame is drawn.
 *
 * At the sharp density (`MODERN_SHARP_DENSITY`), the map is drawn at half of it and
 * spread smoothly over `out`; what stands on it is then drawn at `out`'s own pixels
 * (D-058).
 */
export function drawModernScene(scene: Scene, out: Surface): Drawn {
  const sharp = scene.width > 0 ? out.width / scene.width : 1;
  if (
    !Number.isInteger(sharp) ||
    sharp < 1 ||
    out.width !== scene.width * sharp ||
    out.height !== scene.height * sharp
  )
    throw new Error("the surface is not a whole multiple of the scene's size");
  const density = modernMapDensity(sharp);
  const pixels = scene.width * density * scene.height * density;
  // The map's own pixels: `out`'s, or a buffer of this module's when `out` is finer.
  if (density !== sharp && ground?.length !== pixels * 4)
    ground = new Uint8ClampedArray(pixels * 4);
  const map = density === sharp || ground === null ? out.data : ground;
  if (depths?.[0].length !== pixels) depths = [new Int16Array(pixels), new Int16Array(pixels)];
  const detail = scene.fine === null ? 0 : Math.min(DITHER_LEVELS, Math.max(0, scene.detail));
  let layer = scene.coarse;
  let frame = frameOf(scene, map, depths[0], density);
  if (!(detail > 0) || scene.fine === null) {
    drawTerrain(frame, scene, layer);
    drawRivers(frame, scene, layer);
  } else if (detail >= DITHER_LEVELS) {
    layer = scene.fine;
    drawTerrain(frame, scene, layer);
    drawRivers(frame, scene, layer);
  } else {
    // Between the two layers: both are drawn, and blended. What stands on the
    // ground stands once, on the layer that shows the most.
    drawTerrain(frame, scene, scene.coarse);
    drawRivers(frame, scene, scene.coarse);
    if (spare?.length !== map.length) spare = new Uint8ClampedArray(map.length);
    const detailed = frameOf(scene, spare, depths[1], density);
    drawTerrain(detailed, scene, scene.fine);
    drawRivers(detailed, scene, scene.fine);
    const share = detail / DITHER_LEVELS;
    for (let i = 0; i < map.length; i++)
      map[i] = (map[i] ?? 0) + ((spare[i] ?? 0) - (map[i] ?? 0)) * share;
    if (detail * 2 >= DITHER_LEVELS) {
      layer = scene.fine;
      frame = { ...detailed, data: map };
    }
  }
  if (map !== out.data) spread(map, scene.width * density, scene.height * density, out);

  const size: SpriteSize = scene.camera.scale >= SPRITES_FROM_SCALE ? "full" : "marker";
  const pen = toolsOf(frame, scene.light.emissive, out);
  // Back to front: what stands further south is drawn over what stands behind it.
  const landmarks: PlacedLandmark[] =
    size === "full"
      ? scene.landmarks
          .map((landmark) => ({
            landmark,
            ...standingAt(frame, scene, layer, landmark.x, landmark.y),
          }))
          .filter((m) => m.x > -24 && m.x < scene.width + 24)
          .sort((a, b) => a.row - b.row || a.x - b.x)
      : [];
  for (const m of landmarks) {
    pen.stand(m);
    drawModernLandmark(pen, m.landmark, landmarkBox(m.landmark, m.x, m.y).left, m.y);
  }
  const plants: PlacedPlant[] = visiblePlants(scene, frame.ox / density, scene.width)
    .map((plant) => ({ plant, ...standingAt(frame, scene, layer, plant.site.x, plant.site.y) }))
    .sort((a, b) => a.row - b.row || a.x - b.x);
  for (const p of plants) {
    pen.stand(p);
    drawModernBody(pen, p.plant.site, p.plant.activity, p.x, p.y, size);
  }
  const marks: Mark[] = [
    ...landmarks.map((m): Mark => ({
      kind: "landmark",
      id: m.landmark.id,
      ...landmarkBox(m.landmark, m.x, m.y),
    })),
    ...plants.map((p): Mark => ({
      kind: "plant",
      id: plantMarkId(p.plant.site),
      plant: p.plant,
      ...plantBox(p.plant.site, p.x, p.y, size),
    })),
  ].sort((a, b) => a.bottom - b.bottom || a.left - b.left);
  const moving = plants.filter(
    (p) => p.plant.activity !== null && p.plant.activity > 0 && hasMotion(p.plant.site, size),
  );
  return {
    moving: moving.length > 0,
    marks,
    animate(target: Surface, seconds: number): readonly Rect[] {
      if (target.width !== out.width || target.height !== out.height) return [];
      const motion = toolsOf(frame, scene.light.emissive, target);
      for (const p of moving) {
        motion.stand(p);
        drawModernMotion(motion, p.plant.site, p.plant.activity, p.x, p.y, size, seconds);
      }
      return motion.touched();
    },
  };
}

export const modernTheme: Theme = {
  id: "modern",
  density: modernDensity,
  draw: drawModernScene,
};
