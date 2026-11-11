import { describe, expect, it } from "vitest";
import { REGION_CODES } from "../src/data/eco2mix";
import { FINE_ROWS_RLE } from "../src/map/france";
import {
  cellCentre,
  decodeRuns,
  FINE_COLUMNS,
  FINE_ROWS,
  fineIndexOf,
  onFineGrid,
  regionOfKind,
} from "../src/map/grid";
import {
  areaOfPosition,
  CORSICA,
  NEAR_FRANCE_KM,
  PREFECTURES,
  REGION_CAPITALS,
  REGION_NAMES,
  referencePoint,
} from "../src/geo/regions";

describe("PREFECTURES", () => {
  it("lists the 96 départements of mainland France and Corsica once each", () => {
    const codes = PREFECTURES.map(([dept]) => dept);
    expect(new Set(codes).size).toBe(96);
    const expected = [
      ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, "0")).filter(
        (c) => c !== "20",
      ),
      "2A",
      "2B",
    ];
    expect([...codes].sort()).toEqual(expected.sort());
  });

  it("puts every region of the éCO2mix data, and Corsica, among the prefectures", () => {
    const regions = new Set(PREFECTURES.map(([, , region]) => region));
    expect([...regions].sort()).toEqual([...REGION_CODES, CORSICA].sort());
  });
});

