/**
 * The neon theme (PRD G-024, D-084, ARCHITECTURE § Art direction): the same scene
 * drawn as lines of light over a dark relief. The coast, the border of the region in
 * focus (of France on the national view), contour lines and the rivers glow; the
 * towns' lamps at night; a dusk-blue ground by day, a black one at night.
 *
 * Every glow is a function of a distance worked out where its pixel is drawn: to the
 * coast, to the border, to a contour's altitude, to a river's line. Nothing blurs
 * the frame. The distances to the coast and to the border are chamfer distances
 * between the map's cells, read between cells.
 *
 * Same view, density and offsets as the modern theme (./modern-theme.ts), so a
 * camera frames the same ground in all three themes. The plants and the landmarks
 * are the modern theme's drawings, outlined in light (B-042); the weather and the
 * seasons are drawn in ./neon-weather.ts (B-043).
 *
 * Pure, and the same in every engine: additions, multiplications, divisions, floors
 * and square roots decide every pixel of the still frame (AGENTS.md § Determinism).
 */
import { ELEVATION_CLASSES, FOREIGN, kindOfRegion, SEA } from "../map/grid.ts";
import { type Landmark } from "../map/landmarks.ts";
import { type TerrainLayer } from "../map/layers.ts";
import { RIVER_UNITS_PER_KM } from "../map/river-lines.ts";
import { HIGHEST_METRES, RISE_METRES_PER_KM } from "../scene/camera.ts";
import { anyPrecipitation, viewBox, weatherGrid } from "../scene/clouds.ts";
import { type Scene, type ScenePlant, type Town } from "../scene/scene.ts";
import { landmarkBox } from "./art/landmarks.ts";
import { drawModernLandmark } from "./art/modern-landmarks.ts";
import { drawModernBody, drawModernMotion } from "./art/modern-plants.ts";
import { hasMotion, plantBox, type SpriteSize } from "./art/plants.ts";
import { DITHER_LEVELS } from "./dither.ts";
import {
  coastDistance,
  type Frame as ModernFrame,
  modernDensity,
  modernLight,
  modernMapDensity,
  spread,
} from "./modern-theme.ts";
import { type Brush } from "./art/shapes.ts";
import { type Source } from "../data/eco2mix.ts";
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
import { cloudMask } from "./weather-art.ts";
import {
  animateNeonWeather,
  drawNeonWeather,
  NEON_SEASON_LINES,
  NEON_SNOW_GROUND,
  NEON_SNOW_LINE,
} from "./neon-weather.ts";
import { turnedAt } from "../scene/season.ts";
import { snowCoverOf, softSnow } from "../scene/snow.ts";

const hex = (s: string): Rgb => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** The lines' colours (D-084, proposed): the coast, the border, the contours, the lamps. */
export const NEON_COAST = hex("#2ef2ff");
export const NEON_BORDER = hex("#ff3ddc");
export const NEON_CONTOUR = hex("#8b6bff");
export const NEON_LAMP = hex("#ffb54a");
export const NEON_RIVER = hex("#3fa9ff");

/** The ground and the sky, by day and at night. */
const LAND_DAY = hex("#1d2645");
const LAND_NIGHT = hex("#080b18");
const SEA_DAY = hex("#121a33");
const SEA_NIGHT = hex("#03050c");
const SKY_DAY_TOP = hex("#141a33");
const SKY_DAY_LOW = hex("#3a2c66");
const SKY_NIGHT_TOP = hex("#020308");
const SKY_NIGHT_LOW = hex("#1c0f33");
const STAR: Rgb = [255, 255, 255];

/** The land melts into the sky over this many kilometres at the map's north edge. */
const HAZE_KM = 140;
/** Past the grid's edges the edge cells go on, their lines fading over this many km. */
const EDGE_FADE_KM = 15;

/**
 * The altitudes of the contour lines: between two classes of the map, never on a
 * class's floor, which is a plateau (`ELEVATION_CLASSES`). Fewer on the national view.
 */
export const NEON_CONTOURS_NEAR: readonly number[] = [
  150, 250, 350, 500, 700, 900, 1150, 1450, 1800, 2200, 2600, 3000,
];
export const NEON_CONTOURS_FAR: readonly number[] = [250, 500, 900, 1450, 2200];

/**
 * How much light a line gives at `d` output pixels from its middle: a core `w` wide
 * with a soft edge, and a halo that falls as 1 / (1 + 4 (d / halo)²).
 */
export function neonGlow(d: number, w: number, halo: number): number {
  const core = clamp01(w / 2 + 0.5 - d);
  const q = d / halo;
  return core + 0.45 / (1 + 4 * q * q);
}

/** How far the night has come: 0 by day, 1 when the sun is well down. */
export function neonNight(darkness: number): number {
  return Number.isNaN(darkness) ? 1 : clamp01((darkness - 0.4) / 1.2);
}

/** Two [1 2 1] passes, along rows then columns. */
function blur(src: Float64Array, columns: number, rows: number): Float64Array {
  const along = new Float64Array(src.length);
  const out = new Float64Array(src.length);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      along[i] =
        ((src[r * columns + Math.max(0, c - 1)] ?? 0) +
          2 * (src[i] ?? 0) +
          (src[r * columns + Math.min(columns - 1, c + 1)] ?? 0)) /
        4;
    }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      out[i] =
        ((along[Math.max(0, r - 1) * columns + c] ?? 0) +
          2 * (along[i] ?? 0) +
          (along[Math.min(rows - 1, r + 1) * columns + c] ?? 0)) /
        4;
    }
  return out;
}

