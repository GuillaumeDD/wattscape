/**
 * The weather as the scene shows it (B-018, direction A chosen by Guillaume, D-064):
 * clouds that float over the map with their shadow on the ground, rain, snow, fog in
 * the low ground and lightning, each region under its own reading (D-063). What a
 * theme needs to draw them, and nothing about how they look: the themes do that.
 *
 * Pure. Where a cloud is, and how big, is decided by integer hashing and + − × /
 * only (ARCHITECTURE § World generation), the wind's drift included: it blows to one
 * of 8 compass points, whose steps need no sine.
 */
import { COARSE_KM, regionOfKind, SEA } from "../map/grid.ts";
import { type TerrainLayer } from "../map/layers.ts";
import { REGION_CODES, type RegionCode } from "../data/eco2mix.ts";
import { type WeatherGroup } from "../data/open-meteo.ts";
import { type Camera } from "./camera.ts";
import { type RegionalWeather } from "./weather.ts";

/** How far out to sea a region's weather reaches, in 4 km cells: 40 km. Abroad has none. */
export const SEA_REACH_CELLS = 10;
/** How far the cover and the fog are smoothed across a border, in cells each way: 16 km. */
export const BLUR_CELLS = 4;
/**
 * The most of the ground the clouds cover, even under a sky 100 % overcast, so that
 * the plants stay readable: the rest of the cover reads in the dimmed land and the
 * clouds' grey (provisional, D-064).
 */
export const MAX_CHANCE = 0.75;

/** The weather of one 4 km cell of the coarse grid. */
export interface CellWeather {
  readonly group: WeatherGroup;
  /** Cloud cover, 0–1, smoothed across region borders. */
  readonly cover: number;
  /** How much of a fog this cell is under, 0–1, smoothed across borders. */
  readonly fog: number;
}

/** The weather over the whole coarse grid, for one set of readings. */
export interface WeatherGrid {
  readonly columns: number;
  readonly rows: number;
  /** The group of each cell; null where there is no reading (abroad, far at sea). */
  readonly groups: readonly (WeatherGroup | null)[];
  readonly cover: Float32Array;
  readonly fog: Float32Array;
  /** Low ground, 0–1 per cell: 1 under 50 m, 0 from 600 m (elevation class 6). */
  readonly lowness: Float32Array;
  /** The wind the clouds drift with, in km/h towards the east and the south. */
  readonly windEast: number;
  readonly windSouth: number;
}

let nearestOf: { layer: TerrainLayer; regions: (RegionCode | null)[] } | null = null;

/**
 * For each cell of `layer`, the region whose reading covers it: its own region on
 * land, the nearest one at sea within SEA_REACH_CELLS, none abroad (no reading there).
 * Corsica has no reading either (no regional data, S-003).
 */
export function nearestRegions(layer: TerrainLayer): readonly (RegionCode | null)[] {
  if (nearestOf?.layer === layer) return nearestOf.regions;
  const { columns, rows, kinds } = layer;
  const out: (RegionCode | null)[] = new Array<RegionCode | null>(columns * rows).fill(null);
  let queue: number[] = [];
  for (let i = 0; i < columns * rows; i++) {
    const r = regionOfKind(kinds[i] ?? SEA);
    if (r !== null && r !== "94") {
      out[i] = r;
      queue.push(i);
    }
  }
  // Breadth first, in cell order, so that a tie goes the same way in every engine.
  for (let step = 0; step < SEA_REACH_CELLS && queue.length > 0; step++) {
    const next: number[] = [];
    for (const i of queue) {
      const x = i % columns;
      const y = (i - x) / columns;
      for (const j of [
        x + 1 < columns ? i + 1 : -1,
        x > 0 ? i - 1 : -1,
        y + 1 < rows ? i + columns : -1,
        y > 0 ? i - columns : -1,
      ]) {
        if (j < 0 || out[j] !== null || (kinds[j] ?? SEA) !== SEA) continue;
        out[j] = out[i] ?? null;
        next.push(j);
      }
    }
    queue = next;
  }
  nearestOf = { layer, regions: out };
  return out;
}

