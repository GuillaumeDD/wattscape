import { describe, expect, it } from "vitest";
import { sunPosition, type SunPosition } from "../src/sky/sun";
import { noaaAzEl } from "./noaa-reference";
import { SKY_REFERENCE } from "./sky-reference";

function at(time: string, latitude: number, longitude: number): SunPosition {
  const p = sunPosition(Date.parse(time), latitude, longitude);
  if (p === null) throw new Error("no position");
  return p;
}

/** Smallest angle between two azimuths, degrees. */
function azimuthGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

const ref = SKY_REFERENCE.sun;

describe("sunPosition against an independent ephemeris (S-012)", () => {
  it("covers 5 landmarks × 4 dates (equinoxes, solstices) × 12 hours", () => {
    expect(new Set(ref.map((r) => r.place)).size).toBe(5);
    expect(new Set(ref.map((r) => r.time.slice(0, 10))).size).toBe(4);
    expect(ref).toHaveLength(240);
  });

  it("azimuth is within 0.5° at every point (measured: 0.01°)", () => {
    for (const r of ref) {
      const p = at(r.time, r.latitude, r.longitude);
      expect(azimuthGap(p.azimuthDeg, r.azimuthDeg), `${r.place} ${r.time}`).toBeLessThan(0.05);
    }
  });

  it("elevation is within 0.5° whenever the sun is up (measured: 0.01°)", () => {
    const up = ref.filter((r) => r.elevationDeg >= 0);
    expect(up.length).toBeGreaterThan(100);
    for (const r of up) {
      const p = at(r.time, r.latitude, r.longitude);
      expect(Math.abs(p.elevationDeg - r.elevationDeg), `${r.place} ${r.time}`).toBeLessThan(0.05);
    }
  });

  it("below the horizon, only the refraction convention differs, by under 0.6°", () => {
    // The reference's "normal" refraction is held near its horizon value down to −1°,
    // then tapers linearly to 0 at the nadir (its README); NOAA's fit adds almost
    // none below the horizon. Neither is observable: the sun is down for both.
    for (const r of ref.filter((x) => x.elevationDeg < 0)) {
      const p = at(r.time, r.latitude, r.longitude);
      const gap = r.elevationDeg - p.elevationDeg;
      expect(gap, `${r.place} ${r.time}`).toBeGreaterThanOrEqual(-0.01);
      expect(gap, `${r.place} ${r.time}`).toBeLessThan(0.6);
    }
  });

  it("agrees on day and night at every point", () => {
    for (const r of ref) {
      const p = at(r.time, r.latitude, r.longitude);
      // The sun's apparent centre crosses the horizon at the same instant in both, give
      // or take the refraction gap just below it (< 0.6°).
      if (Math.abs(r.elevationDeg) > 0.6) expect(p.elevationDeg > 0).toBe(r.elevationDeg > 0);
    }
  });
});

describe("sunPosition against NOAA's own code (S-008)", () => {
  it("matches NOAA's calcAzEl on 20,000 random instants and places in and around France", () => {
    // A seeded LCG (Numerical Recipes): the same points on every run and engine.
    let seed = 2026;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let worst = 0;
    for (let i = 0; i < 20_000; i++) {
      const timeMs = Date.UTC(2000, 0, 1) + next() * 50 * 365.25 * 86_400_000;
      const latitude = 41 + next() * 10;
      const longitude = -6 + next() * 16;
      const ours = at(new Date(timeMs).toISOString(), latitude, longitude);
      const noaa = noaaAzEl(Date.parse(new Date(timeMs).toISOString()), latitude, longitude);
      worst = Math.max(
        worst,
        Math.abs(ours.elevationDeg - noaa.elevation),
        azimuthGap(ours.azimuthDeg, noaa.azimuth),
      );
    }
    expect(worst).toBeLessThan(1e-6);
  });
});

describe("sunPosition, known geometry", () => {
  it("at the June solstice, noon sun over Paris stands at 90° − 48.85° + 23.44°, due south", () => {
    // Local solar noon in Paris is about 11:51 UTC on 2026-06-21.
    let best = at("2026-06-21T11:00:00Z", 48.853, 2.35);
    for (let m = 0; m <= 120; m++) {
      const p = at(
        new Date(Date.parse("2026-06-21T11:00:00Z") + m * 60_000).toISOString(),
        48.853,
        2.35,
      );
      if (p.elevationDeg > best.elevationDeg) best = p;
    }
    expect(best.geometricElevationDeg).toBeCloseTo(90 - 48.853 + 23.44, 1);
    expect(azimuthGap(best.azimuthDeg, 180)).toBeLessThan(0.5);
  });

  it("rises in the east-north-east and sets in the west-north-west in June", () => {
    expect(at("2026-06-21T04:00:00Z", 48.853, 2.35).azimuthDeg).toBeGreaterThan(45);
    expect(at("2026-06-21T04:00:00Z", 48.853, 2.35).azimuthDeg).toBeLessThan(90);
    expect(at("2026-06-21T19:30:00Z", 48.853, 2.35).azimuthDeg).toBeGreaterThan(270);
    expect(at("2026-06-21T19:30:00Z", 48.853, 2.35).azimuthDeg).toBeLessThan(315);
  });

  it("refraction lifts the apparent sun: about 0.57° at the horizon, none overhead", () => {
    for (const r of ref) {
      const p = at(r.time, r.latitude, r.longitude);
      const lift = p.elevationDeg - p.geometricElevationDeg;
      expect(lift).toBeGreaterThanOrEqual(0);
      expect(lift).toBeLessThan(0.6);
    }
    // Find the instant of sunset in Paris on 2026-03-20 to the minute, geometrically.
    let p = at("2026-03-20T17:00:00Z", 48.853, 2.35);
    for (let m = 0; m < 120 && p.geometricElevationDeg > 0; m++)
      p = at(new Date(Date.parse("2026-03-20T17:00:00Z") + m * 60_000).toISOString(), 48.853, 2.35);
    expect(p.elevationDeg - p.geometricElevationDeg).toBeCloseTo(0.48, 1);
  });

  it("returns azimuths in [0, 360) and elevations in [−90, 90]", () => {
    for (let h = 0; h < 24 * 365; h += 7) {
      const p = at(new Date(Date.UTC(2026, 0, 1) + h * 3_600_000).toISOString(), 43.284, 5.371);
      expect(p.azimuthDeg).toBeGreaterThanOrEqual(0);
      expect(p.azimuthDeg).toBeLessThan(360);
      expect(Math.abs(p.elevationDeg)).toBeLessThanOrEqual(90);
    }
  });

  it("works at the poles and the date line", () => {
    expect(sunPosition(Date.parse("2026-06-21T12:00:00Z"), 90, 0)?.elevationDeg).toBeCloseTo(
      23.44,
      1,
    );
    expect(sunPosition(Date.parse("2026-06-21T12:00:00Z"), -90, 180)).not.toBeNull();
  });

  it("returns null for a non-finite input or an impossible position", () => {
    const t = Date.parse("2026-06-21T12:00:00Z");
    expect(sunPosition(Number.NaN, 48, 2)).toBeNull();
    expect(sunPosition(Number.POSITIVE_INFINITY, 48, 2)).toBeNull();
    expect(sunPosition(t, Number.NaN, 2)).toBeNull();
    expect(sunPosition(t, 48, Number.NaN)).toBeNull();
    expect(sunPosition(t, 90.1, 2)).toBeNull();
    expect(sunPosition(t, 48, -180.1)).toBeNull();
  });
});
