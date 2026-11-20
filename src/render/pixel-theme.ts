/**
 * The pixel-art theme (ARCHITECTURE § Art direction): the scene drawn as a relief
 * diorama in the palette, under a light, with 2:1 tiles, north up, seen from the
 * south (D-017). It grew out of the B-010 mockups and draws the same way.
 *
 * Any scale is drawn crisp: a cell spans the pixels between floor(edge × scale) of
 * its two edges, so tiles differ by at most one pixel while the zoom moves, and every
 * pixel is one palette colour. The camera is rounded to whole pixels and every
 * pattern (dithering, lamps) is anchored to the ground, not to the screen, so a pan
 * moves the picture without a shimmer (D-020). Pure: additions, multiplications and
 * floors decide every pixel; the light comes in as numbers.
 */
import { ELEVATION_CLASSES, FOREIGN, KIND_COUNT, kindOfRegion, SEA } from "../map/grid.ts";
import { type TerrainLayer } from "../map/layers.ts";
import { RISE_METRES_PER_KM } from "../scene/camera.ts";
import { type RegionCode } from "../data/eco2mix.ts";
import { type PlantSite } from "../map/plants.ts";
import { type Scene, type ScenePlant, type Town, townCellCount } from "../scene/scene.ts";
import { skyColour, tinted } from "../sky/light.ts";
import { drawLandmark, landmarkBox } from "./art/landmarks.ts";
import {
  drawBody,
  drawMotion,
  hasMotion,
  type Pen,
  plantBox,
  type SpriteSize,
} from "./art/plants.ts";
import { type Landmark } from "../map/landmarks.ts";
import { isDiffuse } from "../map/sources.ts";
import { BAYER_4, DITHER_LEVELS } from "./dither.ts";
import { COLOUR_NAMES, type ColourName, darken, DARKER, PALETTE, type Rgb } from "./palette.ts";
import { createSurface, type Surface } from "./surface.ts";
import type { Drawn, Mark, Theme } from "./theme.ts";
import {
  anyPrecipitation,
  fogAt,
  viewBox,
  type WeatherGrid,
  weatherAt,
  weatherGrid,
} from "../scene/clouds.ts";
import { type WeatherGroup } from "../data/open-meteo.ts";
import { type Season, seasonOf } from "../scene/season.ts";
import { type CloudMask, cloudMask, cloudPart, eachDrop, lightning } from "./weather-art.ts";

