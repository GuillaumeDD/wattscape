/**
 * The recorded steps `?sample=` shows (B-012): real answers of the regional éCO2mix
 * API (DS-01), committed as test fixtures with their date and URL, loaded as a
 * separate chunk only when asked for. The page labels them as sample data.
 */
import { parseEco2mixRegions, type RegionalReadings } from "./eco2mix.ts";
import { type Result } from "./fetch-json.ts";

export async function loadSample(sample: "day" | "night"): Promise<Result<RegionalReadings>> {
  const body: unknown =
    sample === "day"
      ? (await import("../../tests/fixtures/eco2mix/2026-11-12-all-regions.json")).default
      : (await import("../../tests/fixtures/eco2mix/2026-11-12-all-regions-0100z.json")).default;
  return parseEco2mixRegions(body);
}
