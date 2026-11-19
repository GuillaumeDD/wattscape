/**
 * The weather in the modern theme (B-018, D-064): the same clouds, shadows, fog,
 * rain, snow and lightning as the pixel art (src/render/weather-art.ts), drawn
 * smooth: soft cloud edges, shadows and veils blended over the map. Pure.
 */
import { type WeatherGroup } from "../data/open-meteo.ts";
import { kmAtPixel } from "../scene/camera.ts";
import { fogAt, type WeatherGrid, weatherAt } from "../scene/clouds.ts";
import { type Scene } from "../scene/scene.ts";
import { type Rgb } from "./palette.ts";
import { type Surface } from "./surface.ts";
import { type CloudMask, cloudPart, eachDrop, lightning } from "./weather-art.ts";

/** A cloud's colours by its group: body, lit rim, shaded rim. */
const CLOUDS: Readonly<Record<"fair" | "rain" | "storm", readonly [Rgb, Rgb, Rgb]>> = {
  fair: [
    [244, 246, 248],
    [255, 255, 255],
    [204, 210, 218],
  ],
  rain: [
    [184, 190, 198],
    [214, 220, 226],
    [128, 135, 148],
  ],
  storm: [
    [104, 108, 122],
    [142, 148, 160],
    [72, 76, 90],
  ],
};
const SHADOW: Rgb = [22, 30, 46];
const FOG_DAY: Rgb = [232, 234, 232];
const FOG_NIGHT: Rgb = [72, 80, 98];
const RAIN_DAY: Rgb = [215, 228, 242];
const RAIN_NIGHT: Rgb = [110, 130, 160];
const SNOW_DAY: Rgb = [255, 255, 255];
const SNOW_NIGHT: Rgb = [170, 180, 200];
const BOLT: Rgb = [255, 244, 190];

const kindOf = (group: WeatherGroup): "fair" | "rain" | "storm" =>
  group === "storm"
    ? "storm"
    : group === "rain" || group === "drizzle" || group === "snow"
      ? "rain"
      : "fair";

/** How far night has come, 0 by day to 1 at night (darkness 2). */
const nightOf = (darkness: number): number =>
  Number.isNaN(darkness) ? 1 : Math.min(1, Math.max(0, (darkness - 0.5) / 1.5));

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function blend(data: Uint8ClampedArray, i: number, c: Rgb, a: number): void {
  if (!(a > 0)) return;
  const p = i * 4;
  data[p] = (data[p] ?? 0) + (c[0] - (data[p] ?? 0)) * a;
  data[p + 1] = (data[p + 1] ?? 0) + (c[1] - (data[p + 1] ?? 0)) * a;
  data[p + 2] = (data[p + 2] ?? 0) + (c[2] - (data[p + 2] ?? 0)) * a;
}

/**
 * The still weather over the map of `out` (`mask` at `out`'s density): shadows, a dim
 * under an overcast or stormy sky, fog banks, then the clouds. Called before what
 * stands on the map is drawn, which stays over it; the towns' lamps (`lamps`, 0 to
 * 1 at each pixel) shine through all of it.
 */
export function drawModernWeather(
  scene: Scene,
  grid: WeatherGrid,
  mask: CloudMask,
  out: Surface,
  lamps: ((x: number, y: number) => number) | null = null,
): void {
  const { width, height, data } = out;
  const d = mask.density;
  const night = nightOf(scene.light.darkness);
  const lift = mask.lift;
  for (let y = 0; y < height; y++) {
    const ky = kmAtPixel(scene.camera, 0, (y + 0.5) / d, scene.width, scene.height).y;
    if (ky < 0) continue;
    for (let x = 0; x < width; x++) {
      const kx = kmAtPixel(scene.camera, (x + 0.5) / d, 0, scene.width, scene.height).x;
      const i = y * width + x;
      const through = lamps === null ? 1 : 1 - lamps(x, y);
      if (!(through > 0)) continue;
      const sx = x - lift;
      const sy = y - lift;
      const shadow = sx >= 0 && sy >= 0 && (mask.owner[sy * width + sx] ?? -1) >= 0;
      if (shadow) blend(data, i, SHADOW, (0.3 - 0.12 * night) * through);
      else {
        const here = weatherAt(grid, kx, ky);
        if (here !== null && here.group !== "fog")
          blend(
            data,
            i,
            SHADOW,
            Math.max(0, (here.cover - 0.7) / 0.3) * (here.group === "storm" ? 0.2 : 0.1) * through,
          );
      }
      const fog = fogAt(grid, kx, ky);
      if (fog > 0.3) {
        const t = Math.min(1, (fog - 0.3) / 0.4);
        blend(data, i, mixRgb(FOG_DAY, FOG_NIGHT, night), t * t * (3 - 2 * t) * 0.85 * through);
      }
    }
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const index = mask.owner[i] ?? -1;
      const cloud = index < 0 ? undefined : mask.clouds[index];
      if (cloud === undefined) continue;
      const [body, lit, shade] = CLOUDS[kindOf(cloud.group)];
      const part = cloudPart(mask, x, y);
      const colour = part === "lit" ? lit : part === "shade" ? shade : body;
      // At night a cloud takes the night's blue, as the land does.
      const shown = mixRgb(colour, [colour[0] * 0.26, colour[1] * 0.3, colour[2] * 0.44], night);
      const edge = Math.min(1, (mask.depth[i] ?? 0) * 6);
      const through = lamps === null ? 1 : 1 - lamps(x, y);
      blend(data, i, shown, 0.92 * edge * edge * (3 - 2 * edge) * through);
    }
}

/**
 * Rain, snow and lightning at `seconds` of animation, into `target` (a copy of the
 * still frame).
 */
export function animateModernWeather(
  scene: Scene,
  grid: WeatherGrid,
  mask: CloudMask,
  target: Surface,
  seconds: number,
): void {
  const d = mask.density;
  const night = nightOf(scene.light.darkness);
  const rain = mixRgb(RAIN_DAY, RAIN_NIGHT, night);
  const snow = mixRgb(SNOW_DAY, SNOW_NIGHT, night);
  const { width, data } = target;
  eachDrop(
    grid,
    scene.width,
    scene.height,
    (x, y) => kmAtPixel(scene.camera, x + 0.5, y + 0.5, scene.width, scene.height),
    seconds,
    (x, y, group) => {
      const px = x * d;
      const py = y * d;
      // Between the clouds only: under one, the rain is hidden.
      if ((mask.owner[py * width + px] ?? -1) >= 0) return;
      if (group === "snow") {
        for (let j = 0; j < d; j++)
          for (let k = 0; k < d; k++) blend(data, (py + j) * width + px + k, snow, 0.9);
      } else
        for (let j = 0; j < d; j++)
          blend(data, (py + j) * width + px + (d >> 1), rain, group === "drizzle" ? 0.4 : 0.6);
    },
  );
  for (const [x, y] of lightning(mask, seconds))
    for (let j = 0; j < d; j++)
      for (let k = 0; k < d; k++) {
        const px = x * d + k;
        const py = y * d + j;
        if (px >= 0 && py >= 0 && px < width && py < target.height)
          blend(data, py * width + px, BOLT, 1);
      }
}