describe("areaOfPosition", () => {
  it("maps each prefecture to its own region (test per prefecture)", () => {
    for (const [dept, town, region, lat, lon] of PREFECTURES) {
      const expected = region === CORSICA ? "FR" : region;
      expect(areaOfPosition(lat, lon).area, `${dept} ${town}`).toBe(expected);
    }
  });

  it("maps landmarks to their region", () => {
    // Landmark coordinates, never a real user's (AGENTS.md §5).
    const cases: [string, number, number, string][] = [
      ["Étretat cliffs", 49.707, 0.204, "28"],
      ["Paluel nuclear plant", 49.858, 0.635, "28"],
      ["Pont du Gard", 43.947, 4.535, "76"],
      ["Dune du Pilat", 44.589, -1.213, "75"],
      ["Mont Blanc", 45.833, 6.865, "84"],
      ["Carnac stones", 47.595, -3.073, "53"],
      ["Chambord", 47.616, 1.517, "24"],
    ];
    for (const [name, lat, lon, area] of cases) {
      expect(areaOfPosition(lat, lon), name).toEqual({ area, reason: "region" });
    }
  });

  it("puts Mont-Saint-Michel in Normandie, which the nearest prefecture got wrong", () => {
    // Regression: nearer Rennes than Saint-Lô, it mapped to Bretagne before B-008.
    expect(areaOfPosition(48.636, -1.511)).toEqual({ area: "28", reason: "region" });
  });

  it("follows the border where prefectures misled, on both sides of it", () => {
    // Landmark and town-hall coordinates, a few km from a regional border.
    const cases: [string, number, number, string][] = [
      ["Pontorson (Normandie, by Brittany)", 48.553, -1.508, "28"],
      ["Cancale (Bretagne)", 48.676, -1.852, "53"],
      ["Giverny (Normandie, by Île-de-France)", 49.075, 1.533, "28"],
      ["La Roche-Guyon (Île-de-France)", 49.081, 1.628, "11"],
      ["Château de Chenonceau (Centre-Val de Loire)", 47.325, 1.07, "24"],
      ["Lascaux (Nouvelle-Aquitaine)", 45.054, 1.169, "75"],
      ["Rocamadour (Occitanie)", 44.799, 1.618, "76"],
    ];
    for (const [name, lat, lon, area] of cases) {
      expect(areaOfPosition(lat, lon), name).toEqual({ area, reason: "region" });
    }
  });

  it("maps the sea off a French coast to that coast's region", () => {
    expect(areaOfPosition(49.9, 0.3).area).toBe("28"); // off Fécamp
    expect(areaOfPosition(48.0, -4.9).area).toBe("53"); // off the Pointe du Raz
    expect(areaOfPosition(43.2, 5.3).area).toBe("93"); // off Marseille
  });

  it("gives Corsica the national view, and Sardinia the abroad one", () => {
    expect(areaOfPosition(42.15, 9.1)).toEqual({ area: "FR", reason: "corsica" });
    expect(areaOfPosition(41.39, 9.16)).toEqual({ area: "FR", reason: "corsica" }); // Bonifacio
    expect(areaOfPosition(40.92, 9.5)).toEqual({ area: "FR", reason: "abroad" }); // Olbia
    // Regression: Santa Teresa Gallura, 14 km from Corsica, read "Corsica" in review.
    expect(areaOfPosition(41.24, 9.19)).toEqual({ area: "FR", reason: "abroad" });
    expect(areaOfPosition(41.24, 9.4)).toEqual({ area: "FR", reason: "abroad" });
    expect(areaOfPosition(42.0, 8.6)).toEqual({ area: "FR", reason: "corsica" }); // off Ajaccio
  });

  it(`gives the national view abroad, beyond ${String(NEAR_FRANCE_KM)} km of France`, () => {
    for (const [name, lat, lon] of [
      ["Turin", 45.07, 7.69],
      ["Barcelona", 41.39, 2.17],
      ["London", 51.51, -0.13],
      ["Brussels", 50.85, 4.35],
      ["Bern", 46.95, 7.45],
      ["Saint Helier, Jersey", 49.186, -2.107],
      ["Null Island", 0, 0],
      ["Tokyo", 35.68, 139.69],
    ] as const) {
      expect(areaOfPosition(lat, lon), name).toEqual({ area: "FR", reason: "abroad" });
    }
  });

  it(`maps a place within ${String(NEAR_FRANCE_KM)} km of France to the region next door`, () => {
    expect(areaOfPosition(46.2, 6.15).area).toBe("84"); // Geneva
    expect(areaOfPosition(47.56, 7.59).area).toBe("44"); // Basel
    expect(areaOfPosition(43.74, 7.42).area).toBe("93"); // Monaco
    expect(areaOfPosition(49.611, 6.13).area).toBe("44"); // Luxembourg
    expect(areaOfPosition(42.507, 1.522).area).toBe("76"); // Andorra la Vella
  });

  it("rejects positions that are not numbers or not on Earth", () => {
    for (const [lat, lon] of [
      [Number.NaN, 2],
      [48, Number.POSITIVE_INFINITY],
      [91, 2],
      [48, 181],
    ] as const) {
      expect(areaOfPosition(lat, lon)).toEqual({ area: "FR", reason: "invalid" });
    }
  });

  it("agrees with a brute-force nearest-cell search outside France (cross-check)", () => {
    // Naive reference: every French cell of the fine grid, distances in km on the
    // sphere's local tangent plane, with Math.cos.
    const grid = decodeRuns(FINE_ROWS_RLE, FINE_COLUMNS);
    const french: [number, number, string][] = [];
    for (let r = 0; r < FINE_ROWS; r++) {
      for (let c = 0; c < FINE_COLUMNS; c++) {
        const region = regionOfKind(grid[r * FINE_COLUMNS + c] ?? 0);
        if (region !== null) {
          const centre = cellCentre(r, c, 1);
          french.push([centre.latitude, centre.longitude, region]);
        }
      }
    }
    let seed = 99;
    const next = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    let checked = 0;
    let near = 0;
    while (checked < 300) {
      const lat = 41 + next() * 10.5;
      const lon = -5.5 + next() * 15.5;
      const cell = fineIndexOf(lat, lon);
      if (cell === null) continue;
      if (onFineGrid(cell.row, cell.column) && grid[cell.row * FINE_COLUMNS + cell.column] !== 0)
        continue;
      const k = Math.cos((lat * Math.PI) / 180) * 111.2;
      // The nearest cell, and the nearest one of another region.
      let first: [number, string] = [Number.POSITIVE_INFINITY, ""];
      let other = Number.POSITIVE_INFINITY;
      for (const [la, lo, code] of french) {
        const dy = (la - lat) * 111.2;
        if (Math.abs(dy) > other) continue;
        const d = Math.hypot(dy, (lo - lon) * k);
        if (d < first[0]) {
          if (code !== first[1]) other = first[0];
          first = [d, code];
        } else if (code !== first[1] && d < other) other = d;
      }
      // Skip near-ties and points at the threshold, where rounding may tip either way.
      if (Math.abs(first[0] - NEAR_FRANCE_KM) < 0.05) continue;
      if (other - first[0] < 0.05) continue;
      const isNear = first[0] < NEAR_FRANCE_KM;
      if (isNear) near++;
      const expected = !isNear || first[1] === CORSICA ? "FR" : first[1];
      expect(areaOfPosition(lat, lon).area, `${String(lat)}, ${String(lon)}`).toBe(expected);
      checked++;
    }
    expect(near).toBeGreaterThan(10);
  });
});

describe("referencePoint", () => {
  it("is the regional prefecture, and none for France", () => {
    expect(referencePoint("28")).toEqual({ latitude: 49.44, longitude: 1.1 });
    expect(referencePoint("FR")).toBeNull();
    for (const code of REGION_CODES) {
      const point = referencePoint(code);
      expect(point, code).not.toBeNull();
      if (point !== null) expect(areaOfPosition(point.latitude, point.longitude).area).toBe(code);
      expect(REGION_NAMES[code].length).toBeGreaterThan(0);
      expect(REGION_CAPITALS[code]).toMatch(/^\d\d$/);
    }
  });
});
