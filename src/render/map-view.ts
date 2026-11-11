/**
 * Draws the baked map of France (src/map/france.ts) as a relief diorama, in the
 * palette, under a light (B-010 mockups; the base of the scene's terrain layer in
 * B-011): 2:1 tiles with north kept up, the map seen from the south (D-017). Pure:
 * integer arithmetic decides every pixel, apart from the light, which comes in as a
 * number.
 */
import { COARSE_ROWS_RLE, ELEVATION_ROWS_HEX } from "../map/france.ts";
import {
  cellCentre,
  COARSE_COLUMNS,
  COARSE_KM,
  COARSE_ROWS,
  decodeHex,
  decodeRuns,
  ELEVATION_CLASSES,
  FINE_KM,
  fineIndexOf,
  FOREIGN,
  kindOfRegion,
  type CellRegion,
  SEA,
} from "../map/grid.ts";
import { PREFECTURES, REGION_CAPITALS } from "../geo/regions.ts";
import { type Light, skyColour, tinted } from "../sky/light.ts";
import { DITHER_LEVELS } from "./dither.ts";
import { type ColourName, darken, PALETTE } from "./palette.ts";
import { createSurface, setPixel, type Surface } from "./surface.ts";

export interface MapViewOptions {
  /** Tile width in pixels (even, ≥ 2): 2 for France, 8 for a region. */
  readonly tile: number;
  readonly light: Light;
  /** Crop to this region's cells (with a margin), or draw the whole grid. */
  readonly region?: CellRegion;
}

interface MapData {
  readonly kinds: Uint8Array;
  readonly elevation: Uint8Array;
  /** Distance to the nearest land in cells, for sea cells (capped). */
  readonly seaDistance: Uint8Array;
}

let cached: MapData | null = null;