/** What a layer gives every frame: fields per cell, read between cells. */
interface Fields {
  readonly towns: readonly Town[];
  readonly snowCover: Uint8Array | null;
  readonly key: string;
  /** Smoothed altitude, metres. */
  readonly height: Float64Array;
  /** Land 1, sea 0. */
  readonly land: Float64Array;
  /** Signed distance to the coast, km: positive inland. */
  readonly coast: Float64Array;
  /** Distance to the border of the area in focus, km. */
  readonly border: Float64Array;
  /** 1 in the area in focus, 0 elsewhere. */
  readonly focus: Float64Array;
  /**
   * 1 where the altitude is known around a cell (French land and the sea), falling
   * to 0 near land abroad: BD ALTI stops at the border, so the smoothed relief
   * drops there in a cliff no contour should draw (PRD Q-11).
   */
  readonly known: Float64Array;
  /** Hill shading from the north-west, about 0.45 to 1.25. */
  readonly shade: Float64Array;
  /** The towns' lamps, 0 to 1; all 0 by day. */
  readonly lamps: Float64Array;
  /**
   * Per cell, three by three (r, g, b): the land's ground by day, lighter under
   * snow, and the contour lines' colour, the season's, white under snow (B-043).
   */
  readonly ground: Float64Array;
  readonly lines: Float64Array;
}

const fieldsCache = new WeakMap<TerrainLayer, Fields>();

/** The fields of a layer for a scene: made again when the focus or the lamps change. */
function fieldsOf(layer: TerrainLayer, scene: Scene): Fields {
  const focusKind = scene.focus === null ? -1 : kindOfRegion(scene.focus);
  const levels = lampLevels(scene);
  const season = scene.season;
  const snowCover = snowCoverOf(layer, scene.weather);
  const key = `${String(focusKind)}|${levels.join()}|${String(scene.light.emissive)}|${season.from}|${season.to}|${String(season.share)}`;
  const known = fieldsCache.get(layer);
  if (known?.key === key && known.towns === scene.towns && known.snowCover === snowCover)
    return known;
  const { columns, rows, km, kinds, elevation } = layer;
  const n = kinds.length;
  const raw = new Float64Array(n);
  const land = new Uint8Array(n);
  const sea = new Uint8Array(n);
  const inFocus = new Uint8Array(n);
  const focus = new Float64Array(n);
  const measured = new Float64Array(n);
  const landShare = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const kind = kinds[i] ?? SEA;
    const isLand = kind !== SEA;
    land[i] = isLand ? 255 : 0;
    sea[i] = isLand ? 0 : 255;
    landShare[i] = isLand ? 1 : 0;
    raw[i] = kind === SEA || kind === FOREIGN ? 0 : (ELEVATION_CLASSES[elevation[i] ?? 0] ?? 0);
    const french = isLand && kind !== FOREIGN;
    inFocus[i] = (focusKind === -1 ? french : kind === focusKind) ? 255 : 0;
    focus[i] = inFocus[i] === 255 ? 1 : 0;
    measured[i] = kind === FOREIGN ? 0 : 1;
  }
  const height = blur(blur(raw, columns, rows), columns, rows);
  // As far as the relief's smoothing reaches: two passes, then a cut near 1.
  const measuredAround = blur(blur(measured, columns, rows), columns, rows);
  for (let i = 0; i < n; i++) measuredAround[i] = clamp01(((measuredAround[i] ?? 0) - 0.75) * 4);
  // The chamfer distances count 3 per cell; each side of the coast is half a cell
  // (1.5) from it.
  const offshore = coastDistance(land, columns, rows);
  const inland = coastDistance(sea, columns, rows);
  const coast = new Float64Array(n);
  for (let i = 0; i < n; i++)
    coast[i] =
      land[i] === 255
        ? (((inland[i] ?? 0) - 1.5) * km) / 3
        : (-((offshore[i] ?? 0) - 1.5) * km) / 3;
  // The border: the cells of the area in focus that touch land out of it.
  const edge = new Uint8Array(n);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      if (inFocus[i] !== 255) continue;
      const touches = (rr: number, cc: number): boolean => {
        if (rr < 0 || cc < 0 || rr >= rows || cc >= columns) return false;
        const j = rr * columns + cc;
        return inFocus[j] !== 255 && land[j] === 255;
      };
      if (touches(r, c + 1) || touches(r + 1, c) || touches(r, c - 1) || touches(r - 1, c))
        edge[i] = 255;
    }
  const toEdge = coastDistance(edge, columns, rows);
  const border = new Float64Array(n);
  for (let i = 0; i < n; i++) border[i] = edge[i] === 255 ? 0 : ((toEdge[i] ?? 0) * km) / 3;
  // Hill shading, as the modern theme's: slopes read over about 4 km.
  const reach = Math.max(1, Math.round(2 / km));
  const run = 2 * reach * km * 1000;
  const shade = new Float64Array(n);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const west = height[r * columns + Math.max(0, c - reach)] ?? 0;
      const east = height[r * columns + Math.min(columns - 1, c + reach)] ?? 0;
      const north = height[Math.max(0, r - reach) * columns + c] ?? 0;
      const south = height[Math.min(rows - 1, r + reach) * columns + c] ?? 0;
      const gx = ((east - west) / run) * 6;
      const gy = ((south - north) / run) * 6;
      const facing = (gx + gy + 1) / Math.sqrt(gx * gx + gy * gy + 1);
      shade[r * columns + c] = Math.min(1.25, Math.max(0.45, 0.5 + 0.5 * facing));
    }
  // The lamps: a glow around each town of a region with a figure, stronger the more
  // the region consumes (the same `lampLevels` as the other themes); none by day.
  const glow = new Float64Array(n);
  if (scene.light.emissive) {
    const cells = townCells(layer, scene.towns);
    for (let i = 0; i < n; i++) {
      const level = levels[kinds[i] ?? SEA] ?? -1;
      if (cells[i] !== 0 && level >= 0) glow[i] = level / DITHER_LEVELS;
    }
  }
  const lamps = blur(glow, columns, rows);
  for (let i = 0; i < n; i++) lamps[i] = Math.min(1, (lamps[i] ?? 0) * 2.2);
  // The season (B-022) on the contour lines, by patches as the modern theme turns
  // its tints (src/scene/season.ts), and the snow on the ground (src/scene/snow.ts),
  // kept when the sky's weather is hidden (D-072).
  const ground = new Float64Array(n * 3);
  const lines = new Float64Array(n * 3);
  const snowy = snowCover === null ? null : softSnow(layer, snowCover);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      const t = turnedAt(season, (c + 0.5) * km, (r + 0.5) * km);
      let g: Rgb = LAND_DAY;
      let l = mixRgb(NEON_SEASON_LINES[season.from], NEON_SEASON_LINES[season.to], t);
      const white = snowy === null ? 0 : (snowy[i] ?? 0);
      if (white > 0) {
        g = mixRgb(g, NEON_SNOW_GROUND, white);
        l = mixRgb(l, NEON_SNOW_LINE, white);
      }
      for (let ch = 0; ch < 3; ch++) {
        ground[i * 3 + ch] = g[ch] ?? 0;
        lines[i * 3 + ch] = l[ch] ?? 0;
      }
    }
  const fields: Fields = {
    snowCover,
    ground,
    lines,
    towns: scene.towns,
    key,
    height,
    land: landShare,
    coast,
    border,
    focus,
    known: measuredAround,
    shade,
    lamps,
  };
  fieldsCache.set(layer, fields);
  return fields;
}

