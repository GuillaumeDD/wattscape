import { describe, expect, it } from "vitest";
import { fineIndexOf } from "../src/map/grid";
import { drawMapView } from "../src/render/map-view";
import { COLOUR_NAMES, PALETTE } from "../src/render/palette";
import { getPixel, hashSurface, type Surface } from "../src/render/surface";
import { lightAt } from "../src/sky/light";
import hashes from "./fixtures/frames/hashes.json";

const day = lightAt(35);
const night = lightAt(-20);

function colours(s: Surface): Map<string, number> {
  const byRgb = new Map(COLOUR_NAMES.map((n) => [PALETTE[n].join(), n] as const));
  const seen = new Map<string, number>();
  for (let i = 0; i < s.data.length; i += 4) {
    const name = byRgb.get(
      `${String(s.data[i])},${String(s.data[i + 1])},${String(s.data[i + 2])}`,
    );
    if (name === undefined) throw new Error(`pixel ${String(i / 4)} is off the palette`);
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return seen;
}

describe("drawMapView", () => {
  it("draws only palette colours, and no source colour on the bare map", () => {
    for (const light of [day, lightAt(2), night]) {
      const seen = colours(drawMapView({ tile: 2, light }));
      for (const source of ["nuclear", "hydro", "wind", "solar", "thermal", "bioenergy"])
        expect(seen.has(source), `${light.period} ${source}`).toBe(false);
    }
  });

  it("lights town lamps at night only", () => {
    expect(colours(drawMapView({ tile: 2, light: day })).has("lamp")).toBe(false);
    const lamps = colours(drawMapView({ tile: 2, light: night })).get("lamp") ?? 0;
    // 96 prefectures, regional ones larger.
    expect(lamps).toBeGreaterThanOrEqual(96);
  });

  it("crops a region with a margin, and shows its sea and land by day", () => {
    const s = drawMapView({ tile: 8, light: day, region: "28" });
    const whole = drawMapView({ tile: 8, light: day });
    expect(s.width).toBeLessThan(whole.width / 3);
    const seen = colours(s);
    expect(seen.get("seaDeep") ?? 0).toBeGreaterThan(1000);
    expect(seen.get("meadow") ?? 0).toBeGreaterThan(1000);
  });

  it("veils the land abroad by day only, so that at night it never reads as sea", () => {
    // Top face of a 2-pixel tile on the whole map: x = column × 2, y = row + 9 (the
    // room left above for the highest relief), for a flat cell.
    const pixel = (s: Surface, lat: number, lon: number): string => {
      const cell = fineIndexOf(lat, lon);
      if (cell === null) throw new Error("off the grid");
      const r = Math.floor(cell.row / 4);
      const c = Math.floor(cell.column / 4);
      return getPixel(s, c * 2, r + 9).join();
    };
    const beauce: [number, number] = [48.3, 1.6]; // French lowland, about 130 m
    const belgium: [number, number] = [50.9, 4.0]; // foreign land
    const byDay = drawMapView({ tile: 2, light: day });
    expect(pixel(byDay, ...beauce)).toBe(PALETTE.meadow.join());
    expect(pixel(byDay, ...belgium)).toBe(PALETTE.grass.join());
    const atNight = drawMapView({ tile: 2, light: night });
    expect(pixel(atNight, ...belgium)).toBe(pixel(atNight, ...beauce));
    expect(pixel(atNight, ...belgium)).not.toBe(PALETTE.sea.join());
  });

  it("draws the recorded frames (frame hashes, also checked in Chromium)", () => {
    expect(hashSurface(drawMapView({ tile: 2, light: day }))).toBe(hashes["map-france-day"]);
    expect(hashSurface(drawMapView({ tile: 2, light: night }))).toBe(hashes["map-france-night"]);
    expect(hashSurface(drawMapView({ tile: 8, light: night, region: "28" }))).toBe(
      hashes["map-normandie-night"],
    );
  });
});
