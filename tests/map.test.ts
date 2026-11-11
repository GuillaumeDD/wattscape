import { describe, expect, it } from "vitest";
import { REGION_CODES } from "../src/data/eco2mix";
import { PREFECTURES } from "../src/geo/regions";
import {
  COARSE_ROWS_RLE,
  ELEVATION_ROWS_HEX,
  FINE_ROWS_RLE,
  MAP_BAKED_ON,
} from "../src/map/france";
import {
  cellCentre,
  COARSE_COLUMNS,
  COARSE_FACTOR,
  COARSE_KM,
  COARSE_ROWS,
  CORSICA,
  cosDeg,
  decodeHex,
  decodeRuns,
  EAST,
  elevationClass,
  ELEVATION_CLASSES,
  encodeRuns,
  FINE_COLUMNS,
  FINE_ROWS,
  fineIndexOf,
  FOREIGN,
  KIND_COUNT,
  kindOfRegion,
  NORTH,
  onFineGrid,
  regionOfKind,
  SEA,
  SOUTH,
  WEST,
} from "../src/map/grid";

const fine = decodeRuns(FINE_ROWS_RLE, FINE_COLUMNS);
const coarse = decodeRuns(COARSE_ROWS_RLE, COARSE_COLUMNS);
const elevation = decodeHex(ELEVATION_ROWS_HEX, COARSE_COLUMNS);

/** The coarse cell holding a position (test helper; the grid is checked below). */
function coarseAt(latitude: number, longitude: number): number {
  const cell = fineIndexOf(latitude, longitude);
  if (cell === null || !onFineGrid(cell.row, cell.column)) throw new Error("off the grid");
  return (
    Math.floor(cell.row / COARSE_FACTOR) * COARSE_COLUMNS + Math.floor(cell.column / COARSE_FACTOR)
  );
}

describe("cosDeg", () => {
  it("matches Math.cos to 2e-6 from 0 to 60° (reference)", () => {
    for (let d = 0; d <= 60; d += 0.25) {
      expect(Math.abs(cosDeg(d) - Math.cos((d * Math.PI) / 180))).toBeLessThan(2e-6);
    }
  });
});

describe("grid geometry", () => {
  it("covers mainland France and Corsica with a margin", () => {
    // Extreme points: Ouessant (W), Bray-Dunes (N), Lauterbourg (E), Cap Corse (E),
    // Cap Pertusato (S, Corsica).
    expect(WEST).toBeLessThan(-5.14);
    expect(NORTH).toBeGreaterThan(51.09);
    expect(EAST).toBeGreaterThan(9.56);
    expect(SOUTH).toBeLessThan(41.37);
  });

  it("puts the centre of every fine cell back in that cell", () => {
    for (const [row, column] of [
      [0, 0],
      [FINE_ROWS - 1, FINE_COLUMNS - 1],
      [517, 803],
      [1, 1151],
    ] as const) {
      const centre = cellCentre(row, column, 1);
      expect(fineIndexOf(centre.latitude, centre.longitude)).toEqual({ row, column });
    }
  });

  it("finds no cell for a non-number, and knows what is on the grid", () => {
    expect(fineIndexOf(Number.NaN, 2)).toBeNull();
    expect(fineIndexOf(48, Number.NEGATIVE_INFINITY)).toBeNull();
    expect(onFineGrid(-1, 0)).toBe(false);
    expect(onFineGrid(0, FINE_COLUMNS)).toBe(false);
    expect(onFineGrid(FINE_ROWS - 1, 0)).toBe(true);
  });

  it("numbers sea, foreign land, then the 12 regions and Corsica", () => {
    expect(KIND_COUNT).toBe(15);
    expect(regionOfKind(SEA)).toBeNull();
    expect(regionOfKind(FOREIGN)).toBeNull();
    expect(regionOfKind(KIND_COUNT)).toBeNull();
    for (const region of [...REGION_CODES, CORSICA]) {
      expect(regionOfKind(kindOfRegion(region))).toBe(region);
    }
  });
});

describe("run-length rows", () => {
  it("decodes what it encodes (randomized round trip)", () => {
    let seed = 7;
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    for (let t = 0; t < 50; t++) {
      const rows = Array.from({ length: 5 }, () => {
        const row = new Uint8Array(40);
        let kind = next(KIND_COUNT);
        for (let i = 0; i < row.length; i++) {
          if (next(4) === 0) kind = next(KIND_COUNT);
          row[i] = kind;
        }
        return row;
      });
      const decoded = decodeRuns(rows.map(encodeRuns), 40);
      expect(Array.from(decoded)).toEqual(rows.flatMap((row) => Array.from(row)));
    }
  });

  it("encodes runs as a letter and a length", () => {
    expect(encodeRuns([0, 0, 0, 2, 2, 14])).toBe("a3c2o1");
  });

  it("rejects a row of the wrong width, a bad character or an unknown kind", () => {
    expect(() => decodeRuns(["a3"], 4)).toThrow(/3 cells, not 4/);
    expect(() => decodeRuns(["a5"], 4)).toThrow(/5 cells, not 4/);
    expect(() => decodeRuns(["a2-2"], 4)).toThrow(/bad character/);
    expect(() => decodeRuns(["z4"], 4)).toThrow(/unknown kind/);
    expect(() => decodeHex(["0g"], 2)).toThrow(/malformed/);
    expect(() => decodeHex(["0"], 2)).toThrow(/malformed/);
  });
});

