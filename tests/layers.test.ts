import { describe, expect, it } from "vitest";
import { COARSE_COLUMNS, COARSE_ROWS, decodeHex, FINE_ROWS, FOREIGN, SEA } from "../src/map/grid";
import { ELEVATION_ROWS_HEX } from "../src/map/france";
import { coarseLayer, fineLayer, seaDistances } from "../src/map/layers";
import { FINE_ELEVATION_RLE } from "../src/map/relief";
import { mulberry32 } from "./random";

/** The distance of each sea cell to the nearest land cell, by trying them all. */
function naiveDistances(kinds: Uint8Array, columns: number): Uint8Array {
  const out = new Uint8Array(kinds.length);
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] !== SEA) continue;
    let best = 255;
    for (let j = 0; j < kinds.length; j++) {
      if (kinds[j] === SEA) continue;
      const d =
        Math.abs(Math.floor(i / columns) - Math.floor(j / columns)) +
        Math.abs((i % columns) - (j % columns));
      best = Math.min(best, d);
    }
    out[i] = best;
  }
  return out;
}

describe("seaDistances", () => {
  it("is the distance in cells (4-neighbours) to the nearest land (randomized, naive reference)", () => {
    const random = mulberry32(42);
    for (let n = 0; n < 40; n++) {
      const columns = 1 + Math.floor(random() * 30);
      const rows = 1 + Math.floor(random() * 30);
      const landShare = random() * 0.2;
      const kinds = new Uint8Array(columns * rows).map(() => (random() < landShare ? 2 : SEA));
      expect(seaDistances(kinds, columns, rows)).toEqual(
        kinds.some((k) => k !== SEA)
          ? naiveDistances(kinds, columns)
          : new Uint8Array(kinds.length).fill(255),
      );
    }
  });

  it("caps at 255, far out at sea", () => {
    const kinds = new Uint8Array(400);
    kinds[0] = FOREIGN;
    const d = seaDistances(kinds, 400, 1);
    expect(d[254]).toBe(254);
    expect(d[255]).toBe(255);
    expect(d[399]).toBe(255);
  });
});

describe("terrain layers", () => {
  it("decodes the 4 km layer once, from the committed map", () => {
    const layer = coarseLayer();
    expect(coarseLayer()).toBe(layer);
    expect(layer.km).toBe(4);
    expect([layer.columns, layer.rows]).toEqual([COARSE_COLUMNS, COARSE_ROWS]);
    expect(layer.elevation).toEqual(decodeHex(ELEVATION_ROWS_HEX, COARSE_COLUMNS));
  });

  it("decodes the 1 km layer once for the same relief, with sea and foreign land", () => {
    const layer = fineLayer(FINE_ELEVATION_RLE);
    expect(fineLayer(FINE_ELEVATION_RLE)).toBe(layer);
    expect(layer.km).toBe(1);
    expect(layer.rows).toBe(FINE_ROWS);
    expect(layer.kinds.includes(FOREIGN)).toBe(true);
    expect(layer.kinds.includes(SEA)).toBe(true);
  });

  it("rejects relief rows of the wrong count or shape", () => {
    expect(() => fineLayer(FINE_ELEVATION_RLE.slice(1))).toThrow(/rows/);
    const bad = [...FINE_ELEVATION_RLE];
    bad[3] = "q1152"; // class 16 does not exist
    expect(() => fineLayer(bad)).toThrow(/unknown value/);
  });
});