/** Where a frame is drawn, and the view: the modern theme's frame, with no vignette. */
export type NeonFrame = ModernFrame & {
  /** 0 by day to 1 at night (`neonNight`). */
  readonly night: number;
};
type Frame = NeonFrame;

const SKY_DEPTH = -32768;

function frameOf(scene: Scene, data: Uint8ClampedArray, depth: Int16Array, density: number): Frame {
  const s = scene.camera.scale;
  const width = scene.width * density;
  const height = scene.height * density;
  return {
    data,
    depth,
    width,
    height,
    density,
    scale: s * density,
    ox: (Math.round(scene.camera.x * s) - Math.floor(scene.width / 2)) * density,
    oy: (Math.round((scene.camera.y * s) / 2) - Math.floor(scene.height / 2)) * density,
    light: modernLight(scene.light.darkness),
    // No vignette: its squared distances are all 0.
    vx: new Float64Array(width),
    vy: new Float64Array(height),
    night: neonNight(scene.light.darkness),
  };
}

/** A small integer hash of a pixel, for the stars (no Math.random). */
function pixelHash(x: number, y: number): number {
  let h = Math.imul(y, 0x27d4eb2d) ^ Math.imul(x, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/**
 * Draws one terrain layer's ground, each row from the front (south) to the back
 * (north) under a horizon per column, as the modern theme does; the sky is left
 * where nothing was drawn (`SKY_DEPTH`). The lines go on the top pixel of each
 * column's run, so a steep face is not smeared by them.
 */
function drawGround(frame: Frame, scene: Scene, layer: TerrainLayer): void {
  const f = fieldsOf(layer, scene);
  const { data, depth, width, height, scale, ox, oy, night, density } = frame;
  const { km, columns, rows } = layer;
  const rise = scale / RISE_METRES_PER_KM;
  const lift = Math.ceil(HIGHEST_METRES * rise) + 1;
  const seaBase = mixRgb(SEA_DAY, SEA_NIGHT, night);
  const skyLow = mixRgb(SKY_DAY_LOW, SKY_NIGHT_LOW, night);
  const gain = 0.75 + 0.35 * night;
  const sharp = Math.max(1, (km * scale) / 1.5);
  const coastWidth = Math.max(1, density * 0.6);
  const borderWidth = Math.max(1, density * 0.5);
  const levels = scene.camera.scale < 1 ? NEON_CONTOURS_FAR : NEON_CONTOURS_NEAR;
  const west = new Int32Array(width);
  const east = new Int32Array(width);
  const across = new Float64Array(width);
  const inX = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    const raw = (x + 0.5 + ox) / scale / km - 0.5;
    const out = raw < 0 ? -raw : raw > columns - 1 ? raw - (columns - 1) : 0;
    inX[x] = clamp01(1 - (out * km) / EDGE_FADE_KM);
    const fx = Math.min(columns - 1, Math.max(0, raw));
    const c0 = Math.floor(fx);
    west[x] = c0;
    east[x] = Math.min(columns - 1, c0 + 1);
    across[x] = fx - c0;
  }
  const horizon = new Int32Array(width).fill(height);
  // Cells per output pixel, east–west and north–south: what turns the altitude's
  // slope between cells into its change per pixel, which sets a contour's width.
  const perX = 1 / (scale * km);
  const perRow = 2 / (scale * km);
  let open = width;
  for (let row = height - 1 + lift; row >= 0 && open > 0; row--) {
    const ky = (2 * (row + 0.5 + oy)) / scale;
    if (ky < 0) break;
    const rawY = ky / km - 0.5;
    const inY = clamp01(1 - ((rawY > rows - 1 ? rawY - (rows - 1) : 0) * km) / EDGE_FADE_KM);
    const fy = Math.min(rows - 1, Math.max(0, rawY));
    const r0 = Math.floor(fy);
    const ty = fy - r0;
    const sy = 1 - ty;
    const north = r0 * columns;
    const south = Math.min(rows - 1, r0 + 1) * columns;
    const fog = ky < HAZE_KM ? (1 - ky / HAZE_KM) * 0.6 : 0;
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
      const at = (a: Float64Array): number =>
        (a[i00] ?? 0) * w00 + (a[i01] ?? 0) * w01 + (a[i10] ?? 0) * w10 + (a[i11] ?? 0) * w11;
      const h = at(f.height);
      const top = Math.floor(row - h * rise);
      if (top >= above) continue;
      const landShare = clamp01((at(f.land) - 0.5) * sharp + 0.5);
      const inside = (inX[x] ?? 0) * inY;
      const inFocus = at(f.focus);
      // The ground: dark, the land a little lighter, shaded, brighter in focus.
      const base = landShare * inside * (0.55 + 0.45 * at(f.shade)) * (0.55 + 0.45 * inFocus);
      // The land's ground and its contours' colour, by season and snow.
      const gr = f.ground;
      const at3 = (a: Float64Array, ch: number): number =>
        (a[i00 * 3 + ch] ?? 0) * w00 +
        (a[i01 * 3 + ch] ?? 0) * w01 +
        (a[i10 * 3 + ch] ?? 0) * w10 +
        (a[i11 * 3 + ch] ?? 0) * w11;
      const g0 = at3(gr, 0) + (LAND_NIGHT[0] - at3(gr, 0)) * night;
      const g1 = at3(gr, 1) + (LAND_NIGHT[1] - at3(gr, 1)) * night;
      const g2 = at3(gr, 2) + (LAND_NIGHT[2] - at3(gr, 2)) * night;
      let r = seaBase[0] + (g0 * 1.6 - seaBase[0]) * base;
      let g = seaBase[1] + (g1 * 1.6 - seaBase[1]) * base;
      let b = seaBase[2] + (g2 * 1.6 - seaBase[2]) * base;
      // The lines, on the run's top pixel.
      const coast = neonGlow(Math.abs(at(f.coast)) * scale, coastWidth, 2.5 * density);
      // Dimmer abroad and around other regions; full along the area's own shore,
      // where the focus read between cells is a half.
      const c = coast * gain * inside * (0.4 + 0.5 * Math.min(1, 2 * inFocus));
      let lr = NEON_COAST[0] * c;
      let lg = NEON_COAST[1] * c;
      let lb = NEON_COAST[2] * c;
      if (landShare > 0.5) {
        const bd = neonGlow(at(f.border) * scale, borderWidth, 2 * density) * gain * inside * 0.8;
        lr += NEON_BORDER[0] * bd;
        lg += NEON_BORDER[1] * bd;
        lb += NEON_BORDER[2] * bd;
        // A contour where the altitude crosses a level, about a pixel wide.
        const hs = f.height;
        const h00 = hs[i00] ?? 0;
        const h01 = hs[i01] ?? 0;
        const h10 = hs[i10] ?? 0;
        const h11 = hs[i11] ?? 0;
        const slope =
          Math.abs(((h01 - h00) * sy + (h11 - h10) * ty) * perX) +
          Math.abs(((h10 - h00) * sx + (h11 - h01) * tx) * perRow) +
          0.2;
        let dist = Infinity;
        for (const level of levels) {
          const d = Math.abs(h - level);
          if (d < dist) dist = d;
        }
        const cl =
          clamp01(1 - dist / slope) * 0.45 * (0.35 + 0.65 * inFocus) * inside * at(f.known);
        lr += at3(f.lines, 0) * cl;
        lg += at3(f.lines, 1) * cl;
        lb += at3(f.lines, 2) * cl;
      }
      const lamp = at(f.lamps);
      if (lamp > 0) {
        const k = lamp * 0.9;
        r += NEON_LAMP[0] * k;
        g += NEON_LAMP[1] * k;
        b += NEON_LAMP[2] * k;
      }
      if (fog > 0) {
        r += (skyLow[0] - r) * fog;
        g += (skyLow[1] - g) * fog;
        b += (skyLow[2] - b) * fog;
        lr *= 1 - fog;
        lg *= 1 - fog;
        lb *= 1 - fog;
      }
      // The lines go on the run's top pixel; on a face so steep that its run is
      // taller than a scene pixel, a cliff, they spread dimly over the whole run
      // instead, so that a cliff is not hatched by the lines of its rows.
      const run = above - top;
      const thin = run > density ? density / run : 0;
      for (let y = top > 0 ? top : 0; y < above; y++) {
        const p = y * width + x;
        const k = thin > 0 ? thin : y === top ? 1 : 0;
        data[p * 4] = r + lr * k;
        data[p * 4 + 1] = g + lg * k;
        data[p * 4 + 2] = b + lb * k;
        data[p * 4 + 3] = 255;
        depth[p] = row;
      }
      horizon[x] = top;
      if (top <= 0) open--;
    }
  }
  for (let x = 0; x < width; x++)
    for (let y = 0; y < (horizon[x] ?? 0); y++) depth[y * width + x] = SKY_DEPTH;
}

