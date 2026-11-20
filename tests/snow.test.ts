/**
 * Snow on the ground (B-022, Q-45): where a reading's snow is laid, inferred from the
 * point's height, in its region or its mountain range, and how each theme draws it.
 */
import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH, referenceScene, snowWeather } from "../e2e/reference-frames";
import { type WeatherReading } from "../src/data/open-meteo";
import { elevationClass, FOREIGN, kindOfRegion, kmOf, SEA } from "../src/map/grid";
import { coarseLayer } from "../src/map/layers";
import { drawModernScene } from "../src/render/modern-theme";
import { PALETTE } from "../src/render/palette";
import { drawPixelScene } from "../src/render/pixel-theme";
import { createSurface, hashSurface, type Surface } from "../src/render/surface";
import { areaBox, fitBox } from "../src/scene/camera";
import { anySnow, snowCover, snowCoverOf, softSnow } from "../src/scene/snow";
import { type TerrainLayer } from "../src/map/layers";
import { hasSky, MASSIFS, overrideWeather, type RegionalWeather } from "../src/scene/weather";

const layer = coarseLayer();
const T = Date.UTC(2026, 0, 15, 10);
const clear = overrideWeather("clear", T);
const reading = (
  id: keyof typeof clear,
  elevationM: number,
  snowDepthM: number,
): WeatherReading => {
  const r = clear[id];
  if (r === undefined) throw new Error(`no reading for ${id}`);
  return { ...r, elevationM, snowDepthM };
};
const cells = (cover: Uint8Array | null): number[] => {
  const out: number[] = [];
  if (cover !== null) for (let i = 0; i < cover.length; i++) if (cover[i] === 1) out.push(i);
  return out;
};
const cellOf = (latitude: number, longitude: number): number => {
  const { x, y } = kmOf(latitude, longitude);
  return Math.floor(y / layer.km) * layer.columns + Math.floor(x / layer.km);
};

describe("snowCover", () => {
  it("lays no snow without a reading of snow, so a theme draws none", () => {
    expect(snowCover(layer, {})).toBeNull();
    expect(snowCover(layer, clear)).toBeNull();
    expect(snowCover(layer, { alps: reading("alps", 1676, 0) })).toBeNull();
    expect(anySnow(clear)).toBe(false);
    expect(anySnow({ jura: reading("jura", 1081, 0.01) })).toBe(true);
  });

  it("a region's snow lies on its own land at the point's height or above, nowhere else", () => {
    const lyon = reading("84", 170, 0.05);
    const laid = cells(snowCover(layer, { "84": lyon }));
    const ara = kindOfRegion("84");
    const from = elevationClass(170);
    let expected = 0;
    for (let i = 0; i < layer.kinds.length; i++)
      if (layer.kinds[i] === ara && (layer.elevation[i] ?? 0) >= from) expected++;
    expect(laid.length).toBe(expected);
    expect(laid.length).toBeGreaterThan(1000);
    for (const i of laid) {
      expect(layer.kinds[i]).toBe(ara);
      expect(layer.elevation[i] ?? 0).toBeGreaterThanOrEqual(from);
    }
  });

  it("a range's snow lies on its high ground only, joined to the point, never abroad", () => {
    const alps = cells(snowCover(layer, { alps: reading("alps", 1676, 0.8) }));
    const from = elevationClass(1676);
    expect(alps.length).toBeGreaterThan(100);
    for (const i of alps) {
      expect(layer.elevation[i] ?? 0).toBeGreaterThanOrEqual(from);
      expect(layer.kinds[i]).not.toBe(SEA);
      expect(layer.kinds[i]).not.toBe(FOREIGN);
    }
    // Not the Pyrenees, as high but not joined; Mont Blanc's side is.
    const pyrenees = new Set(cells(snowCover(layer, { pyrenees: reading("pyrenees", 1676, 0.8) })));
    expect(pyrenees.size).toBeGreaterThan(0);
    for (const i of alps) expect(pyrenees.has(i)).toBe(false);
    // Its search starts at the point: some cell within 8 km of it is under snow.
    const point = cellOf(45.5, 6.6);
    const near = (i: number): boolean =>
      Math.abs((i % layer.columns) - (point % layer.columns)) <= 2 &&
      Math.abs(Math.floor(i / layer.columns) - Math.floor(point / layer.columns)) <= 2;
    expect(alps.some(near)).toBe(true);
  });

  it("follows the point's height: a lower point lays snow on more of its range", () => {
    const low = cells(snowCover(layer, { massifCentral: reading("massifCentral", 1000, 0.3) }));
    const high = new Set(
      cells(snowCover(layer, { massifCentral: reading("massifCentral", 1400, 0.3) })),
    );
    expect(low.length).toBeGreaterThan(high.size);
    for (const i of high) expect(low).toContain(i);
    // Higher than any ground of the range: no snow at all.
    expect(snowCover(layer, { massifCentral: reading("massifCentral", 2500, 0.3) })).toBeNull();
  });

  it("puts every range's point near the high ground it stands for", () => {
    for (const m of MASSIFS) {
      const w: RegionalWeather = { [m.id]: reading(m.id, 900, 0.1) };
      expect(cells(snowCover(layer, w)).length, m.id).toBeGreaterThan(5);
    }
  });

  it("starts a range's search at its point, not on another ridge near it", () => {
    // A blank layer of French land at sea level, the Alps' point on a peak, and a
    // second peak two cells away across low ground.
    const { columns, rows } = layer;
    const kinds = new Uint8Array(columns * rows).fill(kindOfRegion("84"));
    const elevation = new Uint8Array(columns * rows);
    const synthetic: TerrainLayer = { ...layer, kinds, elevation };
    const point = cellOf(45.5, 6.6);
    const ridge = point + 2;
    elevation[ridge] = 10;
    const w = { alps: reading("alps", 1676, 0.5) };
    // The point's own cell is high enough: only it is under snow.
    elevation[point] = 10;
    expect(cells(snowCover(synthetic, w))).toEqual([point]);
    // It is lower than the point (a point on a slope): the ground near it is searched.
    elevation[point] = 0;
    expect(cells(snowCover(synthetic, w))).toEqual([ridge]);
  });

  it("softens the snow's edge in France, never abroad", () => {
    const cover = snowCover(layer, { alps: reading("alps", 1676, 0.8) });
    if (cover === null) throw new Error("no snow");
    const soft = softSnow(layer, cover);
    let edge = 0;
    for (let i = 0; i < cover.length; i++) {
      if (layer.kinds[i] === FOREIGN) expect(soft[i]).toBe(0);
      else if (cover[i] === 1) expect(soft[i]).toBeGreaterThanOrEqual(0.5);
      else if ((soft[i] ?? 0) > 0) edge++;
      expect(soft[i]).toBeLessThanOrEqual(1);
    }
    expect(edge).toBeGreaterThan(0);
  });

  it("is the same cover each time, and kept for the same readings", () => {
    const w = snowWeather(true);
    expect(cells(snowCover(layer, w))).toEqual(cells(snowCover(layer, w)));
    expect(snowCoverOf(layer, w)).toBe(snowCoverOf(layer, w));
  });
});