describe("elevationClass", () => {
  it("returns the class whose lower bound is the highest one reached", () => {
    expect(elevationClass(-12)).toBe(0);
    expect(elevationClass(49.9)).toBe(0);
    expect(elevationClass(50)).toBe(1);
    expect(elevationClass(999)).toBe(7);
    expect(elevationClass(1000)).toBe(8);
    expect(elevationClass(4808)).toBe(15);
    expect(ELEVATION_CLASSES).toHaveLength(16);
  });
});

describe("the baked map (src/map/france.ts)", () => {
  it("says the day it was baked, for the credits", () => {
    expect(MAP_BAKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(MAP_BAKED_ON))).toBe(false);
  });

  it("has the grid's size", () => {
    expect(FINE_ROWS_RLE).toHaveLength(FINE_ROWS);
    expect(COARSE_ROWS_RLE).toHaveLength(COARSE_ROWS);
    expect(ELEVATION_ROWS_HEX).toHaveLength(COARSE_ROWS);
    // Only "not France" and the regions in the fine grid: no foreign land there.
    expect(fine.includes(FOREIGN)).toBe(false);
  });

  it("puts every prefecture in its own region, on the fine grid (S-006)", () => {
    for (const [dept, town, region, lat, lon] of PREFECTURES) {
      const cell = fineIndexOf(lat, lon);
      expect(cell, town).not.toBeNull();
      if (cell === null) continue;
      expect(
        regionOfKind(fine[cell.row * FINE_COLUMNS + cell.column] ?? 0),
        `${dept} ${town}`,
      ).toBe(region);
    }
  });

  it("gives each region the same area on both grids, within 2 %", () => {
    for (const region of [...REGION_CODES, CORSICA]) {
      const kind = kindOfRegion(region);
      const fineKm2 = fine.reduce((n, v) => n + (v === kind ? 1 : 0), 0);
      const coarseKm2 = coarse.reduce((n, v) => n + (v === kind ? 1 : 0), 0) * COARSE_KM ** 2;
      expect(fineKm2, region).toBeGreaterThan(5000);
      expect(Math.abs(coarseKm2 - fineKm2) / fineKm2, region).toBeLessThan(0.02);
    }
  });

  it("keeps a coarse region cell over at least one fine cell of that region", () => {
    for (let r = 0; r < COARSE_ROWS; r++) {
      for (let c = 0; c < COARSE_COLUMNS; c++) {
        const kind = coarse[r * COARSE_COLUMNS + c] ?? SEA;
        if (kind < 2) continue;
        let found = false;
        for (let dr = 0; dr < COARSE_FACTOR && !found; dr++) {
          for (let dc = 0; dc < COARSE_FACTOR && !found; dc++) {
            found = fine[(r * COARSE_FACTOR + dr) * FINE_COLUMNS + c * COARSE_FACTOR + dc] === kind;
          }
        }
        expect(found, `coarse cell ${String(r)}, ${String(c)}`).toBe(true);
      }
    }
  });

  it("knows sea from land and its neighbours", () => {
    expect(coarse[coarseAt(46.0, -4.0)]).toBe(SEA); // Bay of Biscay
    expect(coarse[coarseAt(43.0, 6.0)]).toBe(SEA); // Mediterranean, off Toulon
    expect(coarse[coarseAt(50.4, 4.4)]).toBe(FOREIGN); // Charleroi, Belgium
    expect(coarse[coarseAt(46.95, 7.45)]).toBe(FOREIGN); // Bern
    expect(coarse[coarseAt(41.65, -0.88)]).toBe(FOREIGN); // Zaragoza
    expect(coarse[coarseAt(49.44, 1.1)]).toBe(kindOfRegion("28")); // Rouen
  });

  it("has relief where France has mountains, and none at sea or abroad", () => {
    const at = (lat: number, lon: number): number => elevation[coarseAt(lat, lon)] ?? -1;
    expect(at(45.879, 6.887)).toBeGreaterThanOrEqual(elevationClass(2400)); // Aiguille du Midi
    expect(at(44.92, 6.36)).toBeGreaterThanOrEqual(elevationClass(2400)); // Écrins
    expect(at(42.84, 0.14)).toBeGreaterThanOrEqual(elevationClass(1600)); // Pic du Midi
    expect(at(45.53, 2.81)).toBeGreaterThanOrEqual(elevationClass(1000)); // Puy de Sancy
    expect(at(48.86, 2.35)).toBeLessThanOrEqual(elevationClass(100)); // Paris
    expect(at(46.0, -4.0)).toBe(0); // sea
    expect(at(46.95, 7.45)).toBe(0); // abroad: BD ALTI covers France only
    // The highest cell of the map is in the Mont Blanc massif, on the French side
    // (the summit's own cell is mostly Italian, so it is foreign land).
    let highest = 0;
    elevation.forEach((v, i) => {
      if (v > (elevation[highest] ?? 0)) highest = i;
    });
    const top = cellCentre(
      Math.floor(highest / COARSE_COLUMNS),
      highest % COARSE_COLUMNS,
      COARSE_KM,
    );
    expect(Math.abs(top.latitude - 45.833)).toBeLessThan(0.1);
    expect(Math.abs(top.longitude - 6.865)).toBeLessThan(0.1);
    expect(elevation[highest]).toBeGreaterThanOrEqual(elevationClass(3200));
  });
});
