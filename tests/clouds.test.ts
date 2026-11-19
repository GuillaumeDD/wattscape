import { describe, expect, it } from "vitest";
import { REGION_CODES, type RegionCode } from "../src/data/eco2mix";
import { type WeatherGroup, type WeatherReading } from "../src/data/open-meteo";
import { kmOf, SEA, FOREIGN, kindOfRegion, COARSE_KM } from "../src/map/grid";
import { coarseLayer } from "../src/map/layers";
import { areaBox, fitBox } from "../src/scene/camera";
import {
  anyPrecipitation,
  cloudLift,
  cloudsOver,
  cloudZoom,
  fogAt,
  MAX_CHANCE,
  nearestRegions,
  SEA_REACH_CELLS,
  viewBox,
  weatherAt,
  weatherGrid,
} from "../src/scene/clouds";
import { overrideWeather, type RegionalWeather } from "../src/scene/weather";
import { cloudMask, eachDrop, FLASH_EVERY_S, FLASH_S, lightning } from "../src/render/weather-art";

const coarse = coarseLayer();
const T = Date.UTC(2026, 10, 12, 9, 45);
const W = 480;
const H = 270;

/** Every region under the same weather, with a cover of `cover` % and a wind. */
function everywhere(
  group: WeatherGroup,
  cover?: number,
  wind?: { speed: number; from: number },
): RegionalWeather {
  const out: Partial<Record<RegionCode, WeatherReading>> = {};
  for (const [r, reading] of Object.entries(overrideWeather(group, T)) as [
    RegionCode,
    WeatherReading,
  ][])
    out[r] = {
      ...reading,
      ...(cover === undefined ? {} : { cloudCoverPct: cover }),
      ...(wind === undefined ? {} : { windSpeedKmh: wind.speed, windFromDeg: wind.from }),
    };
  return out;
}

/** One region under a weather, the others with none. */
function only(region: RegionCode, group: WeatherGroup): RegionalWeather {
  const reading = overrideWeather(group, T)[region];
  return reading === undefined ? {} : { [region]: reading };
}

const cellAt = (latitude: number, longitude: number): number => {
  const k = kmOf(latitude, longitude);
  return Math.floor(k.y / COARSE_KM) * coarse.columns + Math.floor(k.x / COARSE_KM);
};

describe("nearestRegions: whose reading covers a cell", () => {
  const regions = nearestRegions(coarse);

  it("gives a land cell its own region", () => {
    for (let i = 0; i < coarse.columns * coarse.rows; i += 97) {
      const kind = coarse.kinds[i] ?? SEA;
      if (kind < 2) continue;
      const own = REGION_CODES.find((r) => kindOfRegion(r) === kind);
      expect(regions[i]).toBe(own ?? null); // Corsica: none
    }
  });

  it("reaches the sea only within SEA_REACH_CELLS of a region's coast, and never abroad", () => {
    // The Channel off Étretat: Normandie's; mid-Atlantic, far from any coast: none.
    expect(regions[cellAt(49.9, 0.2)]).toBe("28");
    expect(regions[cellAt(46.0, -5.3)]).toBeNull();
    for (let i = 0; i < coarse.columns * coarse.rows; i++) {
      if ((coarse.kinds[i] ?? SEA) === FOREIGN) expect(regions[i]).toBeNull();
      if ((coarse.kinds[i] ?? SEA) !== SEA || regions[i] === null) continue;
      // A sea cell with a region has land of that region within the reach.
      const x = i % coarse.columns;
      const y = (i - x) / coarse.columns;
      let found = false;
      for (let dy = -SEA_REACH_CELLS; dy <= SEA_REACH_CELLS && !found; dy++)
        for (let dx = -SEA_REACH_CELLS; dx <= SEA_REACH_CELLS && !found; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > SEA_REACH_CELLS) continue;
          const j = (y + dy) * coarse.columns + x + dx;
          if (regions[j] === regions[i] && (coarse.kinds[j] ?? SEA) !== SEA) found = true;
        }
      expect(found, `cell ${String(i)}`).toBe(true);
    }
  });

  it("gives Corsica no reading (no regional data)", () => {
    expect(regions[cellAt(42.15, 9.1)]).toBeNull();
  });
});