/** A box blur of `radius` cells each way, rows then columns; the edges average what they have. */
function blur(src: Float32Array, columns: number, rows: number, radius: number): Float32Array {
  const across = new Float32Array(src.length);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      let sum = 0;
      let n = 0;
      for (let d = -radius; d <= radius; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= columns) continue;
        sum += src[y * columns + xx] ?? 0;
        n++;
      }
      across[y * columns + x] = sum / n;
    }
  const out = new Float32Array(src.length);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      let sum = 0;
      let n = 0;
      for (let d = -radius; d <= radius; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= rows) continue;
        sum += across[yy * columns + x] ?? 0;
        n++;
      }
      out[y * columns + x] = sum / n;
    }
  return out;
}

/** The elevation class from which the ground is no longer low (600 m). */
const HIGH_CLASS = 6;

let lastGrid: { layer: TerrainLayer; weather: RegionalWeather; grid: WeatherGrid | null } | null =
  null;

/**
 * The weather over `layer` (the 4 km one) for a set of readings; null when no region
 * has one, so a theme draws no weather at all. Kept for the last readings asked.
 */
export function weatherGrid(layer: TerrainLayer, weather: RegionalWeather): WeatherGrid | null {
  if (lastGrid?.layer === layer && lastGrid.weather === weather) return lastGrid.grid;
  const grid = buildGrid(layer, weather);
  lastGrid = { layer, weather, grid };
  return grid;
}

function buildGrid(layer: TerrainLayer, weather: RegionalWeather): WeatherGrid | null {
  // The regions' readings only: a mountain range's (for the snow on the ground) has
  // its own wind, up high, and no region's sky.
  const readings = REGION_CODES.flatMap((r) => {
    const reading = weather[r];
    return reading === undefined ? [] : [reading];
  });
  if (readings.length === 0) return null;
  const { columns, rows } = layer;
  const regions = nearestRegions(layer);
  const groups: (WeatherGroup | null)[] = [];
  const cover = new Float32Array(columns * rows);
  const fog = new Float32Array(columns * rows);
  const lowness = new Float32Array(columns * rows);
  for (let i = 0; i < columns * rows; i++) {
    const region = regions[i];
    const reading = region === null || region === undefined ? undefined : weather[region];
    groups.push(reading?.group ?? null);
    cover[i] = reading === undefined ? 0 : reading.cloudCoverPct / 100;
    fog[i] = reading?.group === "fog" ? 1 : 0;
    const land = (layer.kinds[i] ?? SEA) !== SEA;
    lowness[i] = land ? Math.max(0, 1 - (layer.elevation[i] ?? 0) / HIGH_CLASS) : 0;
  }
  // One wind for the whole field, the mean of the readings' (D-064): a field that
  // drifted two ways at a border would tear the clouds there. Each reading blows
  // towards the nearest of 8 compass points, whose steps are exact (no sine), so
  // where the clouds are does not hang on an engine's last bit (AGENTS.md
  // § Determinism).
  let east = 0;
  let south = 0;
  for (const r of readings) {
    const point = (((Math.round(r.windFromDeg / 45) + 4) % 8) + 8) % 8;
    const [ux, uy] = COMPASS[point] ?? [0, 0];
    east += r.windSpeedKmh * ux;
    south += r.windSpeedKmh * uy;
  }
  return {
    columns,
    rows,
    groups,
    cover: blur(cover, columns, rows, BLUR_CELLS),
    fog: blur(fog, columns, rows, BLUR_CELLS),
    lowness,
    // Steps of 5 km/h, so a small change of the reading does not move every cloud.
    // `+ 0` turns a -0 into 0.
    windEast: Math.round(east / readings.length / 5) * 5 + 0,
    windSouth: Math.round(south / readings.length / 5) * 5 + 0,
  };
}

/** Towards north, north-east, … north-west: east and south steps of a unit wind. */
const COMPASS: readonly (readonly [number, number])[] = [
  [0, -1],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [1, 0],
  [Math.SQRT1_2, Math.SQRT1_2],
  [0, 1],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [-1, 0],
  [-Math.SQRT1_2, -Math.SQRT1_2],
];

