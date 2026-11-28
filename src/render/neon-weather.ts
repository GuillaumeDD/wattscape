/**
 * The weather and the seasons of the neon theme (B-043, D-086, direction A,
 * contours): the same clouds, fog, rain, snow and lightning as the other themes
 * (src/render/weather-art.ts), drawn as light. A cloud is a line of light along its
 * edge over a light veil; rain falls as streaks of light, snow as dots, fog lies as
 * scan lines; a bolt glows. The season is the colour of the contour lines; snow on
 * the ground lightens it and whitens the lines. Pure: additions, multiplications
 * and divisions only.
 */
import { type WeatherGroup } from "../data/open-meteo.ts";
import { kmAtPixel } from "../scene/camera.ts";
import { fogAt, type WeatherGrid } from "../scene/clouds.ts";
import { type Season } from "../scene/season.ts";
import { type Scene } from "../scene/scene.ts";
import { type Rgb } from "./palette.ts";
import { type Surface } from "./surface.ts";
import { type CloudMask, eachDrop, lightning } from "./weather-art.ts";

const hex = (s: string): Rgb => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];

/** The contour lines' colour in each season (D-086, confirmed in D-087): summer's is B-041's. */
export const NEON_SEASON_LINES: Readonly<Record<Season, Rgb>> = {
  winter: hex("#8fd0ff"),
  spring: hex("#5cffa8"),
  summer: hex("#8b6bff"),
  autumn: hex("#ffa24a"),
};
/** Under snow: the contour lines' colour, and the land's ground by day. */
export const NEON_SNOW_LINE: Rgb = hex("#eef6ff");
export const NEON_SNOW_GROUND: Rgb = hex("#27345a");

/** A cloud's line by its group. */
export const NEON_CLOUD_LINES: Readonly<Record<"fair" | "rain" | "storm", Rgb>> = {
  fair: hex("#e4f2ff"),
  rain: hex("#7fb2ff"),
  storm: hex("#c08cff"),
};
export const NEON_RAIN: Rgb = hex("#6fb8ff");
export const NEON_FLAKE: Rgb = hex("#f2f8ff");
export const NEON_FOG: Rgb = hex("#9a8cff");
export const NEON_BOLT: Rgb = hex("#f4e8ff");

/** How much a cloud dims the map under it, at its heart. */
const VEIL = 0.2;
/** Fog lies on one scene row in this many. */
const FOG_ROWS = 3;

const kindOf = (group: WeatherGroup): "fair" | "rain" | "storm" =>
  group === "storm"
    ? "storm"
    : group === "rain" || group === "drizzle" || group === "snow"
      ? "rain"
      : "fair";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function add(data: Uint8ClampedArray, i: number, c: Rgb, k: number): void {
  if (!(k > 0)) return;
  const p = i * 4;
  data[p] = (data[p] ?? 0) + c[0] * k;
  data[p + 1] = (data[p + 1] ?? 0) + c[1] * k;
  data[p + 2] = (data[p + 2] ?? 0) + c[2] * k;
}

function dim(data: Uint8ClampedArray, i: number, k: number): void {
  const p = i * 4;
  data[p] = (data[p] ?? 0) * k;
  data[p + 1] = (data[p + 1] ?? 0) * k;
  data[p + 2] = (data[p + 2] ?? 0) * k;
}

/** How bright a cloud's line is at a depth inside it (0 at its edge), `density` pixels per scene pixel. */
export function cloudLine(depth: number, density: number): number {
  const e = depth * 6 * density;
  return clamp01(1.5 - e) * 0.9 + 0.2 / (1 + e * e * 0.25);
}

/**
 * The still weather over the map of `out` (`mask` at `out`'s density): the fog's
 * scan lines, then each cloud's veil and line. Called before what stands on the map
 * is drawn, which stays over it.
 */
export function drawNeonWeather(
  scene: Scene,
  grid: WeatherGrid,
  mask: CloudMask,
  out: Surface,
): void {
  const { width, height, data } = out;
  const d = mask.density;
  for (let y = 0; y < height; y++) {
    if (Math.floor(y / d) % FOG_ROWS !== 0) continue;
    const ky = kmAtPixel(scene.camera, 0, (y + 0.5) / d, scene.width, scene.height).y;
    if (ky < 0) continue;
    for (let x = 0; x < width; x++) {
      const kx = kmAtPixel(scene.camera, (x + 0.5) / d, 0, scene.width, scene.height).x;
      const fog = fogAt(grid, kx, ky);
      if (!(fog > 0.3)) continue;
      const t = clamp01((fog - 0.3) / 0.4);
      add(data, y * width + x, NEON_FOG, 0.35 * t * t * (3 - 2 * t));
    }
  }
  for (let i = 0; i < width * height; i++) {
    const index = mask.owner[i] ?? -1;
    const cloud = index < 0 ? undefined : mask.clouds[index];
    if (cloud === undefined) continue;
    const depth = mask.depth[i] ?? 0;
    dim(data, i, 1 - VEIL * clamp01(depth * 4));
    add(data, i, NEON_CLOUD_LINES[kindOf(cloud.group)], cloudLine(depth, d));
  }
}

/**
 * Rain, snow and lightning at `seconds` of animation, into `target` (a copy of the
 * still frame): rain and snow between the clouds only, as in the other themes.
 */
export function animateNeonWeather(
  scene: Scene,
  grid: WeatherGrid,
  mask: CloudMask,
  target: Surface,
  seconds: number,
): void {
  const d = mask.density;
  const { width, height, data } = target;
  eachDrop(
    grid,
    scene.width,
    scene.height,
    (x, y) => kmAtPixel(scene.camera, x + 0.5, y + 0.5, scene.width, scene.height),
    seconds,
    (x, y, group) => {
      const px = x * d;
      const py = y * d;
      if ((mask.owner[py * width + px] ?? -1) >= 0) return;
      if (group === "snow") glowDot(data, width, height, px, py, d, NEON_FLAKE, 0.9);
      else
        for (let j = 0; j < d; j++)
          add(data, (py + j) * width + px + (d >> 1), NEON_RAIN, group === "drizzle" ? 0.35 : 0.6);
    },
  );
  for (const [x, y] of lightning(mask, seconds))
    glowDot(data, width, height, x * d, y * d, d, NEON_BOLT, 1);
}

/** A scene pixel of light at (px, py), `d` output pixels wide, and a faint ring around it. */
function glowDot(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  px: number,
  py: number,
  d: number,
  c: Rgb,
  k: number,
): void {
  for (let j = -1; j <= d; j++)
    for (let i = -1; i <= d; i++) {
      const qx = px + i;
      const qy = py + j;
      if (qx < 0 || qy < 0 || qx >= width || qy >= height) continue;
      const inner = i >= 0 && j >= 0 && i < d && j < d;
      add(data, qy * width + qx, c, inner ? k : k * 0.25);
    }
}