/** The sky where the frame shows no ground: a gradient, and stars at night. */
function drawSky(frame: Frame): void {
  const { data, depth, width, height, night } = frame;
  const top = mixRgb(SKY_DAY_TOP, SKY_NIGHT_TOP, night);
  const low = mixRgb(SKY_DAY_LOW, SKY_NIGHT_LOW, night);
  for (let y = 0; y < height; y++) {
    const sky = mixRgb(top, low, clamp01((2 * y) / height));
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (depth[p] !== SKY_DEPTH) continue;
      let star = 0;
      if (night > 0.5) {
        const hash = pixelHash(x, y);
        if (hash % 997 === 0) star = (night - 0.5) * 2 * (0.4 + ((hash >>> 12) % 8) / 10);
      }
      data[p * 4] = sky[0] + (STAR[0] - sky[0]) * star;
      data[p * 4 + 1] = sky[1] + (STAR[1] - sky[1]) * star;
      data[p * 4 + 2] = sky[2] + (STAR[2] - sky[2]) * star;
      data[p * 4 + 3] = 255;
    }
  }
}

/** The smoothed altitude at a point of the map, in metres. */
function altitudeAt(layer: TerrainLayer, f: Fields, x: number, y: number): number {
  const { km, columns, rows } = layer;
  const fx = Math.min(columns - 1, Math.max(0, x / km - 0.5));
  const fy = Math.min(rows - 1, Math.max(0, y / km - 0.5));
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fy);
  const c1 = Math.min(columns - 1, c0 + 1);
  const r1 = Math.min(rows - 1, r0 + 1);
  const tx = fx - c0;
  const ty = fy - r0;
  const h = f.height;
  const n = (h[r0 * columns + c0] ?? 0) * (1 - tx) + (h[r0 * columns + c1] ?? 0) * tx;
  const s = (h[r1 * columns + c0] ?? 0) * (1 - tx) + (h[r1 * columns + c1] ?? 0) * tx;
  return n * (1 - ty) + s * ty;
}

