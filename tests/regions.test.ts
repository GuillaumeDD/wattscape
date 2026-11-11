import { describe, expect, it } from "vitest";
import { REGION_CODES } from "../src/data/eco2mix";
import {
  ABROAD_KM,
  areaOfPosition,
  CORSICA,
  cosDeg,
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

  it("shows the nearest-prefecture limit on a famous case", () => {
    // Mont-Saint-Michel is in Normandie but nearer Rennes than Saint-Lô: the
    // provisional lookup (ARCHITECTURE § Geolocation) picks Bretagne until B-008.
    expect(areaOfPosition(48.636, -1.511).area).toBe("53");
  });

  it("gives Corsica the national view, and Sardinia the abroad one", () => {
    expect(areaOfPosition(42.15, 9.1)).toEqual({ area: "FR", reason: "corsica" });
    expect(areaOfPosition(41.39, 9.16)).toEqual({ area: "FR", reason: "corsica" }); // Bonifacio
    expect(areaOfPosition(41.24, 9.4)).toEqual({ area: "FR", reason: "abroad" }); // Sardinia
  });

  it("gives the national view far abroad, and is honest about places near a border", () => {
    for (const [name, lat, lon] of [
      ["Turin", 45.07, 7.69],
      ["Barcelona", 41.39, 2.17],
      ["London", 51.51, -0.13],
      ["Null Island", 0, 0],
      ["Tokyo", 35.68, 139.69],
    ] as const) {
      expect(areaOfPosition(lat, lon), name).toEqual({ area: "FR", reason: "abroad" });
    }
    // Known limit (ARCHITECTURE § Geolocation): within ABROAD_KM of a prefecture,
    // a foreign town maps to the French region next door.
    expect(areaOfPosition(46.2, 6.15).area).toBe("84"); // Geneva
    expect(areaOfPosition(50.85, 4.35).area).toBe("32"); // Brussels
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

  it("agrees with a brute-force reference on random positions (cross-check)", () => {
    // Naive reference: haversine distance to every prefecture.
    const R = 6371;
    const rad = (d: number): number => (d * Math.PI) / 180;
    const haversine = (a: number, b: number, c: number, d: number): number => {
      const h =
        Math.sin(rad(c - a) / 2) ** 2 +
        Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    let seed = 99;
    const next = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    let disagreements = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const lat = 41 + next() * 10.5;
      const lon = -5.5 + next() * 15.5;
      let best = Number.POSITIVE_INFINITY;
      let region = "";
      for (const [, , r, plat, plon] of PREFECTURES) {
        const d = haversine(lat, lon, plat, plon);
        if (d < best) {
          best = d;
          region = r;
        }
      }
      const expected = best > ABROAD_KM ? "FR" : region === CORSICA ? "FR" : region;
      if (areaOfPosition(lat, lon).area !== expected) disagreements++;
    }
    // The projection differs from the sphere by well under 1 %: only near-ties and
    // points right at ABROAD_KM may disagree.
    expect(disagreements / n).toBeLessThan(0.005);
  });
});

describe("cosDeg", () => {
  it("matches Math.cos to 2e-6 from 0 to 60° (reference)", () => {
    for (let d = 0; d <= 60; d += 0.25) {
      expect(Math.abs(cosDeg(d) - Math.cos((d * Math.PI) / 180))).toBeLessThan(2e-6);
    }
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
