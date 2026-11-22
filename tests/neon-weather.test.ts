import { describe, expect, it } from "vitest";
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  referenceScene,
  snowWeather,
  WEATHER_TIME_MS,
} from "../e2e/reference-frames";
import { coarseLayer } from "../src/map/layers";
import { drawNeonScene, NEON_CONTOUR } from "../src/render/neon-theme";
import {
  animateNeonWeather,
  cloudLine,
  drawNeonWeather,
  NEON_CLOUD_LINES,
  NEON_SEASON_LINES,
} from "../src/render/neon-weather";
import { createSurface, type Surface } from "../src/render/surface";
import { type CloudMask } from "../src/render/weather-art";
import { areaBox, fitBox } from "../src/scene/camera";
import { type WeatherGrid } from "../src/scene/clouds";
import { type Scene } from "../src/scene/scene";
import { type SeasonState } from "../src/scene/season";
import { type WeatherGroup } from "../src/data/open-meteo";

const D = 2;
const W = FRAME_WIDTH * D;
const H = FRAME_HEIGHT * D;
const scene: Scene = referenceScene(null, { x: 400, y: 400, scale: 1 }, 35);

/** One cell of weather over everything, as far as the grid reaches. */
const gridOf = (group: WeatherGroup, fog = 0): WeatherGrid => ({
  columns: 1,
  rows: 1,
  groups: [group],
  cover: new Float32Array([1]),
  fog: new Float32Array([fog]),
  lowness: new Float32Array([1]),
  windEast: 0,
  windSouth: 0,
});

/** A mask with one cloud over the box [x0, x1) × [y0, y1), its depth growing inwards. */
function maskOf(
  group: WeatherGroup,
  box: readonly [number, number, number, number] | null,
  bolts: readonly (readonly [number, number])[] = [],
): CloudMask {
  const owner = new Int32Array(W * H).fill(-1);
  const depth = new Float32Array(W * H);
  if (box !== null) {
    const [x0, y0, x1, y1] = box;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        owner[y * W + x] = 0;
        depth[y * W + x] = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y) / 40;
      }
  }
  return {
    width: W,
    height: H,
    density: D,
    clouds: [{ lobes: [], group, id: 0 }],
    owner,
    depth,
    lift: 0,
    bolts,
  };
}

function grey(): Surface {
  const s = createSurface(W, H);
  for (let i = 0; i < s.data.length; i += 4) {
    s.data[i] = 40;
    s.data[i + 1] = 40;
    s.data[i + 2] = 40;
    s.data[i + 3] = 255;
  }
  return s;
}
const px = (s: Surface, x: number, y: number): [number, number, number] => {
  const i = (y * W + x) * 4;
  return [s.data[i] ?? 0, s.data[i + 1] ?? 0, s.data[i + 2] ?? 0];
};

describe("cloudLine", () => {
  it("is brightest on a cloud's edge and falls inwards, never below 0", () => {
    let last = Infinity;
    for (let depth = 0; depth <= 1; depth += 0.01) {
      const k = cloudLine(depth, D);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(last + 1e-12);
      last = k;
    }
    expect(cloudLine(0, D)).toBeGreaterThan(5 * cloudLine(0.5, D));
  });
});

describe("drawNeonWeather", () => {
  it("draws a cloud as a line of light in its group's colour, its heart a light veil", () => {
    const out = grey();
    drawNeonWeather(scene, gridOf("clear"), maskOf("rain", [100, 100, 300, 300]), out);
    const [r, g, b] = px(out, 100, 200);
    const rain = NEON_CLOUD_LINES.rain;
    expect(b).toBeGreaterThan(40 + rain[2] * 0.5);
    expect(b - r).toBeGreaterThan(0);
    const heart = px(out, 200, 200);
    expect(heart[0]).toBeLessThan(40);
    expect(heart[0]).toBeGreaterThan(40 * 0.75);
    // Outside the cloud, nothing changes.
    expect(px(out, 50, 50)).toEqual([40, 40, 40]);
    expect(g).toBeGreaterThan(40);
  });

  it("lays fog as scan lines, one scene row in three, and nothing without fog", () => {
    const foggy = grey();
    drawNeonWeather(scene, gridOf("fog", 1), maskOf("fog", null), foggy);
    let lit = 0;
    let dark = 0;
    for (let y = 0; y < H; y++) {
      const changed = px(foggy, W >> 1, y)[2] > 40;
      if (Math.floor(y / D) % 3 === 0) lit += changed ? 1 : 0;
      else dark += changed ? 1 : 0;
    }
    expect(lit).toBeGreaterThan(H / 3 / 2);
    expect(dark).toBe(0);
    const clear = grey();
    drawNeonWeather(scene, gridOf("fog", 0), maskOf("fog", null), clear);
    expect(clear.data.every((v, i) => i % 4 === 3 || v === 40)).toBe(true);
  });
});