describe("weatherGrid and weatherAt", () => {
  it("is null without a reading, so nothing is drawn", () => {
    expect(weatherGrid(coarse, {})).toBeNull();
  });

  it("is built once per set of readings", () => {
    const w = everywhere("rain");
    expect(weatherGrid(coarse, w)).toBe(weatherGrid(coarse, w));
  });

  it("gives each point its region's group, and none where that region has no reading", () => {
    const grid = weatherGrid(coarse, only("28", "rain"));
    if (grid === null) throw new Error("no grid");
    const rouen = kmOf(49.44, 1.09);
    const paris = kmOf(48.86, 2.35);
    expect(weatherAt(grid, rouen.x, rouen.y)?.group).toBe("rain");
    expect(weatherAt(grid, paris.x, paris.y)).toBeNull();
    expect(weatherAt(grid, -1, 10)).toBeNull();
  });

  it("smooths the cover across a border, so a sky does not end on a line", () => {
    const w: RegionalWeather = { ...everywhere("cloudy", 0), ...only("28", "cloudy") };
    const grid = weatherGrid(coarse, w);
    if (grid === null) throw new Error("no grid");
    const inside = kmOf(49.1, 0.3); // the Pays d'Auge, well inside Normandie
    const far = kmOf(45.0, 2.0); // the Massif central
    expect(weatherAt(grid, inside.x, inside.y)?.cover).toBeCloseTo(1, 5);
    expect(weatherAt(grid, far.x, far.y)?.cover).toBe(0);
    // Somewhere across the border with Île-de-France, the cover is between the two.
    let between = false;
    const a = kmOf(49.1, 1.3);
    for (let x = a.x; x < a.x + 80; x += 2) {
      const c = weatherAt(grid, x, a.y)?.cover ?? -1;
      if (c > 0.05 && c < 0.95) between = true;
    }
    expect(between).toBe(true);
  });
});