/**
 * The rivers as lines of light, on French land only, dimmer outside the region in
 * focus, hidden by the relief in front; never over the sky. Where two steps of a
 * line meet, the brighter light wins, so a joint is not lit twice.
 */
function drawRivers(frame: Frame, scene: Scene, layer: TerrainLayer): void {
  const f = fieldsOf(layer, scene);
  const { data, depth, width, height, scale, ox, oy, density, night } = frame;
  const { km, columns, rows, kinds } = layer;
  const focusKind = scene.focus === null ? -1 : kindOfRegion(scene.focus);
  const rise = scale / RISE_METRES_PER_KM;
  const s = scene.camera.scale;
  const gain = 0.6 + 0.3 * night;
  for (const river of layer.courses) {
    const great = river.reach >= 300 ? 1 : 0.6;
    const w = density * great * Math.min(1, Math.max(0.5, 0.4 + 0.12 * s)) * 0.7;
    const halo = 1.5 * density * great;
    const reach = w + 2 * halo;
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
        const by = row - altitudeAt(layer, f, x, y) * rise;
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
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - reach));
        const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx) + reach));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - reach));
        const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by) + reach));
        const strength = (focusKind !== -1 && kind !== focusKind ? 0.35 : 1) * gain * 0.6;
        // The ground it runs on, a pixel and a half of slack for the rounding.
        const limit = row + 1.5 * density;
        for (let py = y0; py <= y1; py++)
          for (let px = x0; px <= x1; px++) {
            const p = py * width + px;
            const d0 = depth[p] ?? SKY_DEPTH;
            if (d0 === SKY_DEPTH || d0 > limit) continue;
            const ex = px + 0.5 - ax;
            const ey = py + 0.5 - ay;
            const t = len2 > 0 ? clamp01((ex * dx + ey * dy) / len2) : 0;
            const fx = ex - t * dx;
            const fy = ey - t * dy;
            const d = Math.sqrt(fx * fx + fy * fy);
            if (d > reach) continue;
            const a = neonGlow(d, w, halo) * strength;
            const i = p * 4;
            for (let ch = 0; ch < 3; ch++) {
              const was = data[i + ch] ?? 0;
              data[i + ch] = Math.max(was, was * 0.6 + (NEON_RIVER[ch] ?? 0) * a);
            }
          }
        ax = bx;
        ay = by;
      }
    }
  }
}

