/**
 * What both themes share to draw the weather (B-018, D-064): which pixels a cloud
 * covers, where the rain and the snow fall at an animation time, and the path of a
 * lightning bolt. Each theme then colours them its own way. Pure.
 */
import { type WeatherGroup } from "../data/open-meteo.ts";
import { type Camera } from "../scene/camera.ts";
import {
  type Cloud,
  cloudLift,
  cloudsOver,
  cloudZoom,
  hash3,
  viewBox,
  type WeatherGrid,
  weatherAt,
} from "../scene/clouds.ts";

/** Where a view's clouds are, pixel by pixel, at `density` pixels per scene pixel. */
export interface CloudMask {
  readonly width: number;
  readonly height: number;
  readonly density: number;
  readonly clouds: readonly Cloud[];
  /** For each pixel, the index in `clouds` of the cloud over it, or -1. */
  readonly owner: Int32Array;
  /** For each pixel under a cloud, how deep inside it, 0 (edge) to 1 (a lobe's centre). */
  readonly depth: Float32Array;
  /** How far up and left a cloud floats over its shadow, in pixels of the mask. */
  readonly lift: number;
  /**
   * Where a bolt can start, in scene pixels: the middle of the lowest row of each
   * storm cloud that shows on the view, worked out once with the mask.
   */
  readonly bolts: readonly (readonly [number, number])[];
}

/**
 * Scene pixel of a point of the map, for a view of `width` × `height` (2:1 tiles):
 * from the frames' own whole-pixel offsets, so a cloud stays anchored to the ground
 * under it as the camera moves by fractions of a pixel.
 */
export function toScreen(
  camera: Camera,
  width: number,
  height: number,
): { x: (km: number) => number; y: (km: number) => number } {
  const s = camera.scale;
  const ox = Math.round(camera.x * s) - Math.floor(width / 2);
  const oy = Math.round((camera.y * s) / 2) - Math.floor(height / 2);
  return {
    x: (km) => km * s - ox,
    y: (km) => (km * s) / 2 - oy,
  };
}

/**
 * The clouds of a view at `timeMs`, rasterized: each lobe an ellipse 0.62 as tall as
 * it is wide, the deepest lobe owning a pixel where two overlap.
 */
export function cloudMask(
  grid: WeatherGrid,
  camera: Camera,
  width: number,
  height: number,
  density: number,
  timeMs: number,
): CloudMask {
  const zoom = cloudZoom(camera.scale);
  const box = viewBox(camera, width, height);
  // Clouds just off the view still cast a shadow into it.
  const lift = cloudLift(camera.scale);
  const reach = lift / camera.scale + 30 * zoom;
  const clouds = cloudsOver(
    grid,
    {
      left: box.left - reach,
      top: box.top - reach,
      right: box.right + reach,
      bottom: box.bottom + reach,
    },
    zoom,
    timeMs,
  );
  const w = width * density;
  const h = height * density;
  const owner = new Int32Array(w * h).fill(-1);
  const depth = new Float32Array(w * h);
  const at = toScreen(camera, width, height);
  clouds.forEach((cloud, index) => {
    for (const lobe of cloud.lobes) {
      const cx = at.x(lobe.x) * density;
      const cy = at.y(lobe.y) * density;
      const rx = lobe.r * camera.scale * density;
      const ry = rx * 0.62;
      if (!(rx > 0)) continue;
      const top = Math.max(0, Math.floor(cy - ry));
      const bottom = Math.min(h - 1, Math.ceil(cy + ry));
      const left = Math.max(0, Math.floor(cx - rx));
      const right = Math.min(w - 1, Math.ceil(cx + rx));
      for (let y = top; y <= bottom; y++) {
        const v = (y + 0.5 - cy) / ry;
        for (let x = left; x <= right; x++) {
          const u = (x + 0.5 - cx) / rx;
          const q = 1 - u * u - v * v;
          if (q <= 0) continue;
          const i = y * w + x;
          if (q > (depth[i] ?? 0)) {
            depth[i] = q;
            owner[i] = index;
          }
        }
      }
    }
  });
  // Each storm cloud's lowest row on the view, and the run of it there.
  const lowest = new Map<number, { y: number; left: number; right: number }>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = owner[y * w + x] ?? -1;
      if (o < 0 || clouds[o]?.group !== "storm") continue;
      const known = lowest.get(o);
      if (known === undefined || y > known.y) lowest.set(o, { y, left: x, right: x });
      else if (y === known.y) known.right = x;
    }
  const bolts = [...lowest.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([, run]) =>
        [Math.floor((run.left + run.right) / 2 / density), Math.floor(run.y / density)] as const,
    );
  return { width: w, height: h, density, clouds, owner, depth, lift: lift * density, bolts };
}

/** The cloud over a pixel of the mask, or -1 (off the mask too). */
export function ownerAt(mask: CloudMask, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return -1;
  return mask.owner[y * mask.width + x] ?? -1;
}

/** Where a cloud's pixel stands: on its lit rim (north-west), its shaded rim (south-east), or inside. */
export function cloudPart(mask: CloudMask, x: number, y: number): "lit" | "shade" | "body" {
  const e = mask.density;
  if (ownerAt(mask, x + e, y + e) < 0 || ownerAt(mask, x, y + 2 * e) < 0) return "shade";
  if (ownerAt(mask, x - e, y - e) < 0) return "lit";
  return "body";
}