/** Whether this engine stores a Uint32 with its low byte first (every common one does). */
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** A palette colour as the 32-bit word an opaque RGBA pixel is in memory. */
function pack([r, g, b]: Rgb): number {
  return LITTLE_ENDIAN
    ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

const PACKED = Object.fromEntries(COLOUR_NAMES.map((n) => [n, pack(PALETTE[n])])) as Record<
  ColourName,
  number
>;

/** The three green bands of a season, low (below 300 m) to high (800 to 1 300 m). */
const BANDS: Readonly<Record<Season, readonly [ColourName, ColourName, ColourName]>> = {
  winter: ["dull", "grass", "forest"],
  spring: ["fresh", "meadow", "grass"],
  summer: ["meadow", "grass", "forest"],
  autumn: ["meadow", "grass", "forest"],
};

/**
 * Ground colour of a land cell: one flat colour per altitude band, like the tints of
 * a relief map, so the land reads as a few calm shapes; the bands below the rock
 * change with the season (B-022).
 */
export function groundColour(elevation: number, season: Season = "summer"): ColourName {
  if (elevation >= 12) return "snow"; // 2 400 m and up
  if (elevation >= 9) return "rock"; // 1 300 m
  const [low, mid, high] = BANDS[season];
  if (elevation >= 7) return high; // 800 m
  if (elevation >= 4) return mid; // 300 m
  return low;
}

/**
 * The small marks a season scatters on a ground colour (B-022, Q-44): one pixel in
 * `every`, by a hash of the ground pixel, so they stay put while the camera moves.
 * Frost in winter, blossom in spring, ripe crops in summer, ploughed soil and
 * turning leaves in autumn.
 */
export const SEASON_DOTS: Readonly<
  Record<Season, Partial<Record<ColourName, readonly (readonly [ColourName, number])[]>>>
> = {
  winter: { dull: [["frost", 9]], grass: [["frost", 23]] },
  spring: { fresh: [["blossom", 13]], meadow: [["blossom", 19]] },
  summer: { meadow: [["field", 3]], grass: [["meadow", 7]] },
  autumn: {
    meadow: [
      ["soil", 4],
      ["field", 9],
    ],
    grass: [
      ["leafGold", 4],
      ["leafRust", 7],
    ],
    forest: [["leafRust", 13]],
  },
};

/** Sea colour: three flat bands by distance from the coast, in kilometres. */
export function seaColour(km: number): "seaShallow" | "sea" | "seaDeep" {
  if (km <= 4) return "seaShallow";
  if (km <= 20) return "sea";
  return "seaDeep";
}

/** Lower bound in metres of an elevation class. */
function metres(elevation: number): number {
  return ELEVATION_CLASSES[elevation] ?? 0;
}

/** Relief height in pixels of a cell at a scale (pixels per km): plains flat, mountains rising. */
export function heightPx(elevation: number, scale: number): number {
  return Math.floor((metres(elevation) * scale) / RISE_METRES_PER_KM);
}

/** A small integer hash of a pixel, for seeded scatter (no Math.random). */
function pixelHash(x: number, y: number): number {
  let h = Math.imul(y, 0x27d4eb2d) ^ Math.imul(x, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/** A frame being drawn: its pixels as words, and the ground's offset in pixels. */
interface Frame {
  readonly words: Uint32Array;
  readonly width: number;
  readonly height: number;
  /** Ground pixel (ox, oy) is at the buffer's top-left corner. */
  readonly ox: number;
  readonly oy: number;
  /** 4 × 4 colour patterns already worked out for this frame, by colour and darkness. */
  readonly patterns: Map<string, Uint32Array>;
}

/**
 * A colour under a darkness as a 4 × 4 pattern of pixel words, indexed
 * [(y & 3) × 4 + (x & 3)]: `tinted` depends on x and y only through those, so the
 * pattern draws exactly what `tinted` would, pixel by pixel, at a fraction of the cost.
 */
export function tintPattern(colour: ColourName, darkness: number): Uint32Array {
  const p = new Uint32Array(16);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) p[y * 4 + x] = PACKED[tinted(colour, darkness, x, y)];
  return p;
}

/** A frame's patterns, worked out once per colour and darkness. */
function pattern(frame: Frame, colour: ColourName, darkness: number): Uint32Array {
  const key = `${colour}|${String(darkness)}`;
  let p = frame.patterns.get(key);
  if (p === undefined) {
    p = tintPattern(colour, darkness);
    frame.patterns.set(key, p);
  }
  return p;
}

/** Fills [x0, x1) × [y0, y1) of the buffer with a pattern anchored to the ground. */
function fill(frame: Frame, x0: number, y0: number, x1: number, y1: number, p: Uint32Array): void {
  const left = Math.max(0, x0);
  const right = Math.min(frame.width, x1);
  const top = Math.max(0, y0);
  const bottom = Math.min(frame.height, y1);
  if (left >= right || top >= bottom) return;
  const { words, width, ox, oy } = frame;
  for (let y = top; y < bottom; y++) {
    const row = ((y + oy) & 3) * 4;
    let i = y * width + left;
    for (let x = left; x < right; x++) words[i++] = p[row + ((x + ox) & 3)] ?? 0;
  }
}

/**
 * Fills like `fill`, with a season's marks scattered over it: a ground pixel takes
 * the first mark whose `every` divides its hash.
 */
function fillDotted(
  frame: Frame,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  p: Uint32Array,
  dots: readonly (readonly [Uint32Array, number])[],
): void {
  const left = Math.max(0, x0);
  const right = Math.min(frame.width, x1);
  const top = Math.max(0, y0);
  const bottom = Math.min(frame.height, y1);
  if (left >= right || top >= bottom) return;
  const { words, width, ox, oy } = frame;
  // At most two marks per band (SEASON_DOTS): unrolled, as this runs for every
  // pixel of the land.
  const [m0, e0] = dots[0] ?? [p, 0];
  const [m1, e1] = dots[1] ?? [p, 0];
  for (let y = top; y < bottom; y++) {
    const gy = y + oy;
    const row = (gy & 3) * 4;
    let i = y * width + left;
    for (let x = left; x < right; x++) {
      const gx = x + ox;
      const h = pixelHash(gx, gy);
      const k = row + (gx & 3);
      words[i++] = (e0 > 0 && h % e0 === 0 ? m0[k] : e1 > 0 && h % e1 === 0 ? m1[k] : p[k]) ?? 0;
    }
  }
}

/** A pen on a frame: palette colours under the light, anchored to the ground; lamps untinted. */
function penOf(frame: Frame, darkness: number, emissive: boolean): Pen {
  const { words, width, height, ox, oy } = frame;
  return {
    emissive,
    put(x, y, colour) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const p = pattern(frame, colour, darkness);
      words[y * width + x] = p[((y + oy) & 3) * 4 + ((x + ox) & 3)] ?? 0;
    },
    glow(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      words[y * width + x] = PACKED.lamp;
    },
  };
}

/** Full sprites from this scale (pixels per km); below, the national view's markers. */
export const SPRITES_FROM_SCALE = 0.7;

/**
 * The smallest plant shown at a scale, MW: on the national view the giants only
 * (nuclear sites, the largest dams), then the large plants, then every baked site.
 * A site of a diffuse source on land shows whatever its size once the sprites are
 * drawn: how many a region has already tells its capacity (D-041).
 */
export function minPlantMw(scale: number): number {
  if (scale < SPRITES_FROM_SCALE) return 1000;
  if (scale < 1.2) return 50;
  return 0;
}

/** Two plants closer than this, in pixels, would overlap: the smaller is left out. */
const SPRITE_SPACING: Readonly<Record<SpriteSize, number>> = { full: 8, marker: 4 };

/** A plant placed on the frame: its anchor in buffer pixels. */
export interface PlacedPlant {
  readonly plant: ScenePlant;
  readonly x: number;
  readonly y: number;
}

/** A landmark placed on the frame: its anchor in buffer pixels. */
interface PlacedLandmark {
  readonly landmark: Landmark;
  readonly x: number;
  readonly y: number;
}

/** What a layer placed: the plants and the landmarks, to draw again over a crossfade. */
interface Placed {
  readonly plants: PlacedPlant[];
  readonly landmarks: PlacedLandmark[];
}

/**
 * The plants a frame shows, largest first: big enough for the scale, inside the
 * buffer's width, and not on top of a larger one. Pure and cheap (a few hundred
 * sites): worked out per frame.
 */
export function visiblePlants(scene: Scene, ox: number, width: number): ScenePlant[] {
  const s = scene.camera.scale;
  const size: SpriteSize = s >= SPRITES_FROM_SCALE ? "full" : "marker";
  const spacing = SPRITE_SPACING[size];
  const min = minPlantMw(s);
  const kept: { plant: ScenePlant; x: number; y: number }[] = [];
  const sorted = scene.plants
    .filter((p) =>
      isDiffuse(p.site.source) && !p.site.offshore ? size === "full" : p.site.mw >= min,
    )
    .sort((a, b) => b.site.mw - a.site.mw || a.site.x - b.site.x || a.site.y - b.site.y);
  for (const plant of sorted) {
    const x = Math.floor(plant.site.x * s) - ox;
    const y = Math.floor((plant.site.y * s) / 2);
    if (x < -16 || x > width + 16) continue;
    if (kept.some((k) => Math.abs(k.x - x) < spacing && Math.abs(k.y - y) < spacing / 2)) continue;
    kept.push({ plant, x, y });
  }
  return kept.map((k) => k.plant);
}

/** The sky's gradient, zenith to horizon, over the whole buffer (anchored to the screen). */
function drawSky(frame: Frame, scene: Scene): void {
  const { words, width, height } = frame;
  for (let y = 0; y < height; y++) {
    const level =
      height > 1 ? Math.floor((2 * y * DITHER_LEVELS + (height - 1)) / (2 * (height - 1))) : 0;
    const phase = [0, 1, 2, 3].map((x) => PACKED[skyColour(scene.light, level, x, y)]);
    for (let x = 0; x < width; x++) words[y * width + x] = phase[x & 3] ?? 0;
  }
}

/** What the theme works out once per layer and town list. */
interface LayerIndex {
  readonly towns: readonly Town[];
  /** One byte per cell: `townCells`. */
  readonly cells: Uint8Array;
  /**
   * One byte per row: whether it holds a town or a river (B-023), which show even on
   * a row flatter than a pixel.
   */
  readonly markedRows: Uint8Array;
  /** One byte per row: its highest elevation class. */
  readonly highest: Uint8Array;
}

const indexCache = new WeakMap<TerrainLayer, LayerIndex>();

function layerIndex(layer: TerrainLayer, towns: readonly Town[]): LayerIndex {
  const known = indexCache.get(layer);
  if (known?.towns === towns) return known;
  const cells = townCells(layer, towns);
  const markedRows = new Uint8Array(layer.rows);
  const highest = new Uint8Array(layer.rows);
  for (let i = 0; i < cells.length; i++) {
    const r = Math.floor(i / layer.columns);
    if (cells[i] !== 0 || layer.rivers[i] === 1) markedRows[r] = 1;
    highest[r] = Math.max(highest[r] ?? 0, layer.elevation[i] ?? 0);
  }
  const index = { towns, cells, markedRows, highest };
  indexCache.set(layer, index);
  return index;
}

/** Cell offsets around a centre, nearest first (then north first, then west first). */
let spiral: Int16Array | null = null;
const SPIRAL_REACH = 24;
function spiralOffsets(): Int16Array {
  if (spiral !== null) return spiral;
  const offsets: [number, number][] = [];
  for (let dr = -SPIRAL_REACH; dr <= SPIRAL_REACH; dr++)
    for (let dc = -SPIRAL_REACH; dc <= SPIRAL_REACH; dc++) offsets.push([dr, dc]);
  offsets.sort(
    ([ar, ac], [br, bc]) => ar * ar + ac * ac - (br * br + bc * bc) || ar - br || ac - bc,
  );
  spiral = Int16Array.from(offsets.flat());
  return spiral;
}

/** A cell value of `townCells`: a cell of a town. */
export const TOWN_CELL = 1;
/** A cell value of `townCells`: the cell of a town's chef-lieu. */
export const TOWN_CENTRE = 2;

/**
 * The towns of a layer, one byte per cell: 0 none, TOWN_CELL, or TOWN_CENTRE. A town
 * covers `townCellCount` cells of French land, the nearest to its chef-lieu first, so
 * a town on the coast spreads along it, not into the sea; neighbouring towns merge.
 * A chef-lieu whose cell is not French land (Bastia, on the coast) moves to the first
 * French land cell around it within 8 km, so no town floats on the water.
 */
export function townCells(layer: TerrainLayer, towns: readonly Town[]): Uint8Array {
  const found = new Uint8Array(layer.kinds.length);
  const land = (r: number, c: number): boolean => {
    if (r < 0 || c < 0 || r >= layer.rows || c >= layer.columns) return false;
    const k = layer.kinds[r * layer.columns + c] ?? SEA;
    return k !== SEA && k !== FOREIGN;
  };
  const offsets = spiralOffsets();
  const reach = Math.round(8 / layer.km);
  for (const town of towns) {
    const n = townCellCount(town, layer.km);
    if (n === 0) continue;
    const r = Math.floor(town.y / layer.km);
    const c = Math.floor(town.x / layer.km);
    let centre = -1;
    for (let k = 0; k < offsets.length && centre === -1; k += 2) {
      const dr = offsets[k] ?? 0;
      const dc = offsets[k + 1] ?? 0;
      if (Math.max(Math.abs(dr), Math.abs(dc)) > reach) continue;
      if (land(r + dr, c + dc)) centre = (r + dr) * layer.columns + c + dc;
    }
    if (centre === -1) continue;
    const cr = Math.floor(centre / layer.columns);
    const ccol = centre % layer.columns;
    found[centre] = TOWN_CENTRE;
    let covered = 1;
    for (let k = 2; k < offsets.length && covered < n; k += 2) {
      const rr = cr + (offsets[k] ?? 0);
      const cc = ccol + (offsets[k + 1] ?? 0);
      if (!land(rr, cc)) continue;
      const i = rr * layer.columns + cc;
      if (found[i] === 0) found[i] = TOWN_CELL;
      covered++;
    }
  }
  return found;
}

/** Shading and veil of a land cell, as an index into its four tints. */
const LIT = 0;
const SHADED = 1;
const VEILED = 2;

/**
 * The tints of a frame, worked out once: for each elevation class and each of the
 * four ways a land cell can be lit (lit or shaded, veiled or not), its top and south
 * faces; and the sea's three bands.
 */
interface SeasonTints {
  readonly top: Uint32Array[];
  readonly side: Uint32Array[];
  /** The marks scattered on each top face: a pattern and how sparse it is. */
  readonly dots: (readonly (readonly [Uint32Array, number])[])[];
}

interface Tints {
  /** The land in the season it turns from, and in the one it turns to. */
  readonly from: SeasonTints;
  readonly to: SeasonTints;
  readonly sea: Record<"seaShallow" | "sea" | "seaDeep", Uint32Array>;
  readonly roof: Uint32Array;
  /** A river: the shallow sea's blue; one step back where the land is veiled. */
  readonly river: Uint32Array;
  readonly riverVeiled: Uint32Array;
}

function tintsOf(frame: Frame, scene: Scene): Tints {
  const base = scene.light.darkness;
  // Abroad, and outside the region on a region view, the land recedes one step by
  // day. The veil fades as night falls, or the land around would darken into the
  // sea's blues and read as sea; at night the lamps set France apart.
  const veil = Math.max(0, 1 - base / 2);
  const darkness = [base, base + 1, base + veil, base + 1 + veil];
  const land = (season: Season): SeasonTints => {
    const top: Uint32Array[] = [];
    const side: Uint32Array[] = [];
    const dots: (readonly (readonly [Uint32Array, number])[])[] = [];
    for (let e = 0; e < ELEVATION_CLASSES.length; e++) {
      const ground = groundColour(e, season);
      const marks = SEASON_DOTS[season][ground] ?? [];
      for (let k = 0; k < 4; k++) {
        const d = darkness[k] ?? base;
        top.push(pattern(frame, ground, d));
        // The south face, one step darker than the top.
        side.push(pattern(frame, darken(ground, 1), d));
        // The land veiled around the region keeps calm: no marks there.
        dots.push(
          k >= VEILED
            ? []
            : marks.map(([colour, every]) => [pattern(frame, colour, d), every] as const),
        );
      }
    }
    return { top, side, dots };
  };
  const from = land(scene.season.from);
  return {
    from,
    to: scene.season.to === scene.season.from ? from : land(scene.season.to),
    sea: {
      seaShallow: pattern(frame, "seaShallow", base),
      sea: pattern(frame, "sea", base),
      seaDeep: pattern(frame, "seaDeep", base),
    },
    roof: pattern(frame, "roof", base),
    river: pattern(frame, "seaShallow", base),
    riverVeiled: pattern(frame, "seaShallow", base + veil),
  };
}

/** The fewest lamps a lit town shows, of 16 pixels: at the bottom of its range. */
export const LAMPS_FLOOR = 4;

/**
 * Lamps lit per 16 town pixels, by cell kind: LAMPS_FLOOR at the bottom of the
 * region's range of consumption to all 16 at the top; −1 for a region without a
 * figure, whose towns show their roofs, unlit.
 */
export function lampLevels(scene: Pick<Scene, "townLights">): Int8Array {
  const levels = new Int8Array(KIND_COUNT).fill(-1);
  for (const [region, light] of Object.entries(scene.townLights))
    if (Number.isFinite(light))
      levels[kindOfRegion(region as RegionCode)] =
        LAMPS_FLOOR + Math.round((DITHER_LEVELS - LAMPS_FLOOR) * Math.min(1, Math.max(0, light)));
  return levels;
}

/**
 * Draws the sky, then one terrain layer, back (north) to front (south). Past the
 * grid's west, east and south edges the edge cells go on (the Atlantic, the
 * neighbours' land, the Mediterranean), so a wide view never shows the board's edge;
 * north of the grid is the sky.
 */
function drawLayer(frame: Frame, scene: Scene, layer: TerrainLayer, bodies: boolean): Placed {
  drawSky(frame, scene);
  const { light, camera } = scene;
  const s = camera.scale;
  const { km, columns, rows, kinds, elevation, seaDistance } = layer;
  const { width, height, ox, oy } = frame;
  const cellW = km * s;
  const cellH = cellW / 2;
  const rise = heightPx(ELEVATION_CLASSES.length - 1, s) + Math.ceil(cellH);
  const c0 = Math.floor(ox / cellW) - 1;
  const c1 = Math.ceil((ox + width) / cellW) + 1;
  const r0 = Math.max(0, Math.floor(oy / cellH) - 1);
  const r1 = Math.ceil((oy + height + rise) / cellH) + 1;
  if (c0 > c1 || r0 > r1) return { plants: [], landmarks: [] };
  // Pixel edges of the visible columns: floor(edge × scale), shifted by the offset.
  const xs = new Int32Array(c1 - c0 + 2);
  for (let c = c0; c <= c1 + 1; c++) xs[c - c0] = Math.floor(c * cellW) - ox;
  // Relief height of each class at this scale.
  const hs = ELEVATION_CLASSES.map((_, e) => heightPx(e, s));
  const tints = tintsOf(frame, scene);
  const focus = scene.focus === null ? -1 : kindOfRegion(scene.focus);
  const { cells: towns, markedRows, highest } = layerIndex(layer, scene.towns);
  const { rivers } = layer;
  const lamps = lampLevels(scene);
  // Hill shading compares a cell with the one 4 km to its north-west, on both layers,
  // so the 1 km layer shades whole slopes, not every bump.
  const reach = Math.max(1, Math.round(4 / km));
  // Towns wait for the end of their row, and a flat row's towns for the next row
  // drawn: a town then shows whatever the zoom, on top of the ground around it, and
  // the relief of the rows in front (south) still hides it.
  const pending: number[] = [];
  // River cells wait with them (x, y, width, height, veiled), and are drawn first.
  const water: number[] = [];
  // Plants wait for the end of their row too, so the relief in front hides their foot.
  const size: SpriteSize = s >= SPRITES_FROM_SCALE ? "full" : "marker";
  const pen = penOf(frame, light.darkness, light.emissive);
  const queue = visiblePlants(scene, ox, width)
    .map((plant) => ({
      plant,
      row: Math.floor(plant.site.y / km),
      column: Math.floor(plant.site.x / km),
    }))
    .sort((a, b) => a.row - b.row || a.column - b.column);
  let next = 0;
  const placed: PlacedPlant[] = [];
  // Landmarks, at full sprite size only, in the same painter's order.
  const marks =
    size === "full"
      ? scene.landmarks
          .map((landmark) => ({
            landmark,
            row: Math.floor(landmark.y / km),
            column: Math.floor(landmark.x / km),
            x: Math.floor(landmark.x * s) - ox,
          }))
          .filter((m) => m.x > -24 && m.x < width + 24)
          .sort((a, b) => a.row - b.row || a.column - b.column)
      : [];
  let nextMark = 0;
  const placedMarks: PlacedLandmark[] = [];
  const drawPlants = (before: number): void => {
    for (; nextMark < marks.length && (marks[nextMark]?.row ?? 0) < before; nextMark++) {
      const m = marks[nextMark];
      if (m === undefined) continue;
      const rr = Math.min(Math.max(m.row, 0), rows - 1);
      const cc = Math.min(Math.max(m.column, 0), columns - 1);
      const i = rr * columns + cc;
      const kind = kinds[i] ?? SEA;
      const h = kind === SEA || kind === FOREIGN ? 0 : (hs[elevation[i] ?? 0] ?? 0);
      const y = Math.floor((m.row + 0.5) * cellH) - oy - h;
      if (bodies) drawLandmark(pen, m.landmark, m.x, y);
      placedMarks.push({ landmark: m.landmark, x: m.x, y });
    }
    for (; next < queue.length && (queue[next]?.row ?? 0) < before; next++) {
      const q = queue[next];
      if (q === undefined) continue;
      const rr = Math.min(Math.max(q.row, 0), rows - 1);
      const cc = Math.min(Math.max(q.column, 0), columns - 1);
      const i = rr * columns + cc;
      const kind = kinds[i] ?? SEA;
      const h = kind === SEA || kind === FOREIGN ? 0 : (hs[elevation[i] ?? 0] ?? 0);
      const x = Math.floor(q.plant.site.x * s) - ox;
      const y = Math.floor((q.row + 0.5) * cellH) - oy - h;
      if (bodies) drawBody(pen, q.plant.site, q.plant.activity, x, y, size);
      placed.push({ plant: q.plant, x, y });
    }
  };
  const drawTowns = (): void => {
    // The rivers first: where cells share a pixel (France seen whole), a town's roof
    // or lamp shows over the water beside it. Water, by day and by night: it lights
    // nothing.
    for (let k = 0; k < water.length; k += 5) {
      const cx = water[k] ?? 0;
      const cy = water[k + 1] ?? 0;
      fill(
        frame,
        cx,
        cy,
        cx + (water[k + 2] ?? 1),
        cy + (water[k + 3] ?? 1),
        water[k + 4] === 0 ? tints.river : tints.riverVeiled,
      );
    }
    water.length = 0;
    for (let k = 0; k < pending.length; k += 6) {
      const cx = pending[k] ?? 0;
      const cy = pending[k + 1] ?? 0;
      const w = pending[k + 2] ?? 1;
      const hgt = pending[k + 3] ?? 1;
      const level = pending[k + 4] ?? -1;
      const centre = pending[k + 5] === 1;
      for (let y = Math.max(0, cy); y < Math.min(height, cy + hgt); y++)
        for (let x = Math.max(0, cx); x < Math.min(width, cx + w); x++) {
          const gx = x + ox;
          const gy = y + oy;
          if (light.emissive && level >= 0) {
            // Lit windows: a scatter, not a block, so a town glows like a town; the
            // more its region consumes, the more of them (ARCHITECTURE § Data-to-scene
            // mapping). The first pixel of its chef-lieu's cell is always lit, so no
            // lit town goes dark.
            if ((centre && x === cx && y === cy) || pixelHash(gx, gy) % DITHER_LEVELS < level)
              frame.words[y * width + x] = PACKED.lamp;
          } else frame.words[y * width + x] = tints.roof[(gy & 3) * 4 + (gx & 3)] ?? 0;
        }
    }
    pending.length = 0;
  };
  for (let r = r0; r <= r1; r++) {
    drawPlants(r);
    const y0 = Math.floor(r * cellH) - oy;
    const y1 = Math.floor((r + 1) * cellH) - oy;
    const rr = Math.min(r, rows - 1);
    const inGrid = r === rr;
    // A row flatter than a pixel has no top face: the next row covers its ground. It
    // is drawn only for what still shows: the south faces of its relief, its towns.
    // Skipping the rest keeps the work in step with the pixels, not the cells.
    const flat = y1 <= y0;
    if (flat && (hs[highest[rr] ?? 0] ?? 0) === 0 && !(inGrid && markedRows[rr] === 1)) continue;
    const north = Math.max(rr - reach, 0) * columns;
    const south = Math.min(rr + 1, rows - 1) * columns;
    const row = rr * columns;
    for (let c = c0; c <= c1; c++) {
      const x0 = xs[c - c0] ?? 0;
      const x1 = xs[c - c0 + 1] ?? 0;
      const cc = Math.min(Math.max(c, 0), columns - 1);
      const i = row + cc;
      const town = inGrid && c === cc ? (towns[i] ?? 0) : 0;
      // A river runs through a town, but never over the cell of its chef-lieu, whose
      // lamp always shows.
      const river = inGrid && c === cc && rivers[i] === 1 && town !== TOWN_CENTRE;
      // A column narrower than a pixel: only its town or river, if any, still shows; in
      // a flat row, only its town, its river and a relief that rises.
      if (town === 0 && !river && (x1 <= x0 || (flat && (hs[elevation[i] ?? 0] ?? 0) === 0)))
        continue;
      const kind = kinds[i] ?? SEA;
      if (kind === SEA) {
        if (flat || y0 >= height) continue;
        fill(frame, x0, y0, x1, y1, tints.sea[seaColour((seaDistance[i] ?? 255) * km)]);
        continue;
      }
      const e = kind === FOREIGN ? 0 : (elevation[i] ?? 0);
      const h = hs[e] ?? 0;
      // Wholly off the buffer. A town on a flat row still covers a pixel row: y0 - h.
      if ((town === 0 && !river ? y1 : Math.max(y1, y0 - h + 1)) <= 0 || y0 - h >= height) continue;
      // Hill shading, one light from the north-west: a cell 250 m or more below its
      // north-west neighbour faces away from it and is one step darker. Smaller drops
      // stay lit, so the plains stay calm.
      const nw = kind === FOREIGN ? 0 : (elevation[north + Math.max(cc - reach, 0)] ?? 0);
      const shade = metres(nw) - metres(e) >= 250 ? SHADED : LIT;
      // The south face is a cliff, one step darker, where the land drops by 250 m or
      // more to the cell in front, or to the sea; a gentler step keeps the ground's
      // colour, so the plains stay calm.
      const below = kinds[south + cc] ?? SEA;
      const front = below === FOREIGN ? 0 : (elevation[south + cc] ?? 0);
      const cliff = below === SEA || metres(e) - metres(front) >= 250;
      const veiled = kind === FOREIGN || (focus !== -1 && kind !== focus) ? VEILED : 0;
      const t = e * 4 + shade + veiled;
      // The season of this cell: the change spreads by patches (src/scene/season.ts).
      const land =
        seasonOf(scene.season, (c + 0.5) * km, (r + 0.5) * km) === scene.season.to
          ? tints.to
          : tints.from;
      // The south face shows below the top face: h rows.
      if (h > 0)
        fill(frame, x0, y1 - h, x1, y1, (cliff ? land.side[t] : land.top[t]) ?? tints.roof);
      const dots = land.dots[t] ?? [];
      if (dots.length === 0) fill(frame, x0, y0 - h, x1, y1 - h, land.top[t] ?? tints.roof);
      else fillDotted(frame, x0, y0 - h, x1, y1 - h, land.top[t] ?? tints.roof, dots);

      // A river or a town on this cell covers its top face, at least a pixel: water;
      // roofs by day, lamps once the sun is down.
      if (river) {
        water.push(x0, y0 - h, Math.max(1, x1 - x0), Math.max(1, y1 - y0), veiled);
        continue;
      }
      if (town === 0) continue;
      pending.push(
        x0,
        y0 - h,
        Math.max(1, x1 - x0),
        Math.max(1, y1 - y0),
        lamps[kind] ?? -1,
        town === TOWN_CENTRE ? 1 : 0,
      );
    }
    if (!flat) drawTowns();
  }
  drawTowns();
  drawPlants(Number.POSITIVE_INFINITY);
  return { plants: placed, landmarks: placedMarks };
}

/** A plant's mark: its technology and place, unique among the baked sites. */
export function plantMarkId(site: PlantSite): string {
  return `${site.source}@${String(site.x)},${String(site.y)}`;
}

/** The word of the palette colour one step darker, for every palette colour's word. */
const DARKER_WORD = new Map(COLOUR_NAMES.map((n) => [PACKED[n], PACKED[DARKER[n]]]));

/** A cloud's colours by its group (D-064): its body, its lit rim, its shaded rim. */
function cloudColours(group: WeatherGroup): {
  body: ColourName;
  lit: ColourName;
  shade: ColourName;
} {
  if (group === "storm") return { body: "cloudDark", lit: "cloud", shade: "cloudStorm" };
  if (group === "rain" || group === "drizzle" || group === "snow")
    return { body: "cloud", lit: "snow", shade: "cloudDark" };
  return { body: "snow", lit: "snow", shade: "cloud" };
}

/** Sixteenths of a cloud's body that let the map through (Q-43, D-065). */
const CLOUD_SEE_THROUGH = 4;

/**
 * The weather over a drawn frame (B-018, D-064), before what stands on the map is
 * drawn again on top: the clouds' shadows one palette step darker, an overcast or
 * stormy sky dims the land by dithering, fog banks in the low ground, then the
 * clouds, lit from the north-west. Every pixel stays a palette colour, and every
 * pattern is anchored to the ground.
 */
function drawPixelWeather(frame: Frame, scene: Scene, grid: WeatherGrid, mask: CloudMask): void {
  const { words, width, height, ox, oy } = frame;
  const s = scene.camera.scale;
  const lift = mask.lift;
  const fog = pattern(frame, "snow", scene.light.darkness);
  for (let y = 0; y < height; y++) {
    const ky = (2 * (y + oy)) / s;
    if (ky < 0) continue; // the sky above the map
    const bayer = BAYER_4[(y + oy) & 3] ?? [];
    for (let x = 0; x < width; x++) {
      const kx = (x + ox) / s;
      const i = y * width + x;
      let word = words[i] ?? 0;
      // A lit window keeps its light: it shows the consumption.
      if (word === PACKED.lamp) continue;
      const threshold = bayer[(x + ox) & 3] ?? 0;
      const sx = x - lift;
      const sy = y - lift;
      if (sx >= 0 && sy >= 0 && (mask.owner[sy * width + sx] ?? -1) >= 0)
        word = DARKER_WORD.get(word) ?? word;
      else {
        const here = weatherAt(grid, kx, ky);
        if (here !== null && here.group !== "fog") {
          // An overcast sky dims the land: up to 4 sixteenths a step, 8 in a storm.
          const dim = Math.max(0, (here.cover - 0.7) / 0.3) * (here.group === "storm" ? 8 : 4);
          if (threshold < dim) word = DARKER_WORD.get(word) ?? word;
        }
      }
      const thick = fogAt(grid, kx, ky);
      if (thick > 0.62 || (thick > 0.5 && threshold < 8))
        word = fog[((y + oy) & 3) * 4 + ((x + ox) & 3)] ?? word;
      words[i] = word;
    }
  }
  const pen = penOf(frame, scene.light.darkness, scene.light.emissive);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = mask.owner[y * width + x] ?? -1;
      const cloud = index < 0 ? undefined : mask.clouds[index];
      // Nor does a cloud hide it.
      if (cloud === undefined || words[y * width + x] === PACKED.lamp) continue;
      const part = cloudPart(mask, x, y);
      // A quarter of a cloud's body lets the map through, on a pattern anchored to the
      // ground; its rims stay whole, so its shape still reads.
      if (part === "body" && (BAYER_4[(y + oy) & 3]?.[(x + ox) & 3] ?? 0) < CLOUD_SEE_THROUGH)
        continue;
      pen.put(x, y, cloudColours(cloud.group)[part]);
    }
}