/**
 * A plate (as the modern theme's, B-028): the ground and the rivers drawn once,
 * larger than the frame by `PLATE_MARGIN_X` and `PLATE_MARGIN_Y` scene pixels, and
 * cropped while the camera only pans. The sky is drawn after the crop, as it is
 * fixed to the screen; every pixel is the one a full draw gives.
 */
interface Plate {
  key: readonly unknown[];
  ox: number;
  oy: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  depth: Int16Array;
}

const PLATE_MARGIN_X = 24;
const PLATE_MARGIN_Y = 12;

let plate: Plate | null = null;
let drawnLast: { key: readonly unknown[]; ox: number; oy: number } | null = null;

const sameKey = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Copies the plate's part under `frame` into it. */
function crop(from: Plate, frame: Frame): void {
  const sx = frame.ox - from.ox;
  const sy = frame.oy - from.oy;
  const { data, depth, width, height } = frame;
  for (let y = 0; y < height; y++) {
    const q = (y + sy) * from.width + sx;
    data.set(from.data.subarray(q * 4, (q + width) * 4), y * width * 4);
    // The plate's rows start `sy` above the frame's.
    for (let x = 0; x < width; x++) {
      const d = from.depth[q + x] ?? SKY_DEPTH;
      depth[y * width + x] = d === SKY_DEPTH ? SKY_DEPTH : d - sy;
    }
  }
}

/** Draws a layer's ground and rivers into `frame`: from a plate in a pan, else in full. */
function groundOf(frame: Frame, scene: Scene, layer: TerrainLayer, plated: boolean): void {
  const full = (): void => {
    drawGround(frame, scene, layer);
    drawRivers(frame, scene, layer);
  };
  if (!plated) {
    drawnLast = null;
    full();
    return;
  }
  const key: readonly unknown[] = [
    layer,
    fieldsOf(layer, scene),
    frame.scale,
    frame.width,
    frame.height,
    frame.night,
  ];
  const covers = (p: Plate): boolean =>
    frame.ox >= p.ox &&
    frame.oy >= p.oy &&
    frame.ox + frame.width <= p.ox + p.width &&
    frame.oy + frame.height <= p.oy + p.height;
  if (plate !== null && sameKey(plate.key, key) && covers(plate)) {
    crop(plate, frame);
    return;
  }
  const last = drawnLast;
  const panned =
    last !== null && sameKey(last.key, key) && (last.ox !== frame.ox || last.oy !== frame.oy);
  drawnLast = { key, ox: frame.ox, oy: frame.oy };
  if (!panned) {
    full();
    return;
  }
  const mx = PLATE_MARGIN_X * frame.density;
  const my = PLATE_MARGIN_Y * frame.density;
  const width = frame.width + 2 * mx;
  const height = frame.height + 2 * my;
  const fresh: Plate =
    plate?.width === width && plate.height === height
      ? plate
      : {
          key,
          ox: 0,
          oy: 0,
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
          depth: new Int16Array(width * height),
        };
  fresh.key = key;
  fresh.ox = frame.ox - mx;
  fresh.oy = frame.oy - my;
  const big: Frame = {
    ...frame,
    data: fresh.data,
    depth: fresh.depth,
    width,
    height,
    ox: fresh.ox,
    oy: fresh.oy,
    vx: new Float64Array(width),
    vy: new Float64Array(height),
  };
  drawGround(big, scene, layer);
  drawRivers(big, scene, layer);
  plate = fresh;
  crop(fresh, frame);
}

interface Standing {
  readonly x: number;
  readonly y: number;
  readonly row: number;
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
  const metres = altitudeAt(layer, fieldsOf(layer, scene), x, y);
  return {
    x: Math.floor(x * s) - frame.ox / density,
    y: Math.floor((y * s) / 2 - (metres * s) / RISE_METRES_PER_KM) - frame.oy / density,
    row: (y * frame.scale) / 2 - frame.oy,
  };
}

/** The neon colour of each source (D-084, proposed): its signature hue, brighter. */
export const NEON_SOURCES: Readonly<Record<Source, Rgb>> = {
  nuclear: hex("#ffe14a"),
  hydro: hex("#3d8bff"),
  wind: hex("#3ff5d8"),
  solar: hex("#ff9a2e"),
  thermal: hex("#ff5470"),
  bioenergy: hex("#8dff5a"),
};

/** The landmarks' one colour. */
export const NEON_LANDMARK = hex("#d6b8ff");

/** How bright a plant is with no figure, or at rest: dim, never dark. */
export const NEON_PLANT_FLOOR = 0.35;

/**
 * A plant's colour: its source's, as bright as its activity, the load factor of its
 * technology in its region (ARCHITECTURE § Data-to-scene mapping): from
 * `NEON_PLANT_FLOOR` at 0 to full at 1. With no figure (`null`, or not a number),
 * the floor: a missing figure never reads as a stop, nor as a run.
 */
