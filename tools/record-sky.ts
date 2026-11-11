/**
 * Computes reference sun positions and moon quarters with Astronomy Engine (S-012),
 * an ephemeris independent of ours, and saves them as a test fixture (B-007). Run by
 * hand, never in CI; the package is not a dependency of the project:
 *
 *   npm install --no-save astronomy-engine@2.1.19
 *   node --experimental-strip-types tools/record-sky.ts
 *   npm ci   # puts node_modules back as the lockfile says
 *
 * Places are landmarks, never a real user's (AGENTS.md §5).
 */
import { writeFileSync } from "node:fs";

/** The few calls used, typed by hand (the package is not installed in CI). */
interface Astronomy {
  Observer: new (latitude: number, longitude: number, height: number) => unknown;
  Equator: (
    body: string,
    date: Date,
    observer: unknown,
    ofdate: boolean,
    aberration: boolean,
  ) => { ra: number; dec: number };
  Horizon: (
    date: Date,
    observer: unknown,
    ra: number,
    dec: number,
    refraction: string,
  ) => { altitude: number; azimuth: number };
  SearchMoonQuarter: (date: Date) => MoonQuarter;
  NextMoonQuarter: (mq: MoonQuarter) => MoonQuarter;
}
interface MoonQuarter {
  quarter: number;
  time: { date: Date };
}

const PACKAGE = "astronomy-engine";
const VERSION = "2.1.19";
const astronomy = (await import(PACKAGE)) as Astronomy;

const OUT = "tests/fixtures/sky/astronomy-engine-2.1.19.json";

// Landmarks spread over mainland France, from the north-west corner to the south-east.
const places = [
  ["lille-grand-place", 50.637, 3.063],
  ["pointe-du-raz", 48.039, -4.74],
  ["notre-dame-de-paris", 48.853, 2.35],
  ["strasbourg-cathedral", 48.582, 7.751],
  ["notre-dame-de-la-garde", 43.284, 5.371],
] as const;
// The equinoxes and solstices of 2026: the extremes of the sun's declination.
const dates = ["2026-03-20", "2026-06-21", "2026-09-23", "2026-12-21"];
const hoursUtc = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

const sun = [];
for (const [place, latitude, longitude] of places) {
  const observer = new astronomy.Observer(latitude, longitude, 0);
  for (const date of dates) {
    for (const hour of hoursUtc) {
      const time = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
      const eq = astronomy.Equator("Sun", time, observer, true, true);
      const hor = astronomy.Horizon(time, observer, eq.ra, eq.dec, "normal");
      sun.push({
        place,
        latitude,
        longitude,
        time: time.toISOString(),
        elevationDeg: Number(hor.altitude.toFixed(4)),
        azimuthDeg: Number(hor.azimuth.toFixed(4)),
      });
    }
  }
}

// Every moon quarter from 2026 to 2030: 0 new, 1 first quarter, 2 full, 3 last quarter.
const moonQuarters = [];
let quarter = astronomy.SearchMoonQuarter(new Date("2026-01-01T00:00:00Z"));
while (quarter.time.date < new Date("2031-01-01T00:00:00Z")) {
  moonQuarters.push({ quarter: quarter.quarter, time: quarter.time.date.toISOString() });
  quarter = astronomy.NextMoonQuarter(quarter);
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      source: "S-012",
      generator: `${PACKAGE}@${VERSION}, tools/record-sky.ts`,
      generatedAt: new Date().toISOString(),
      sunNote: "Apparent position: refraction 'normal', observer at sea level",
      sun,
      moonQuarters,
    },
    null,
    1,
  )}\n`,
);
console.log(`${OUT}: ${String(sun.length)} sun positions, ${String(moonQuarters.length)} quarters`);
