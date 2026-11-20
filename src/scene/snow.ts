/**
 * Snow on the ground (B-022, Q-45), from the readings' `snow_depth`. One reading
 * stands for much land, so where the snow lies is **inferred**, and the page says so:
 *
 * - a region's point (its prefecture, or the viewer's position) under snow: the
 *   region's land at least as high as the point is under snow too;
 * - a mountain range's point under snow: the range is, at least as high as the
 *   point; the range being the land at that height or above that the point's ground
 *   reaches without coming down below it (one breadth-first search from the point).
 *
 * "As high" is by elevation class (`elevationClass`): a cell holds if its class is at
 * least the point's. Abroad and Corsica have no reading, so no snow. Pure: integer
 * classes and a breadth-first search, so every engine lays the same snow.
 */
import { REGION_CODES } from "../data/eco2mix.ts";
import { type WeatherReading } from "../data/open-meteo.ts";
import { elevationClass, FOREIGN, KIND_COUNT, kindOfRegion, kmOf, SEA } from "../map/grid.ts";
import { type TerrainLayer } from "../map/layers.ts";
import { MASSIFS, type RegionalWeather } from "./weather.ts";

/** A reading shows snow on the ground from this depth, m: any snow it reports. */
export const SNOW_FROM_M = 0.005;

/** How far from a range's point its search may start, km, if its own cell is lower. */
const SEED_REACH_KM = 8;

const snowy = (r: WeatherReading | undefined): r is WeatherReading =>
  r !== undefined && r.snowDepthM >= SNOW_FROM_M;

/**
 * Per cell of `layer`, 1 where snow lies; null when none does (no reading of snow, or
 * no ground as high as the points that report it), so a theme draws none: the common
 * case, kept cheap.
 */
export function snowCover(layer: TerrainLayer, weather: RegionalWeather): Uint8Array | null {
  const { columns, rows, kinds, elevation, km } = layer;
  if (!anySnow(weather)) return null;
  const n = columns * rows;
  const cover = new Uint8Array(n);

  // The regions, in one pass: each kind's lowest class under snow (NONE: no snow).
  const NONE = 255;
  const from = new Uint8Array(KIND_COUNT).fill(NONE);
  for (const region of REGION_CODES) {
    const reading = weather[region];
    if (snowy(reading)) from[kindOfRegion(region)] = elevationClass(reading.elevationM);
  }
  for (let i = 0; i < n; i++)
    if ((elevation[i] ?? 0) >= (from[kinds[i] ?? 0] ?? NONE)) cover[i] = 1;

  // The ranges: one breadth-first search each, over a queue and a visit mark shared
  // by all (the mark is the range's number, so each search starts afresh).
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  MASSIFS.forEach((massif, m) => {
    const reading = weather[massif.id];
    if (!snowy(reading)) return;
    const mark = m + 1;
    const min = elevationClass(reading.elevationM);
    // French land (not abroad, not sea) at the point's class or above.
    const holds = (i: number): boolean => (kinds[i] ?? 0) >= 2 && (elevation[i] ?? 0) >= min;
    let head = 0;
    let tail = 0;
    const visit = (i: number): void => {
      if (seen[i] === mark || !holds(i)) return;
      seen[i] = mark;
      queue[tail++] = i;
    };
    const { x, y } = kmOf(massif.latitude, massif.longitude);
    const cx = Math.floor(x / km);
    const cy = Math.floor(y / km);
    // From the point's own cell; where that cell's mean is lower than the point (a
    // point on a slope), from the cells near it that hold.
    if (cx >= 0 && cy >= 0 && cx < columns && cy < rows) visit(cy * columns + cx);
    if (tail === 0) {
      const reach = Math.ceil(SEED_REACH_KM / km);
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) {
          const xx = cx + dx;
          const yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < columns && yy < rows) visit(yy * columns + xx);
        }
    }
    while (head < tail) {
      const i = queue[head++] ?? 0;
      cover[i] = 1;
      const xx = i % columns;
      if (xx + 1 < columns) visit(i + 1);
      if (xx > 0) visit(i - 1);
      if (i + columns < n) visit(i + columns);
      if (i >= columns) visit(i - columns);
    }
  });
  return cover.includes(1) ? cover : null;
}

/**
 * How white each cell is under `cover`, 0–1, for a theme that blends (the modern
 * one): a cell under snow from 0.5 (alone) to 1 (snow all around), a cell next to
 * snow up to 8/18, over its 3 × 3 cells, so the edge is soft. Never abroad, which
 * has no reading: not even the soft edge of France's snow.
 */
export function softSnow(layer: TerrainLayer, cover: Uint8Array): Float32Array {
  const { columns, rows, kinds } = layer;
  const out = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      const kind = kinds[i] ?? SEA;
      if (kind === FOREIGN) continue;
      let sum = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = Math.min(rows - 1, Math.max(0, r + dr));
          const cc = Math.min(columns - 1, Math.max(0, c + dc));
          sum += cover[rr * columns + cc] ?? 0;
        }
      out[i] = (cover[i] ?? 0) === 1 ? 0.5 + sum / 18 : sum / 18;
    }
  return out;
}

let last: { layer: TerrainLayer; weather: RegionalWeather; cover: Uint8Array | null }[] = [];

/** `snowCover`, kept for the last readings asked, for each layer (4 km and 1 km). */
export function snowCoverOf(layer: TerrainLayer, weather: RegionalWeather): Uint8Array | null {
  const hit = last.find((e) => e.layer === layer && e.weather === weather);
  if (hit !== undefined) return hit.cover;
  const cover = snowCover(layer, weather);
  last = [...last.filter((e) => e.layer !== layer), { layer, weather, cover }];
  return cover;
}

/** Whether any snow is laid on the land: the page then says that it is inferred. */
export function anySnow(weather: RegionalWeather): boolean {
  return Object.values(weather).some(snowy);
}