/** The coarse grid, decoded once (160 KB, never grows). */
function mapData(): MapData {
  if (cached !== null) return cached;
  const kinds = decodeRuns(COARSE_ROWS_RLE, COARSE_COLUMNS);
  const elevation = decodeHex(ELEVATION_ROWS_HEX, COARSE_COLUMNS);
  // Breadth-first distance from land over the sea, 4-neighbours, capped at 255.
  const seaDistance = new Uint8Array(kinds.length).fill(255);
  let frontier: number[] = [];
  kinds.forEach((k, i) => {
    if (k !== SEA) {
      seaDistance[i] = 0;
      frontier.push(i);
    }
  });
  for (let d = 1; d < 255 && frontier.length > 0; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      const r = Math.floor(i / COARSE_COLUMNS);
      const c = i % COARSE_COLUMNS;
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= COARSE_ROWS || cc >= COARSE_COLUMNS) continue;
        const j = rr * COARSE_COLUMNS + cc;
        if ((seaDistance[j] ?? 0) > d) {
          seaDistance[j] = d;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  cached = { kinds, elevation, seaDistance };
  return cached;
}

/** A small integer hash of a pixel, for seeded scatter (no Math.random). */
function cellHash(r: number, c: number): number {
  let h = Math.imul(r, 0x27d4eb2d) ^ Math.imul(c, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/**
 * Ground colour of a land cell: one flat colour per altitude band (summer, no season
 * yet), like the tints of a relief map, so the land reads as a few calm shapes.
 */
function groundColour(elevation: number): ColourName {
  if (elevation >= 13) return "snow"; // 2 400 m and up
  if (elevation >= 10) return "rock"; // 1 300 m
  if (elevation >= 7) return "forest"; // 800 m
  if (elevation >= 4) return "grass"; // 300 m
  return "meadow";
}

/** Sea colour: three flat bands by distance from the coast. */
function seaColour(distance: number): ColourName {
  if (distance <= 1) return "seaShallow";
  if (distance <= 5) return "sea";
  return "seaDeep";
}

/** Lower bound in metres of an elevation class. */
function metres(elevation: number): number {
  return ELEVATION_CLASSES[elevation] ?? 0;
}

/**
 * Relief height of a cell in pixels: a tile's width per 1 000 m. The plains stay
 * flat and the mountains rise, so the relief reads without striping the lowlands.
 */
function heightPx(elevation: number, tile: number): number {
  return Math.floor((metres(elevation) * tile) / 1000);
}

/** Screen position (before cropping) of a cell's top-left tile corner. */
function project(r: number, c: number, tile: number): [number, number] {
  return [c * tile, (r * tile) / 2];
}

/** One tile: a 2:1 rectangle, `tile` pixels wide. */
function drawTile(
  s: Surface,
  x0: number,
  y0: number,
  tile: number,
  colourAt: (x: number, y: number) => ColourName,
): void {
  for (let y = y0; y < y0 + tile / 2; y++)
    for (let x = x0; x < x0 + tile; x++) setPixel(s, x, y, PALETTE[colourAt(x, y)]);
}

/** Cells of a region, with a margin, or the whole grid: [top, left, bottom, right]. */
function bounds(
  kinds: Uint8Array,
  region: CellRegion | undefined,
): [number, number, number, number] {
  if (region === undefined) return [0, 0, COARSE_ROWS - 1, COARSE_COLUMNS - 1];
  const kind = kindOfRegion(region);
  let top = COARSE_ROWS;
  let left = COARSE_COLUMNS;
  let bottom = 0;
  let right = 0;
  kinds.forEach((k, i) => {
    if (k !== kind) return;
    const r = Math.floor(i / COARSE_COLUMNS);
    const c = i % COARSE_COLUMNS;
    top = Math.min(top, r);
    bottom = Math.max(bottom, r);
    left = Math.min(left, c);
    right = Math.max(right, c);
  });
  const m = 6;
  return [
    Math.max(0, top - m),
    Math.max(0, left - m),
    Math.min(COARSE_ROWS - 1, bottom + m),
    Math.min(COARSE_COLUMNS - 1, right + m),
  ];
}

/** Towns drawn on the mockups: the prefectures (S-006), regional ones larger. */
function towns(): { r: number; c: number; capital: boolean }[] {
  const capitals = new Set<string>(Object.values(REGION_CAPITALS));
  return PREFECTURES.flatMap(([dept, , , lat, lon]) => {
    const cell = fineIndexOf(lat, lon);
    if (cell === null) return [];
    const r = Math.floor((cell.row * FINE_KM) / COARSE_KM);
    const c = Math.floor((cell.column * FINE_KM) / COARSE_KM);
    return [{ r, c, capital: capitals.has(dept) }];
  });
}

export function drawMapView(options: MapViewOptions): Surface {
  const { tile, light } = options;
  const { kinds, elevation, seaDistance } = mapData();
  const [top, left, bottom, right] = bounds(kinds, options.region);

  // Screen extent of the cropped cells, with room above for the relief.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [r, c] of [
    [top, left],
    [top, right],
    [bottom, left],
    [bottom, right],
  ] as const) {
    const [x, y] = project(r, c, tile);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + tile);
    maxY = Math.max(maxY, y + tile / 2);
  }
  const lift = heightPx(15, tile) + tile;
  const width = maxX - minX;
  const height = maxY - minY + lift;
  const s = createSurface(width, height);

  // Sky: the light's gradient, zenith to horizon, dithered, behind everything.
  for (let y = 0; y < height; y++) {
    const level =
      height > 1 ? Math.floor((2 * y * DITHER_LEVELS + (height - 1)) / (2 * (height - 1))) : 0;
    for (let x = 0; x < width; x++) setPixel(s, x, y, PALETTE[skyColour(light, level, x, y)]);
  }

  // Painter's order: back to front.
  const cells: [number, number][] = [];
  for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) cells.push([r, c]);

  const at = (r: number, c: number): number => r * COARSE_COLUMNS + c;
  const focus = options.region === undefined ? null : kindOfRegion(options.region);
  for (const [r, c] of cells) {
    const i = at(r, c);
    const kind = kinds[i] ?? SEA;
    const [px, py] = project(r, c, tile);
    const x0 = px - minX;
    const y0 = py - minY + lift;
    if (kind === SEA) {
      const sea = seaColour(seaDistance[i] ?? 255);
      drawTile(s, x0, y0, tile, (x, y) => tinted(sea, light.darkness, x, y));
      continue;
    }
    const e = kind === FOREIGN ? 0 : (elevation[i] ?? 0);
    const h = heightPx(e, tile);
    const ground = groundColour(e);
    // Hill shading, one light from the north-west: a cell 250 m or more below its
    // north-west neighbour faces away from it and is one step darker. Smaller drops
    // stay lit, so the plains stay calm.
    const nw = kind === FOREIGN ? 0 : (elevation[at(Math.max(r - 1, 0), Math.max(c - 1, 0))] ?? 0);
    const shade = metres(nw) - metres(e) >= 250 ? 1 : 0;
    // Abroad, and outside the region on a region view, the land recedes one step by
    // day. The veil fades as night falls, or the land around would darken into the
    // sea's blues and read as sea; at night the lamps set France apart.
    const veiled = kind === FOREIGN || (focus !== null && kind !== focus);
    const veil = veiled ? Math.max(0, 1 - light.darkness / 2) : 0;
    const darkness = light.darkness + shade + veil;
    const side = darken(ground, 1);
    for (let k = 0; k < h; k++)
      drawTile(s, x0, y0 - k, tile, (x, y) => tinted(side, darkness, x, y));
    drawTile(s, x0, y0 - h, tile, (x, y) => tinted(ground, darkness, x, y));
  }

  // Towns: roofs by day, lamps when emissive.
  for (const town of towns()) {
    if (town.r < top || town.r > bottom || town.c < left || town.c > right) continue;
    const e = elevation[at(town.r, town.c)] ?? 0;
    const [px, py] = project(town.r, town.c, tile);
    const cx = px - minX + tile / 2;
    const cy = py - minY + lift - heightPx(e, tile) + tile / 4;
    const size = Math.max(1, Math.floor(tile / 4)) + (town.capital ? 1 : 0);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const x = cx - Math.floor(size / 2) + dx;
        const y = cy - Math.floor(size / 2) + dy;
        if (light.emissive) {
          // Lit windows: a scatter, not a block, so a town glows like a town.
          if (size === 1 || cellHash(x, y) % 3 !== 0) setPixel(s, x, y, PALETTE.lamp);
        } else setPixel(s, x, y, PALETTE[tinted("roof", light.darkness, x, y)]);
      }
    }
  }
  return s;
}

/** Where the centre of a coarse cell is, for tests and captions. */
export function coarseCellCentre(r: number, c: number): { latitude: number; longitude: number } {
  return cellCentre(r, c, COARSE_KM);
}
