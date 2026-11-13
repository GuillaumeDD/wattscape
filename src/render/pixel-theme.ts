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
import { type Scene, type ScenePlant, type Town, townCellCount } from "../scene/scene.ts";
import { skyColour, tinted } from "../sky/light.ts";
import { drawLandmark } from "./art/landmarks.ts";
import { drawBody, drawMotion, hasMotion, type Pen, type SpriteSize } from "./art/plants.ts";
import { type Landmark } from "../map/landmarks.ts";
import { isDiffuse } from "../map/sources.ts";
import { BAYER_4, DITHER_LEVELS } from "./dither.ts";
import { COLOUR_NAMES, type ColourName, darken, PALETTE, type Rgb } from "./palette.ts";
import { createSurface, type Surface } from "./surface.ts";
import type { Drawn, Theme } from "./theme.ts";

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

/**
 * Ground colour of a land cell: one flat colour per altitude band (summer, no season
 * yet), like the tints of a relief map, so the land reads as a few calm shapes.
 */
export function groundColour(elevation: number): ColourName {
  if (elevation >= 12) return "snow"; // 2 400 m and up
  if (elevation >= 9) return "rock"; // 1 300 m
  if (elevation >= 7) return "forest"; // 800 m
  if (elevation >= 4) return "grass"; // 300 m
  return "meadow";
}

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
interface Tints {
  readonly top: Uint32Array[];
  readonly side: Uint32Array[];
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
  const top: Uint32Array[] = [];
  const side: Uint32Array[] = [];
  for (let e = 0; e < ELEVATION_CLASSES.length; e++) {
    const ground = groundColour(e);
    for (let k = 0; k < 4; k++) {
      const d = darkness[k] ?? base;
      top.push(pattern(frame, ground, d));
      // The south face, one step darker than the top.
      side.push(pattern(frame, darken(ground, 1), d));
    }
  }
  return {
    top,
    side,
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
      // The south face shows below the top face: h rows.
      if (h > 0)
        fill(frame, x0, y1 - h, x1, y1, (cliff ? tints.side[t] : tints.top[t]) ?? tints.roof);
      fill(frame, x0, y0 - h, x1, y1 - h, tints.top[t] ?? tints.roof);

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
  let placed: PlacedPlant[];
  const size: SpriteSize = scene.camera.scale >= SPRITES_FROM_SCALE ? "full" : "marker";
  if (!(detail > 0) || scene.fine === null)
    placed = drawLayer(frame, scene, scene.coarse, true).plants;
  else if (detail >= DITHER_LEVELS) placed = drawLayer(frame, scene, scene.fine, true).plants;
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
    const shown = detail * 2 >= DITHER_LEVELS ? finePlaced : coarsePlaced;
    placed = shown.plants;
    const pen = penOf(frame, scene.light.darkness, scene.light.emissive);
    for (const m of shown.landmarks) drawLandmark(pen, m.landmark, m.x, m.y);
    for (const p of placed) drawBody(pen, p.plant.site, p.plant.activity, p.x, p.y, size);
  }
  const moving = placed.filter(
    (p) => p.plant.activity !== null && p.plant.activity > 0 && hasMotion(p.plant.site, size),
  );
  const { ox, oy } = frame;
  const { darkness, emissive } = scene.light;
  return {
    moving: moving.length > 0,
    animate(target: Surface, seconds: number): void {
      if (target.width !== out.width || target.height !== out.height) return;
      const onTarget: Frame = { ...frameOf(scene, target), ox, oy };
      const pen = penOf(onTarget, darkness, emissive);
      for (const p of moving)
        drawMotion(pen, p.plant.site, p.plant.activity, p.x, p.y, size, seconds);
    },
  };
}

export const pixelTheme: Theme = { id: "pixel", draw: drawPixelScene };
