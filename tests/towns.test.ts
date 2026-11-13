import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH, recordedTownLights } from "../e2e/reference-frames";
import {
  type Eco2mixReading,
  REGION_CODES,
  type RegionalReadings,
  STALE_AFTER_MS,
} from "../src/data/eco2mix";
import { CONSUMPTION_PERIOD, CONSUMPTION_RANGES } from "../src/map/consumption";
import {
  CORSICA,
  FINE_COLUMNS,
  FINE_ROWS,
  FOREIGN,
  KIND_COUNT,
  kindOfRegion,
  kmOf,
  SEA,
} from "../src/map/grid";
import { coarseLayer, fineLayer, type TerrainLayer } from "../src/map/layers";
import { MIN_POPULATION } from "../src/map/town-rules";
import { FINE_ELEVATION_RLE } from "../src/map/relief";
import { LESSER_RIVERS_PACKED } from "../src/map/rivers-fine";
import { PALETTE } from "../src/render/palette";
import {
  drawPixelScene,
  LAMPS_FLOOR,
  lampLevels,
  TOWN_CENTRE,
  townCells,
} from "../src/render/pixel-theme";
import { createSurface } from "../src/render/surface";
import { areaBox, fitBox } from "../src/scene/camera";
import {
  bakedTowns,
  type Scene,
  type Town,
  townCellCount,
  type TownLights,
  townLightOf,
  townLights,
} from "../src/scene/scene";
import { lightAt } from "../src/sky/light";
import { mulberry32 } from "./random";

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
  const fine = fineLayer(FINE_ELEVATION_RLE, LESSER_RIVERS_PACKED);
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
      towns: bakedTowns(),
      plants: [],
      townLights: lights,
      landmarks: [],
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

describe("bakedTowns (DS-04, src/map/towns.ts)", () => {
  const towns = bakedTowns();
  const near = (lat: number, lon: number): Town | undefined => {
    const p = kmOf(lat, lon);
    return towns.find((t) => Math.hypot(t.x - p.x, t.y - p.y) < 3);
  };

  it("are the communes of 2 000 inhabitants or more, in metropolitan France", () => {
    expect(towns.length).toBeGreaterThan(5000);
    for (const t of towns) {
      expect(t.population).toBeGreaterThanOrEqual(MIN_POPULATION);
      expect(t.areaKm2).toBeGreaterThan(0);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(FINE_COLUMNS);
      expect(t.y).toBeLessThan(FINE_ROWS);
    }
  });

  it("place Le Havre, Fécamp and Rouen at their town halls, with their population", () => {
    // Town halls read on IGN's map (S-013), to the nearest 0.01°.
    expect(near(49.49, 0.11)?.population).toBeGreaterThan(160_000); // Le Havre
    expect(near(49.76, 0.37)?.population).toBeGreaterThan(17_000); // Fécamp
    expect(near(49.44, 1.09)?.population).toBeGreaterThan(110_000); // Rouen
  });
});

describe("townCellCount (D-031)", () => {
  const town = (population: number, areaKm2: number): Town => ({ x: 0, y: 0, population, areaKm2 });

  it("covers population / 4 000 km², rounded to whole cells", () => {
    expect(townCellCount(town(2000, 10), 1)).toBe(1);
    expect(townCellCount(town(166_687, 47), 1)).toBe(42); // Le Havre
    expect(townCellCount(town(166_687, 47), 4)).toBe(3);
    expect(townCellCount(town(31_000, 40), 4)).toBe(0); // under 32 000: not at 4 km
    expect(townCellCount(town(33_000, 40), 4)).toBe(1);
  });

  it("never covers more than the commune's area", () => {
    expect(townCellCount(town(2_103_778, 105.4), 1)).toBe(105); // Paris
    expect(townCellCount(town(2_103_778, 105.4), 4)).toBe(7);
  });

  it("gives a dense suburb on a small commune at least one cell", () => {
    // Boulogne-Billancourt: 119 000 inhabitants on 6.2 km², under half a 4 km cell.
    expect(townCellCount(town(119_019, 6.2), 4)).toBe(1);
    expect(townCellCount(town(119_019, 6.2), 1)).toBe(6);
  });
});

describe("townCells", () => {
  const coarse = coarseLayer();
  const fine = fineLayer(FINE_ELEVATION_RLE, LESSER_RIVERS_PACKED);
  const isLand = (layer: TerrainLayer, i: number): boolean =>
    (layer.kinds[i] ?? SEA) !== SEA && layer.kinds[i] !== FOREIGN;

  /** The naive reference: sort every land cell around the centre, take the first n. */
  function naiveCells(layer: TerrainLayer, town: Town): Set<number> {
    const n = townCellCount(town, layer.km);
    const out = new Set<number>();
    if (n === 0) return out;
    const r = Math.floor(town.y / layer.km);
    const c = Math.floor(town.x / layer.km);
    const reach = Math.round(8 / layer.km);
    const around = (cr: number, cc: number, limit: number): number[][] => {
      const list: number[][] = [];
      for (let dr = -limit; dr <= limit; dr++)
        for (let dc = -limit; dc <= limit; dc++) {
          const rr = cr + dr;
          const col = cc + dc;
          if (rr < 0 || col < 0 || rr >= layer.rows || col >= layer.columns) continue;
          if (isLand(layer, rr * layer.columns + col))
            list.push([dr * dr + dc * dc, dr, dc, rr, col]);
        }
      return list.sort(
        (a, b) =>
          (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0),
      );
    };
    const first = around(r, c, reach)[0];
    if (first === undefined) return out;
    for (const [, , , rr, col] of around(first[3] ?? 0, first[4] ?? 0, 24).slice(0, n))
      out.add((rr ?? 0) * layer.columns + (col ?? 0));
    return out;
  }

  it("agrees with the naive reference, town by town, on both layers", () => {
    const random = mulberry32(15);
    const towns = bakedTowns();
    for (const layer of [coarse, fine] as TerrainLayer[])
      for (let k = 0; k < 150; k++) {
        const town = towns[Math.floor(random() * (k < 50 ? 200 : towns.length))];
        if (town === undefined) continue;
        const cells = townCells(layer, [town]);
        const got = new Set<number>();
        cells.forEach((v, i) => {
          if (v !== 0) got.add(i);
        });
        expect([...got].sort(), `${String(layer.km)} km, ${JSON.stringify(town)}`).toEqual(
          [...naiveCells(layer, town)].sort(),
        );
      }
  });

  it("marks one chef-lieu cell per town, and only French land", () => {
    for (const layer of [coarse, fine] as TerrainLayer[]) {
      const towns = bakedTowns().slice(0, 300);
      const cells = townCells(layer, towns);
      let centres = 0;
      cells.forEach((v, i) => {
        if (v === 0) return;
        expect(isLand(layer, i), String(i)).toBe(true);
        if (v === TOWN_CENTRE) centres++;
      });
      expect(centres).toBeGreaterThan(layer.km === 1 ? 280 : 200); // a few share a cell
      expect(centres).toBeLessThanOrEqual(300);
    }
  });

  it("spreads Le Havre along the coast, never into the sea", () => {
    const havre = bakedTowns().find((t) => t.population > 160_000 && t.population < 170_000);
    expect(havre).toBeDefined();
    if (havre === undefined) return;
    const cells = townCells(fine, [havre]);
    expect(cells.reduce((n, v) => n + (v === 0 ? 0 : 1), 0)).toBe(townCellCount(havre, 1));
  });
});