describe("animateNeonWeather", () => {
  /** How many pixels changed, left and right of the middle. */
  function changed(s: Surface): [number, number] {
    let left = 0;
    let right = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (px(s, x, y)[2] !== 40) {
          if (x < W / 2) left++;
          else right++;
        }
    return [left, right];
  }
  it("lets rain fall between the clouds only", () => {
    const out = grey();
    animateNeonWeather(scene, gridOf("rain"), maskOf("rain", [0, 0, W / 2, H]), out, 1.3);
    const [left, right] = changed(out);
    expect(left).toBe(0);
    expect(right).toBeGreaterThan(100);
  });
  it("lets snow fall as dots of light, and draws nothing in fair weather", () => {
    const snow = grey();
    animateNeonWeather(scene, gridOf("snow"), maskOf("snow", null), snow, 1.3);
    expect(changed(snow)[1]).toBeGreaterThan(20);
    const fair = grey();
    animateNeonWeather(scene, gridOf("clear"), maskOf("clear", null), fair, 1.3);
    expect(changed(fair)).toEqual([0, 0]);
  });
  it("lights a bolt during a flash only", () => {
    const bolts = [[FRAME_WIDTH / 2, 20]] as const;
    const flash = grey();
    animateNeonWeather(scene, gridOf("clear"), maskOf("storm", null, bolts), flash, 0.1);
    expect(px(flash, W / 2, 40 + 4)[0]).toBeGreaterThan(200);
    const after = grey();
    animateNeonWeather(scene, gridOf("clear"), maskOf("storm", null, bolts), after, 1);
    expect(changed(after)).toEqual([0, 0]);
  });
});

describe("the neon seasons and snow", () => {
  it("gives each season its own line colour, summer's the theme's violet", () => {
    expect(NEON_SEASON_LINES.summer).toEqual(NEON_CONTOUR);
    const keys = Object.values(NEON_SEASON_LINES).map((c) => c.join());
    expect(new Set(keys).size).toBe(4);
  });

  const camera = fitBox(areaBox(coarseLayer(), "84"), FRAME_WIDTH, FRAME_HEIGHT);
  const draw = (season: SeasonState, extra: Partial<Scene> = {}): Surface => {
    const out = createSurface(W, H);
    drawNeonScene({ ...referenceScene("84", camera, 35), season, ...extra }, out);
    return out;
  };
  /** How many pixels are much redder than blue: amber contour light. */
  const amber = (s: Surface): number => {
    let n = 0;
    for (let i = 0; i < s.data.length; i += 4)
      if ((s.data[i] ?? 0) > (s.data[i + 2] ?? 0) + 30) n++;
    return n;
  };

  it("turns the contours amber in autumn, and halfway in a turn", () => {
    const summer = amber(draw({ from: "summer", to: "summer", share: 0 }));
    const turning = amber(draw({ from: "summer", to: "autumn", share: 0.5 }));
    const autumn = amber(draw({ from: "autumn", to: "autumn", share: 0 }));
    expect(turning).toBeGreaterThan(summer);
    expect(autumn).toBeGreaterThan(turning);
  });

  it("keeps the snow on the ground when the sky's weather is hidden (D-072)", () => {
    const winter = { from: "winter", to: "winter", share: 0 } as const;
    const bright = (s: Surface): number => s.data.reduce((a, v, i) => (i % 4 === 3 ? a : a + v), 0);
    const bare = bright(draw(winter, { weatherHidden: true }));
    const snowy = bright(
      draw(winter, { weather: snowWeather(true), timeMs: WEATHER_TIME_MS, weatherHidden: true }),
    );
    expect(snowy).toBeGreaterThan(bare * 1.05);
  });
});