/**
 * Rain of each group, on lanes 5 scene pixels apart: streaks this long, on this share
 * of the lattice. By group only: the precipitation figure's window is unverified for
 * `current` (ARCHITECTURE § Open-Meteo), so no density follows it yet.
 */
const RAIN: Partial<Record<WeatherGroup, { length: number; chance: number }>> = {
  drizzle: { length: 2, chance: 0.2 },
  rain: { length: 4, chance: 0.45 },
  storm: { length: 4, chance: 0.65 },
};
/** Rain falls this many scene pixels a second, one pixel right for two down (wind from the west, drawn). */
const RAIN_SPEED = 90;
/** Rows of the rain lattice, scene pixels. */
const RAIN_ROW = 7;
/** Snow: one flake per cell of this many scene pixels, at most, falling this fast. */
const SNOW_CELL = 5;
const SNOW_SPEED = 14;
const SNOW_CHANCE = 0.32;

/**
 * Calls `drop(x, y, group)` for each scene pixel of rain or snow at `seconds` of
 * animation, over a `width` × `height` view, where the ground under it is in a group
 * that makes them. Ground point of a scene pixel: `kmAt`.
 */
export function eachDrop(
  grid: WeatherGrid,
  width: number,
  height: number,
  kmAt: (x: number, y: number) => { x: number; y: number },
  seconds: number,
  drop: (x: number, y: number, group: WeatherGroup) => void,
): void {
  const groupAt = (x: number, y: number): WeatherGroup | null => {
    const k = kmAt(x, y);
    return weatherAt(grid, k.x, k.y)?.group ?? null;
  };
  // Rain: a lattice of lanes that falls with time; a lane slants right as it goes down.
  const fall = Math.floor(seconds * RAIN_SPEED);
  for (
    let v = Math.floor(fall / RAIN_ROW) - 1;
    v <= Math.floor((height + fall) / RAIN_ROW) + 1;
    v++
  ) {
    const top = v * RAIN_ROW - fall;
    const shift = Math.floor((v * RAIN_ROW) / 2);
    for (let lane = Math.floor(-shift / 5) - 2; lane * 5 + shift <= width + 2; lane++) {
      const r = hash3(lane, v, 5);
      const y0 = top + Math.floor(hash3(lane, v, 6) * 3);
      const x0 = lane * 5 + shift;
      if (x0 < -4 || x0 > width + 4 || y0 + 4 < 0 || y0 >= height) continue;
      const group = groupAt(
        Math.min(width - 1, Math.max(0, x0)),
        Math.min(height - 1, Math.max(0, y0)),
      );
      const rain = group === null ? undefined : RAIN[group];
      if (rain === undefined || group === null || r >= rain.chance) continue;
      for (let k = 0; k < rain.length; k++) {
        const x = x0 + Math.floor(k / 2);
        const y = y0 + k;
        // A streak that crosses into a region without rain stops at its border.
        if (x >= 0 && y >= 0 && x < width && y < height && (k === 0 || groupAt(x, y) === group))
          drop(x, y, group);
      }
    }
  }
  // Snow: at most a flake per cell, cells falling slowly.
  const drift = Math.floor(seconds * SNOW_SPEED);
  for (let cy = Math.floor(-drift / SNOW_CELL) - 1; cy * SNOW_CELL + drift <= height; cy++)
    for (let cx = 0; cx * SNOW_CELL < width; cx++) {
      if (hash3(cx, cy, 8) >= SNOW_CHANCE) continue;
      const x = cx * SNOW_CELL + Math.floor(hash3(cx, cy, 9) * (SNOW_CELL - 1));
      const y = cy * SNOW_CELL + drift + Math.floor(hash3(cx, cy, 10) * (SNOW_CELL - 1));
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (groupAt(x, y) === "snow") drop(x, y, "snow");
    }
}

/** A storm flashes once every this many seconds, for the first FLASH_S of them. */
export const FLASH_EVERY_S = 6;
export const FLASH_S = 0.3;

/**
 * The scene pixels of the lightning bolt at `seconds`, if one flashes then: from a
 * storm cloud on the view, picked anew at each flash, down to the ground under it.
 */
export function lightning(mask: CloudMask, seconds: number): readonly [number, number][] {
  const flash = Math.floor(seconds / FLASH_EVERY_S);
  if (seconds - flash * FLASH_EVERY_S >= FLASH_S) return [];
  const d = mask.density;
  const bolts = mask.bolts;
  if (bolts.length === 0) return [];
  const [sx, sy] = bolts[Math.floor(hash3(flash, bolts.length, 3) * bolts.length)] ?? [-1, -1];
  if (sx < 0) return [];
  const out: [number, number][] = [];
  let x = sx;
  const length = Math.round(mask.lift / d) + 8;
  for (let k = 0; k < length; k++) {
    if (k > 0 && k % 4 === 0) x += hash3(flash, k, 4) < 0.5 ? -1 : 1;
    out.push([x, sy + k]);
  }
  return out;
}