/** One spare buffer for the crossfade, reused while the size stays the same. */
let spare: Surface | null = null;

function frameOf(scene: Scene, out: Surface): Frame {
  const s = scene.camera.scale;
  return {
    words: new Uint32Array(out.data.buffer, out.data.byteOffset, out.width * out.height),
    width: out.width,
    height: out.height,
    ox: Math.round(scene.camera.x * s) - Math.floor(out.width / 2),
    oy: Math.round((scene.camera.y * s) / 2) - Math.floor(out.height / 2),
    patterns: new Map(),
  };
}

/**
 * Draws a scene: the 4 km layer, the 1 km one, or a dithered crossfade of both, with
 * the plants' still bodies. Returns what moves: the plants' motion, drawn on top of
 * a copy of this frame at any animation time.
 */
export function drawPixelScene(scene: Scene, out: Surface): Drawn {
  if (out.width !== scene.width || out.height !== scene.height)
    throw new Error("the surface does not have the scene's size");
  const frame = frameOf(scene, out);
  const detail = scene.fine === null ? 0 : Math.min(DITHER_LEVELS, Math.max(0, scene.detail));
  let shown: Placed;
  const size: SpriteSize = scene.camera.scale >= SPRITES_FROM_SCALE ? "full" : "marker";
  if (!(detail > 0) || scene.fine === null) shown = drawLayer(frame, scene, scene.coarse, true);
  else if (detail >= DITHER_LEVELS) shown = drawLayer(frame, scene, scene.fine, true);
  else {
    // The plants are not dissolved: they stand once, on the layer that shows the
    // most, drawn over the crossfade (which lasts half a second).
    const coarsePlaced = drawLayer(frame, scene, scene.coarse, false);
    if (spare?.width !== out.width || spare.height !== out.height)
      spare = createSurface(out.width, out.height);
    const detailed = frameOf(scene, spare);
    const finePlaced = drawLayer(detailed, scene, scene.fine, false);
    // The dissolve is anchored to the ground too, so it does not crawl during a pan.
    const { words, width, height, ox, oy } = frame;
    for (let y = 0; y < height; y++) {
      const bayer = BAYER_4[(y + oy) & 3] ?? [];
      for (let x = 0; x < width; x++)
        if ((bayer[(x + ox) & 3] ?? 0) < detail)
          words[y * width + x] = detailed.words[y * width + x] ?? 0;
    }
    shown = detail * 2 >= DITHER_LEVELS ? finePlaced : coarsePlaced;
    const pen = penOf(frame, scene.light.darkness, scene.light.emissive);
    for (const m of shown.landmarks) drawLandmark(pen, m.landmark, m.x, m.y);
    for (const p of shown.plants) drawBody(pen, p.plant.site, p.plant.activity, p.x, p.y, size);
  }
  // The weather (B-018), under what stands on the map: the plants and the landmarks
  // stay readable under any sky. Their pixels that showed before the weather show
  // again after it, as they were; what hid them (the relief in front, a lit window)
  // still does.
  const grid = weatherGrid(scene.coarse, scene.weather);
  const mask =
    grid === null ? null : cloudMask(grid, scene.camera, out.width, out.height, 1, scene.timeMs);
  if (grid !== null && mask !== null) {
    const before = frame.words.slice();
    drawPixelWeather(frame, scene, grid, mask);
    // The sprites alone, on an empty frame (0 is no colour: every word is opaque).
    const sprites = { ...frame, words: new Uint32Array(frame.words.length) };
    const pen = penOf(sprites, scene.light.darkness, scene.light.emissive);
    for (const m of shown.landmarks) drawLandmark(pen, m.landmark, m.x, m.y);
    for (const p of shown.plants) drawBody(pen, p.plant.site, p.plant.activity, p.x, p.y, size);
    const { words } = frame;
    for (let i = 0; i < words.length; i++) {
      const sprite = sprites.words[i] ?? 0;
      if (sprite !== 0 && sprite === before[i]) words[i] = sprite;
    }
  }
  const falling =
    grid !== null && anyPrecipitation(grid, viewBox(scene.camera, scene.width, scene.height));
  const placed = shown.plants;
  // In the painter's order, roughly: what stands lower on the frame is in front.
  const marks: Mark[] = [
    ...shown.landmarks.map((m): Mark => ({
      kind: "landmark",
      id: m.landmark.id,
      ...landmarkBox(m.landmark, m.x, m.y),
    })),
    ...placed.map((p): Mark => ({
      kind: "plant",
      id: plantMarkId(p.plant.site),
      plant: p.plant,
      ...plantBox(p.plant.site, p.x, p.y, size),
    })),
  ].sort((a, b) => a.bottom - b.bottom || a.left - b.left);
  const moving = placed.filter(
    (p) => p.plant.activity !== null && p.plant.activity > 0 && hasMotion(p.plant.site, size),
  );
  const { ox, oy } = frame;
  const { darkness, emissive } = scene.light;
  return {
    moving: moving.length > 0 || falling,
    marks,
    animate(target: Surface, seconds: number): undefined {
      if (target.width !== out.width || target.height !== out.height) return;
      const onTarget: Frame = { ...frameOf(scene, target), ox, oy };
      const pen = penOf(onTarget, darkness, emissive);
      for (const p of moving)
        drawMotion(pen, p.plant.site, p.plant.activity, p.x, p.y, size, seconds);
      if (!falling || mask === null) return;
      // Rain and snow, then a lightning flash, over everything.
      const s = scene.camera.scale;
      eachDrop(
        grid,
        target.width,
        target.height,
        (x, y) => ({ x: (x + ox) / s, y: (2 * (y + oy)) / s }),
        seconds,
        (x, y, group) => {
          // Between the clouds only: under one, the rain is hidden.
          if ((mask.owner[y * target.width + x] ?? -1) < 0)
            pen.put(x, y, group === "snow" ? "snow" : "foam");
        },
      );
      for (const [x, y] of lightning(mask, seconds)) pen.glow(x, y);
    },
  };
}

export const pixelTheme: Theme = { id: "pixel", density: () => 1, draw: drawPixelScene };
