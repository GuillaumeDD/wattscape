/** The reference ephemeris fixture (S-012), shared by the sun and moon tests. */
import { readFileSync } from "node:fs";

export interface SunReference {
  readonly place: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly time: string;
  readonly elevationDeg: number;
  readonly azimuthDeg: number;
}

export interface MoonQuarterReference {
  /** 0 new, 1 first quarter, 2 full, 3 last quarter. */
  readonly quarter: number;
  readonly time: string;
}

/** Computed by tools/record-sky.ts with Astronomy Engine 2.1.19. */
export const SKY_REFERENCE = JSON.parse(
  readFileSync("tests/fixtures/sky/astronomy-engine-2.1.19.json", "utf8"),
) as { sun: readonly SunReference[]; moonQuarters: readonly MoonQuarterReference[] };