export function neonPlantColour(source: Source, activity: number | null): Rgb {
  const c = NEON_SOURCES[source];
  const a = activity === null || !Number.isFinite(activity) ? 0 : clamp01(activity);
  const k = NEON_PLANT_FLOOR + (1 - NEON_PLANT_FLOOR) * a;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** What the neon brush draws with, and in which colour what stands next is drawn. */
export interface NeonTools extends Brush {
  /** What is drawn next stands there, in that colour: the relief in front hides it. */
  stand(on: Standing, colour: Rgb): void;
  /** The boxes drawn in so far, one for each thing that stood, in the pixels drawn. */
  touched(): readonly Rect[];
}

/** The halo's reach around a shape's edge, in scene pixels. */
const HALO = 1.2;
/** The outline's half-width, in scene pixels. */
const STROKE = 0.28;

/**
 * The neon brush (B-042): a shape is drawn as its outline of light, in the colour
 * of what stands, with a halo outside and inside, from the same distance to its
 * edge as the modern brush fills it with (./art/shapes.ts); the light is added to
 * the pixels under it. A lamp (an unlit warm fill) is drawn solid, as it is. A
 * shadow (a dark spot) is left out: a line of light casts none. A soft spot, a
 * plume's puff, is a faint glow of the colour. Hidden where the relief in front
 * covers what stands, as in the modern theme.
 *
 * They draw into `target`: the frame's own pixels, or finer ones (the frame then
 * still says what the relief hides).
 */
export function neonToolsOf(frame: Frame, emissive: boolean, target: Surface): NeonTools {
  const { depth } = frame;
  const { data, width, height } = target;
  const density = (width * frame.density) / frame.width;
  const back = frame.density / density;
  const columns = frame.width;
  const column = new Int32Array(width);
  for (let px = 0; px < width; px++) column[px] = Math.floor(px * back);
  const rowOf = new Int32Array(height);
  for (let py = 0; py < height; py++) rowOf[py] = Math.floor(py * back);
  let limit = 0;
  let tint: Rgb = NEON_LANDMARK;
  const touched: { left: number; top: number; right: number; bottom: number }[] = [];
  let current: { left: number; top: number; right: number; bottom: number } | null = null;
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
  const add = (p: number, k: number, c: Rgb): void => {
    const i = p * 4;
    data[i] = (data[i] ?? 0) + c[0] * k;
    data[i + 1] = (data[i + 1] ?? 0) + c[1] * k;
    data[i + 2] = (data[i + 2] ?? 0) + c[2] * k;
  };
  const hidden = (px: number, py: number): boolean =>
    (depth[(rowOf[py] ?? 0) * columns + (column[px] ?? 0)] ?? 0) > limit;
  return {
    emissive,
    stand(on, colour) {
      // Two scene pixels of slack: its foot stands on the ground, not behind it.
      limit = on.row + 2 * frame.density;
      current = null;
      tint = colour;
    },
    touched: () => touched,
    spot(cx, cy, rx, ry, colour, alpha, unlit = false) {
      if (!(rx > 0) || !(ry > 0)) return;
      if (colour[0] + colour[1] + colour[2] < 60) return;
      const c = unlit ? colour : mixRgb(tint, STAR, 0.3);
      const k0 = unlit ? alpha : alpha * 0.35;
      const x0 = Math.max(0, Math.floor((cx - rx) * density));
      const x1 = Math.min(width, Math.ceil((cx + rx) * density));
      const y0 = Math.max(0, Math.floor((cy - ry) * density));
      const y1 = Math.min(height, Math.ceil((cy + ry) * density));
      touch(x0, y0, x1, y1);
      for (let py = y0; py < y1; py++) {
        const dy = ((py + 0.5) / density - cy) / ry;
        for (let px = x0; px < x1; px++) {
          const dx = ((px + 0.5) / density - cx) / rx;
          const a = (1 - dx * dx - dy * dy) * k0;
          if (!(a > 0) || hidden(px, py)) continue;
          add(py * width + px, a, c);
        }
      }
    },
    fill(left, top, right, bottom, distance, colour, ink, span) {
      // A see-through fill, a shade under something, is left out.
      if (ink?.alpha !== undefined && ink.alpha < 0.5) return;
      const lamp = ink?.unlit === true && colour[0] > 200 && colour[1] > 150;
      const c = lamp ? colour : tint;
      const x0 = Math.max(0, Math.floor((left - HALO) * density));
      const x1 = Math.min(width, Math.ceil((right + HALO) * density));
      const y0 = Math.max(0, Math.floor((top - HALO) * density));
      const y1 = Math.min(height, Math.ceil((bottom + HALO) * density));
      touch(x0, y0, x1, y1);
      for (let py = y0; py < y1; py++) {
        const y = (py + 0.5) / density;
        const [from, to] = span === undefined ? [-Infinity, Infinity] : span(y);
        const xa = Math.max(x0, Math.floor((from - HALO) * density));
        const xb = Math.min(x1, Math.ceil((to + HALO) * density));
        for (let px = xa; px < xb; px++) {
          const x = (px + 0.5) / density;
          const d = distance(x, y);
          if (d > HALO || hidden(px, py)) continue;
          let k: number;
          if (lamp) {
            const q = d > 0 ? d / (HALO * 0.5) : 0;
            k = clamp01(0.5 - d * density) * 0.85 + (d > 0 ? 0.35 / (1 + 4 * q * q) : 0);
          } else {
            const e = d < 0 ? -d : d;
            const q = e / (HALO * 0.4);
            k = clamp01(STROKE * density + 0.5 - e * density) + 0.3 / (1 + 4 * q * q);
          }
          if (k > 0.004) add(py * width + px, k, c);
        }
      }
    },
  };
}

/** The buffers of the frame drawn last, reused while the size stays the same. */
let depths: [Int16Array, Int16Array] | null = null;
let spare: Uint8ClampedArray | null = null;
let mapBuffer: Uint8ClampedArray | null = null;

/**
 * Draws a scene in the neon theme: the 4 km layer, the 1 km one or a blend of both,
 * the sky, the weather, then the landmarks and the plants. `out` is the scene's
 * size times a whole number; at the sharp density the map is drawn at half of it
 * and spread (D-058), as in the modern theme.
 */
export function drawNeonScene(scene: Scene, out: Surface): Drawn {
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
  if (density !== sharp && mapBuffer?.length !== pixels * 4)
    mapBuffer = new Uint8ClampedArray(pixels * 4);
  const map = density === sharp || mapBuffer === null ? out.data : mapBuffer;
  if (depths?.[0].length !== pixels) depths = [new Int16Array(pixels), new Int16Array(pixels)];
  const detail = scene.fine === null ? 0 : Math.min(DITHER_LEVELS, Math.max(0, scene.detail));
  let layer = scene.coarse;
  let frame = frameOf(scene, map, depths[0], density);
  if (!(detail > 0) || scene.fine === null) {
    groundOf(frame, scene, layer, true);
    drawSky(frame);
  } else if (detail >= DITHER_LEVELS) {
    layer = scene.fine;
    groundOf(frame, scene, layer, true);
    drawSky(frame);
  } else {
    // Between the two layers: both drawn in full, and blended. What stands on the
    // ground stands once, on the layer that shows the most.
    groundOf(frame, scene, scene.coarse, false);
    drawSky(frame);
    if (spare?.length !== map.length) spare = new Uint8ClampedArray(map.length);
    const detailed = frameOf(scene, spare, depths[1], density);
    groundOf(detailed, scene, scene.fine, false);
    drawSky(detailed);
    const share = detail / DITHER_LEVELS;
    for (let i = 0; i < map.length; i++)
      map[i] = (map[i] ?? 0) + ((spare[i] ?? 0) - (map[i] ?? 0)) * share;
    if (detail * 2 >= DITHER_LEVELS) {
      layer = scene.fine;
      frame = { ...detailed, data: map };
    }
  }
  if (map !== out.data) spread(map, scene.width * density, scene.height * density, out);

  // The weather (B-018), as lines of light (B-043).
  const grid = scene.weatherHidden === true ? null : weatherGrid(scene.coarse, scene.weather);
  const weather =
    grid === null
      ? null
      : {
          grid,
          mask: cloudMask(grid, scene.camera, scene.width, scene.height, sharp, scene.timeMs),
        };
  if (weather !== null) drawNeonWeather(scene, weather.grid, weather.mask, out);
  const falling =
    weather !== null &&
    anyPrecipitation(weather.grid, viewBox(scene.camera, scene.width, scene.height));

  // The plants and the landmarks: the modern theme's drawings, as lines of light.
  const size: SpriteSize = scene.camera.scale >= SPRITES_FROM_SCALE ? "full" : "marker";
  const pen = neonToolsOf(frame, scene.light.emissive, out);
  const landmarks: (Standing & { readonly landmark: Landmark })[] =
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
    pen.stand(m, NEON_LANDMARK);
    drawModernLandmark(pen, m.landmark, landmarkBox(m.landmark, m.x, m.y).left, m.y);
  }
  const plants: (Standing & { readonly plant: ScenePlant })[] = visiblePlants(
    scene,
    frame.ox / density,
    scene.width,
  )
    .map((plant) => ({ plant, ...standingAt(frame, scene, layer, plant.site.x, plant.site.y) }))
    .sort((a, b) => a.row - b.row || a.x - b.x);
  for (const p of plants) {
    pen.stand(p, neonPlantColour(p.plant.site.source, p.plant.activity));
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
    moving: moving.length > 0 || falling,
    marks,
    animate(target: Surface, seconds: number): readonly Rect[] {
      if (target.width !== out.width || target.height !== out.height) return [];
      const motion = neonToolsOf(frame, scene.light.emissive, target);
      for (const p of moving) {
        motion.stand(p, neonPlantColour(p.plant.site.source, p.plant.activity));
        drawModernMotion(motion, p.plant.site, p.plant.activity, p.x, p.y, size, seconds);
      }
      if (!falling) return motion.touched();
      animateNeonWeather(scene, weather.grid, weather.mask, target, seconds);
      return [{ left: 0, top: 0, right: target.width, bottom: target.height }];
    },
  };
}

export const neonTheme: Theme = {
  id: "neon",
  density: modernDensity,
  draw: drawNeonScene,
};
