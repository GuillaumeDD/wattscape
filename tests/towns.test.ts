import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH, recordedTownLights } from "../e2e/reference-frames";
import {
  type Eco2mixReading,
  REGION_CODES,
  type RegionalReadings,
  STALE_AFTER_MS,
} from "../src/data/eco2mix";
import { CONSUMPTION_PERIOD, CONSUMPTION_RANGES } from "../src/map/consumption";
import { CORSICA, KIND_COUNT, kindOfRegion } from "../src/map/grid";
import { coarseLayer, fineLayer } from "../src/map/layers";
import { FINE_ELEVATION_RLE } from "../src/map/relief";
import { PALETTE } from "../src/render/palette";
import { drawPixelScene, LAMPS_FLOOR, lampLevels } from "../src/render/pixel-theme";
import { createSurface } from "../src/render/surface";
import { areaBox, fitBox } from "../src/scene/camera";
import {
  prefectureTowns,
  type Scene,
  type TownLights,
  townLightOf,
  townLights,
} from "../src/scene/scene";
import { lightAt } from "../src/sky/light";

const reading = (mw: number, timeMs = 0): Eco2mixReading =>
  ({ area: "28", timeMs, consumptionMw: mw }) as unknown as Eco2mixReading;
const range = { p5: 2000, p95: 3000 };

describe("townLightOf (ARCHITECTURE § Data-to-scene mapping)", () => {
  it("places consumption in its range: 0 at the 5th percentile, 1 at the 95th", () => {
    expect(townLightOf(reading(2000), range)).toBe(0);
    expect(townLightOf(reading(2500), range)).toBe(0.5);
    expect(townLightOf(reading(3000), range)).toBe(1);
    expect(townLightOf(reading(1200), range)).toBe(0);
    expect(townLightOf(reading(9000), range)).toBe(1);
  });

  it("gives no figure without a reading, a range, or with absurd numbers", () => {
    expect(townLightOf(undefined, range)).toBeNull();
    expect(townLightOf(reading(2500), undefined)).toBeNull();
    expect(townLightOf(reading(Number.NaN), range)).toBeNull();
    expect(townLightOf(reading(2500), { p5: 3000, p95: 3000 })).toBeNull();
    expect(townLightOf(reading(2500), { p5: 3000, p95: 2000 })).toBeNull();
    expect(townLightOf(reading(2500), { p5: Number.NaN, p95: 3000 })).toBeNull();
  });
});

describe("townLights", () => {
  const readings = (r: Eco2mixReading): RegionalReadings => ({
    timeMs: r.timeMs,
    byRegion: { "28": r },
  });
  const now = 10 * STALE_AFTER_MS;

  it("lights each region from its own reading, and leaves the others out", () => {
    expect(townLights(readings(reading(2500, now)), { "28": range }, now)).toEqual({ "28": 0.5 });
    expect(townLights(null, { "28": range }, now)).toEqual({});
  });

  it("shows nothing for a step dated in the future, and still shows a stale one", () => {
    expect(townLights(readings(reading(2500, now + 20 * 60_000)), { "28": range }, now)).toEqual(
      {},
    );
    expect(
      townLights(readings(reading(2500, now - 2 * STALE_AFTER_MS)), { "28": range }, now),
    ).toEqual({ "28": 0.5 });
  });

  it("gives every region a figure from the recorded steps, inside 0–1", () => {
    for (const night of [false, true]) {
      const lights = recordedTownLights(night);
      expect(Object.keys(lights).sort()).toEqual([...REGION_CODES].sort());
      for (const v of Object.values(lights)) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(lights)) expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("the baked ranges (DS-12, src/map/consumption.ts)", () => {
  it("cover every region over twelve months, low below high", () => {
    expect(CONSUMPTION_PERIOD).toEqual({ from: "2025-09-01", to: "2026-09-01" });
    for (const region of REGION_CODES) {
      const { p5, p95 } = CONSUMPTION_RANGES[region];
      expect(p5, region).toBeGreaterThan(500);
      expect(p95, region).toBeGreaterThan(p5);
      expect(p95, region).toBeLessThan(20_000);
    }
    // Île-de-France consumes the most.
    const top = REGION_CODES.reduce((a, b) =>
      CONSUMPTION_RANGES[a].p95 >= CONSUMPTION_RANGES[b].p95 ? a : b,
    );
    expect(top).toBe("11");
  });
});

describe("lampLevels", () => {
  it("lights 4 to 16 pixels of 16 with the light, none without a figure", () => {
    const levels = lampLevels({ townLights: { "28": 0, "53": 0.5, "84": 1 } });
    expect(levels).toHaveLength(KIND_COUNT);
    expect(levels[kindOfRegion("28")]).toBe(LAMPS_FLOOR);
    expect(levels[kindOfRegion("53")]).toBe(10);
    expect(levels[kindOfRegion("84")]).toBe(16);
    expect(levels[kindOfRegion("11")]).toBe(-1);
    // Corsica is not in the regional éCO2mix: its towns never light up.
    expect(levels[kindOfRegion(CORSICA)]).toBe(-1);
  });
});

describe("the towns at night (src/render/pixel-theme.ts)", () => {
  const coarse = coarseLayer();
  const fine = fineLayer(FINE_ELEVATION_RLE);
  const camera = fitBox(areaBox(coarse, "11"), FRAME_WIDTH, FRAME_HEIGHT);
  const count = (lights: TownLights, elevation: number, colour: keyof typeof PALETTE): number => {
    const scene: Scene = {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      camera,
      light: lightAt(elevation),
      focus: "11",
      coarse,
      fine,
      detail: 16,
      towns: prefectureTowns(),
      plants: [],
      townLights: lights,
    };
    const out = createSurface(FRAME_WIDTH, FRAME_HEIGHT);
    drawPixelScene(scene, out);
    const [r, g, b] = PALETTE[colour];
    let n = 0;
    for (let i = 0; i < out.data.length; i += 4)
      if (out.data[i] === r && out.data[i + 1] === g && out.data[i + 2] === b) n++;
    return n;
  };
  const all = (v: number): TownLights => Object.fromEntries(REGION_CODES.map((r) => [r, v]));

  it("light more windows the more the region consumes", () => {
    const low = count(all(0), -20, "lamp");
    const mid = count(all(0.5), -20, "lamp");
    const high = count(all(1), -20, "lamp");
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("show no lamps without a figure, nor by day", () => {
    expect(count({}, -20, "lamp")).toBe(0);
    expect(count(all(1), 35, "lamp")).toBe(0);
  });
});