describe("fogAt", () => {
  const fog = weatherGrid(coarse, everywhere("fog"));
  if (fog === null) throw new Error("no grid");

  it("is none without a fog reading", () => {
    const grid = weatherGrid(coarse, everywhere("cloudy"));
    if (grid === null) throw new Error("no grid");
    const k = kmOf(47.3, 5.0); // the Saône plain
    expect(fogAt(grid, k.x, k.y)).toBe(0);
  });

  it("lies on low ground, not at sea nor on the mountains", () => {
    const plain = kmOf(47.0, 5.0); // the Saône plain, about 200 m
    const sea = kmOf(45.5, -5.0); // the open Atlantic
    const alps = kmOf(44.92, 6.36); // the Barre des Écrins
    expect(fogAt(fog, plain.x, plain.y)).toBeGreaterThan(0);
    expect(fogAt(fog, sea.x, sea.y)).toBe(0);
    expect(fogAt(fog, alps.x, alps.y)).toBe(0);
  });

  it("stays between 0 and 1", () => {
    for (let y = 0; y < coarse.rows * COARSE_KM; y += 37)
      for (let x = 0; x < coarse.columns * COARSE_KM; x += 41) {
        const f = fogAt(fog, x, y);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
  });
});

const normandie = fitBox(areaBox(coarse, "28"), W, H);
const france = fitBox(areaBox(coarse, null), W, H);

/** The share of the view's pixels a cloud covers. */
function covered(weather: RegionalWeather, timeMs = T): number {
  const grid = weatherGrid(coarse, weather);
  if (grid === null) return 0;
  const mask = cloudMask(grid, normandie, W, H, 1, timeMs);
  return mask.owner.filter((o) => o >= 0).length / mask.owner.length;
}

describe("cloudsOver", () => {
  it("makes no cloud under a clear sky, and none in a fog", () => {
    expect(covered(everywhere("clear"))).toBe(0);
    expect(covered(everywhere("fog"))).toBe(0);
  });

  it("covers more of the ground as the cover grows, never all of it", () => {
    const shares = [10, 30, 50, 70, 100].map((c) => covered(everywhere("cloudy", c)));
    for (let i = 1; i < shares.length; i++)
      expect(shares[i] ?? 0).toBeGreaterThan(shares[i - 1] ?? 0);
    // Even overcast, the map shows through: MAX_CHANCE caps how many clouds form.
    expect(shares[4]).toBeLessThan(0.9);
    expect(shares[4]).toBeGreaterThan(0.25);
    expect(MAX_CHANCE).toBeLessThan(1);
  });

  it("gives the same clouds for the same readings and time", () => {
    const grid = weatherGrid(coarse, everywhere("cloudy", 60));
    if (grid === null) throw new Error("no grid");
    const box = viewBox(normandie, W, H);
    expect(cloudsOver(grid, box, 1, T)).toEqual(cloudsOver(grid, box, 1, T));
  });

  it("moves every cloud downwind with time, keeping its shape", () => {
    // 20 km/h from the west: an hour later, every cloud is 20 km further east.
    const grid = weatherGrid(coarse, everywhere("cloudy", 60, { speed: 20, from: 270 }));
    if (grid === null) throw new Error("no grid");
    expect(grid.windEast).toBe(20);
    expect(grid.windSouth).toBe(0);
    const box = { left: 520, top: 440, right: 680, bottom: 600 }; // the Massif central, far from the sea
    const before = cloudsOver(grid, box, 1, T);
    const after = cloudsOver(grid, box, 1, T + 3_600_000);
    const byId = new Map(after.map((c) => [c.id, c]));
    let matched = 0;
    for (const c of before) {
      const moved = byId.get(c.id);
      if (moved === undefined) continue;
      const a = c.lobes[0];
      const b = moved.lobes[0];
      if (a === undefined || b === undefined) continue;
      // Clouds that changed cell weather on the way may differ; most keep their shape.
      if (moved.lobes.length !== c.lobes.length) continue;
      expect(b.x - a.x).toBeCloseTo(20, 6);
      expect(b.y - a.y).toBeCloseTo(0, 6);
      expect(b.r).toBeCloseTo(a.r, 6);
      matched++;
    }
    expect(matched).toBeGreaterThan(5);
  });

  it("blows the clouds to the nearest of 8 compass points, exactly", () => {
    const wind = (speed: number, from: number): [number, number] => {
      const grid = weatherGrid(coarse, everywhere("cloudy", 60, { speed, from }));
      if (grid === null) throw new Error("no grid");
      return [grid.windEast, grid.windSouth];
    };
    expect(wind(20, 0)).toEqual([0, 20]); // from the north: to the south
    expect(wind(20, 90)).toEqual([-20, 0]);
    expect(wind(20, 180)).toEqual([0, -20]);
    expect(wind(20, 280)).toEqual([20, 0]);
    // 12.5 km/h from the west: 2.5 steps of 5 km/h, rounded up on every engine.
    expect(wind(12.5, 270)).toEqual([15, 0]);
    // From the north-west, 20 km/h: 14.14 km/h each way, so 15.
    expect(wind(20, 315)).toEqual([15, 15]);
    expect(wind(20, 359)).toEqual([0, 20]);
  });

  it("leaves the clouds where they are without wind", () => {
    const grid = weatherGrid(coarse, everywhere("cloudy", 60, { speed: 0, from: 0 }));
    if (grid === null) throw new Error("no grid");
    const box = viewBox(normandie, W, H);
    expect(cloudsOver(grid, box, 1, T + 7_200_000)).toEqual(cloudsOver(grid, box, 1, T));
  });

  it("makes clouds where a reading is only: none abroad", () => {
    const grid = weatherGrid(coarse, everywhere("cloudy", 100));
    if (grid === null) throw new Error("no grid");
    for (const c of cloudsOver(grid, viewBox(france, W, H), cloudZoom(france.scale), T)) {
      const centre = c.lobes[0];
      if (centre === undefined) continue;
      expect(weatherAt(grid, centre.x, centre.y)).not.toBeNull();
    }
  });
});

describe("cloudZoom and cloudLift", () => {
  it("grows the clouds only when zoomed out", () => {
    expect(cloudZoom(2)).toBe(1);
    expect(cloudZoom(0.9)).toBe(1);
    expect(cloudZoom(0.3)).toBeCloseTo(3, 10);
  });

  it("keeps the same clouds while the camera zooms within a level", () => {
    // From 0.35 to 0.34 pixel per km the zoom stays 3: the clouds stay put on the ground.
    expect(cloudZoom(0.35)).toBe(cloudZoom(0.34));
    const grid = weatherGrid(coarse, everywhere("cloudy", 60));
    if (grid === null) throw new Error("no grid");
    const box = { left: 300, top: 200, right: 500, bottom: 400 };
    expect(cloudsOver(grid, box, cloudZoom(0.34), T)).toEqual(
      cloudsOver(grid, box, cloudZoom(0.35), T),
    );
    // A few levels only, each the nearest by ratio to 0.9 / scale.
    const levels = new Set<number>();
    for (let s = 0.15; s <= 8; s *= 1.01) levels.add(cloudZoom(s));
    expect([...levels].sort((a, b) => a - b)).toEqual([1, 1.5, 2, 3, 4, 6]);
    expect(cloudZoom(0.9 / 2.4)).toBe(2);
    expect(cloudZoom(0.9 / 2.5)).toBe(3);
  });

  it("floats the clouds 3 to 10 pixels over their shadow", () => {
    for (const s of [0.15, 0.5, 1, 2, 4, 8]) {
      expect(cloudLift(s)).toBeGreaterThanOrEqual(3);
      expect(cloudLift(s)).toBeLessThanOrEqual(10);
    }
  });
});

describe("anyPrecipitation", () => {
  it("looks only at the view: rain in the Alps does not move a frame of Normandie", () => {
    const grid = weatherGrid(coarse, only("84", "rain"));
    if (grid === null) throw new Error("no grid");
    expect(anyPrecipitation(grid, viewBox(normandie, W, H))).toBe(false);
    expect(anyPrecipitation(grid, viewBox(france, W, H))).toBe(true);
    const cloudy = weatherGrid(coarse, everywhere("cloudy"));
    if (cloudy === null) throw new Error("no grid");
    expect(anyPrecipitation(cloudy, viewBox(france, W, H))).toBe(false);
  });
});

describe("cloudMask", () => {
  it("stays anchored to the ground when the camera moves by less than a pixel", () => {
    const grid = weatherGrid(coarse, everywhere("cloudy", 70));
    if (grid === null) throw new Error("no grid");
    const s = normandie.scale;
    // Two cameras whose frames round to the same whole-pixel offsets.
    const a = { ...normandie, x: (Math.round(normandie.x * s) + 0.1) / s };
    const b = { ...normandie, x: (Math.round(normandie.x * s) + 0.4) / s };
    expect(cloudMask(grid, a, W, H, 1, T).owner).toEqual(cloudMask(grid, b, W, H, 1, T).owner);
  });
});

describe("eachDrop", () => {
  const kmAt = (x: number, y: number): { x: number; y: number } => ({
    x: normandie.x + (x - W / 2) / normandie.scale,
    y: normandie.y + (2 * (y - H / 2)) / normandie.scale,
  });
  const drops = (weather: RegionalWeather, seconds: number): [number, number, WeatherGroup][] => {
    const grid = weatherGrid(coarse, weather);
    if (grid === null) return [];
    const out: [number, number, WeatherGroup][] = [];
    eachDrop(grid, W, H, kmAt, seconds, (x, y, g) => out.push([x, y, g]));
    return out;
  };

  it("lets nothing fall from a clear, cloudy or foggy sky", () => {
    for (const g of ["clear", "cloudy", "fog"] as const)
      expect(drops(everywhere(g), 1)).toHaveLength(0);
  });

  it("drops rain where it rains and snow where it snows, on the view only", () => {
    const rain = drops(everywhere("rain"), 1);
    expect(rain.length).toBeGreaterThan(500);
    for (const [x, y, g] of rain) {
      expect(g).toBe("rain");
      expect(x >= 0 && x < W && y >= 0 && y < H).toBe(true);
    }
    const snow = drops(everywhere("snow"), 1);
    expect(snow.length).toBeGreaterThan(100);
    for (const [, , g] of snow) expect(g).toBe("snow");
  });

  it("drops it only over the region whose reading says so", () => {
    const grid = weatherGrid(coarse, only("28", "rain"));
    if (grid === null) throw new Error("no grid");
    for (const [x, y] of drops(only("28", "rain"), 1)) {
      const k = kmAt(x, y);
      expect(weatherAt(grid, k.x, k.y)?.group).toBe("rain");
    }
  });

  it("falls with time, and is the same at the same time", () => {
    expect(drops(everywhere("rain"), 1.3)).toEqual(drops(everywhere("rain"), 1.3));
    expect(drops(everywhere("rain"), 1.3)).not.toEqual(drops(everywhere("rain"), 1.4));
  });

  it("is denser in a storm than in rain, and sparser in drizzle", () => {
    const n = (g: WeatherGroup): number => drops(everywhere(g), 1).length;
    expect(n("storm")).toBeGreaterThan(n("rain"));
    expect(n("drizzle")).toBeLessThan(n("rain"));
  });
});

describe("lightning", () => {
  const maskOf = (weather: RegionalWeather) => {
    const grid = weatherGrid(coarse, weather);
    if (grid === null) throw new Error("no grid");
    return cloudMask(grid, normandie, W, H, 1, T);
  };

  it("never strikes without a storm", () => {
    const mask = maskOf(everywhere("rain"));
    for (let s = 0; s < 30; s += 0.05) expect(lightning(mask, s)).toHaveLength(0);
  });

  it("flashes in a storm for FLASH_S of every FLASH_EVERY_S seconds, from a storm cloud down", () => {
    const mask = maskOf(everywhere("storm"));
    for (let k = 0; k < 5; k++) {
      const bolt = lightning(mask, k * FLASH_EVERY_S + FLASH_S / 2);
      expect(bolt.length).toBeGreaterThan(0);
      const [x0, y0] = bolt[0] ?? [0, 0];
      const cloud = mask.clouds[mask.owner[y0 * W + x0] ?? -1];
      expect(cloud?.group).toBe("storm");
      // It goes down, one row a step.
      bolt.forEach(([, y], i) => {
        expect(y).toBe(y0 + i);
      });
      expect(lightning(mask, k * FLASH_EVERY_S + FLASH_S + 0.01)).toHaveLength(0);
    }
  });
});