const cellIndex = (grid: WeatherGrid, x: number, y: number): number => {
  const cx = Math.min(grid.columns - 1, Math.max(0, Math.floor(x / COARSE_KM)));
  const cy = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / COARSE_KM)));
  return cy * grid.columns + cx;
};

/** The weather at a point of the map, in km; null where there is no reading. */
export function weatherAt(grid: WeatherGrid, x: number, y: number): CellWeather | null {
  if (x < 0 || y < 0) return null;
  const i = cellIndex(grid, x, y);
  const group = grid.groups[i] ?? null;
  if (group === null) return null;
  return { group, cover: grid.cover[i] ?? 0, fog: grid.fog[i] ?? 0 };
}

/** A 32-bit integer hash of three integers, to 0 ≤ h < 1. */
export function hash3(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Smooth noise on a lattice of 1, 0–1, from hash3 (bilinear between the lattice's values). */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const a = hash3(xi, yi, seed);
  const b = hash3(xi + 1, yi, seed);
  const c = hash3(xi, yi + 1, seed);
  const d = hash3(xi + 1, yi + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/**
 * How thick the fog is at a point of the map, 0–1: the fog of its readings, on low
 * ground only (bilinear between the cells, so it has no steps), in banks.
 */
export function fogAt(grid: WeatherGrid, x: number, y: number): number {
  if (x < 0 || y < 0) return 0;
  const gx = x / COARSE_KM - 0.5;
  const gy = y / COARSE_KM - 0.5;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const at = (cx: number, cy: number): number => {
    const i =
      Math.min(grid.rows - 1, Math.max(0, cy)) * grid.columns +
      Math.min(grid.columns - 1, Math.max(0, cx));
    return (grid.fog[i] ?? 0) * (grid.lowness[i] ?? 0);
  };
  const low =
    (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) +
    (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
  if (!(low > 0)) return 0;
  // Banks about 40 km long and 16 km wide.
  return low * (0.35 + 0.65 * valueNoise(x / 40, y / 16, 7));
}

/** One round part of a cloud, in map km. */
export interface Lobe {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface Cloud {
  readonly lobes: readonly Lobe[];
  /** The group of the reading it comes from: a fair cloud, or a rain, snow or storm cloud. */
  readonly group: WeatherGroup;
  /** A number of its own, the same from frame to frame, for what animates it (lightning). */
  readonly id: number;
}

/** Eight directions around a cloud's centre, for its lobes: a table, not trigonometry. */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.7071, 0.7071],
  [0, 1],
  [-0.7071, 0.7071],
  [-1, 0],
  [-0.7071, -0.7071],
  [0, -1],
  [0.7071, -0.7071],
];

/** The side of the lattice the clouds are tried on, km, at a scale of 1 pixel a km or more. */
const LATTICE_KM = 38;

/** The zooms the clouds are drawn at: 1, 1.5, 2, 3, 4, 6, 8, … */
const zoomLevel = (k: number): number => (k % 2 === 0 ? 1 : 1.5) * 2 ** Math.floor(k / 2);

/**
 * How much the clouds grow, and thin out, on a zoomed-out view: a cloud keeps a few
 * pixels across instead of shrinking to specks. The zoom nearest 0.9 / scale among a
 * few levels (3 on the national view), so the clouds stay put on the ground while the
 * camera zooms, and change only when it passes from one level to the next.
 */
export function cloudZoom(scale: number): number {
  const wanted = 0.9 / scale;
  if (!(wanted > 1)) return 1;
  let k = 0;
  while (k < 40 && zoomLevel(k + 1) <= wanted) k++;
  const below = zoomLevel(k);
  const above = zoomLevel(k + 1);
  // Nearest by ratio: past the geometric middle of the two, the level above.
  return wanted * wanted > below * above ? above : below;
}

/**
 * The clouds over a box of map km at `timeMs`: on a lattice of LATTICE_KM × zoom, one
 * try per node, and a second past 50 % of cover; a try makes a cloud with a chance that
 * grows with the cover where it lands, at most MAX_CHANCE. The lattice drifts with
 * the wind: a cloud keeps its shape while it moves.
 */
export function cloudsOver(
  grid: WeatherGrid,
  box: { left: number; top: number; right: number; bottom: number },
  zoom: number,
  timeMs: number,
): Cloud[] {
  const hours = timeMs / 3_600_000;
  const step = LATTICE_KM * zoom;
  // How far the field has moved, km; wrapped so the lattice indices stay small, by a
  // whole number of steps, so the wrap does not change the clouds.
  const wrap = step * 25_000;
  const dx = (grid.windEast * hours) % wrap;
  const dy = (grid.windSouth * hours) % wrap;
  const out: Cloud[] = [];
  const margin = 2 * step;
  for (
    let ny = Math.floor((box.top - dy - margin) / step);
    ny <= (box.bottom - dy + margin) / step;
    ny++
  )
    for (
      let nx = Math.floor((box.left - dx - margin) / step);
      nx <= (box.right - dx + margin) / step;
      nx++
    )
      for (let k = 0; k < 2; k++) {
        const x = (nx + hash3(nx, ny, 11 + k)) * step + dx;
        const y = (ny + hash3(nx, ny, 21 + k)) * step + dy;
        const here = weatherAt(grid, x, y);
        if (here === null || here.group === "fog") continue;
        const chance =
          k === 0 ? Math.min(MAX_CHANCE, here.cover * 0.95) : Math.max(0, (here.cover - 0.5) * 0.7);
        if (hash3(nx, ny, 31 + k) >= chance) continue;
        const r = (6 + 7 * hash3(nx, ny, 41 + k) + 4 * here.cover) * zoom;
        const lobes: Lobe[] = [{ x, y, r: r * 0.7 }];
        const n = 3 + Math.floor(hash3(nx, ny, 51 + k) * 3);
        for (let i = 0; i < n; i++) {
          const [ux, uy] = DIRECTIONS[Math.floor(hash3(nx * 7 + i, ny, 61 + k) * 8)] ?? [1, 0];
          const d = r * (0.4 + 0.5 * hash3(nx, ny * 5 + i, 71 + k));
          lobes.push({
            x: x + ux * d * 1.3,
            y: y + uy * d * 0.8,
            r: r * (0.35 + 0.35 * hash3(nx + i, ny + i, 81 + k)),
          });
        }
        out.push({ lobes, group: here.group, id: (nx * 2 + k) * 7919 + ny });
      }
  return out;
}

/** The box of map km a view shows, on the ground. */
export function viewBox(
  camera: Camera,
  width: number,
  height: number,
): { left: number; top: number; right: number; bottom: number } {
  return {
    left: camera.x - width / 2 / camera.scale,
    right: camera.x + width / 2 / camera.scale,
    top: camera.y - height / camera.scale,
    bottom: camera.y + height / camera.scale,
  };
}

/**
 * How far a cloud floats above its shadow, in scene pixels: drawn this far up and to
 * the left of it, so the shadow falls to the south-east (light from the north-west).
 */
export function cloudLift(scale: number): number {
  return Math.round(Math.max(3, Math.min(10, 2 + scale * 4)));
}

/** Whether a group makes rain, snow or lightning, which move: the frame then animates. */
export function precipitates(group: WeatherGroup | null): boolean {
  return group === "drizzle" || group === "rain" || group === "snow" || group === "storm";
}

/** Whether the readings make anything fall over a box of map km (a view). */
export function anyPrecipitation(
  grid: WeatherGrid,
  box: { left: number; top: number; right: number; bottom: number },
): boolean {
  const c0 = Math.max(0, Math.floor(box.left / COARSE_KM));
  const c1 = Math.min(grid.columns - 1, Math.floor(box.right / COARSE_KM));
  const r0 = Math.max(0, Math.floor(box.top / COARSE_KM));
  const r1 = Math.min(grid.rows - 1, Math.floor(box.bottom / COARSE_KM));
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      if (precipitates(grid.groups[r * grid.columns + c] ?? null)) return true;
  return false;
}