describe("hasSky", () => {
  it("counts the regions' readings only: a range's lays snow but makes no clouds", () => {
    expect(hasSky({})).toBe(false);
    expect(hasSky({ alps: reading("alps", 1676, 0.8) })).toBe(false);
    expect(hasSky({ "84": reading("84", 170, 0) })).toBe(true);
  });
});

describe("the snow in each theme", () => {
  const camera = fitBox(areaBox(coarseLayer(), "84"), FRAME_WIDTH, FRAME_HEIGHT);
  const scene = (weather: RegionalWeather) => ({
    ...referenceScene("84", camera, 35),
    season: { from: "winter", to: "winter", share: 0 } as const,
    weather,
    timeMs: T,
  });
  const count = (s: Surface, colour: readonly number[]): number => {
    let n = 0;
    for (let i = 0; i < s.data.length; i += 4)
      if (s.data[i] === colour[0] && s.data[i + 1] === colour[1] && s.data[i + 2] === colour[2])
        n++;
    return n;
  };

  it("pixel art whitens the ground under snow, and only there", () => {
    const draw = (weather: RegionalWeather): Surface => {
      const out = createSurface(FRAME_WIDTH, FRAME_HEIGHT);
      drawPixelScene(scene(weather), out);
      return out;
    };
    const bare = count(draw({}), PALETTE.snow);
    const mountains = count(draw(snowWeather(false)), PALETTE.snow);
    const plains = count(draw(snowWeather(true)), PALETTE.snow);
    expect(mountains).toBeGreaterThan(bare + 1000);
    expect(plains).toBeGreaterThan(mountains + 10_000);
    // No snow reported: the frame of no reading at all.
    expect(hashSurface(draw(clear))).toBe(hashSurface(draw({})));
  });

  it("the modern theme whitens it too, and draws no snow without a reading of it", () => {
    const draw = (weather: RegionalWeather): string => {
      const out = createSurface(FRAME_WIDTH * 2, FRAME_HEIGHT * 2);
      drawModernScene(scene(weather), out);
      return hashSurface(out);
    };
    expect(draw(snowWeather(false))).not.toBe(draw({}));
    const noSnow = { alps: reading("alps", 1676, 0) };
    expect(draw(noSnow)).toBe(draw({}));
  });
});
