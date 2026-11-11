/**
 * Checks the éCO2mix parser and sign conventions against every published step of the
 * real-time datasets (about 10 weeks, ~60 MB). Run by hand, never in CI:
 *
 *   node --experimental-strip-types tools/check-eco2mix.ts
 *
 * For each area it prints how many published steps the parser rejects, and how far
 * consumption is from the balance
 *   production + exchanges + pumping + battery charge + battery discharge
 * (pumping and charge are ≤ 0), which holds only if a positive exchange is an import.
 */
import { isEco2mixArea, parseEco2mix, SOURCES, type Eco2mixArea } from "../src/data/eco2mix.ts";

const API = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets";

async function exportRows(dataset: string): Promise<unknown[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`${API}/${dataset}/exports/json`);
      const body: unknown = await response.json();
      if (!Array.isArray(body)) throw new Error(`${dataset}: not an array`);
      return body as unknown[];
    } catch (error) {
      if (attempt === 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
}

function areaOf(row: unknown): Eco2mixArea | undefined {
  if (typeof row !== "object" || row === null) return undefined;
  if ("perimetre" in row) return "FR";
  if ("code_insee_region" in row && isEco2mixArea(row.code_insee_region))
    return row.code_insee_region;
  return undefined;
}

for (const dataset of ["eco2mix-regional-tr", "eco2mix-national-tr"]) {
  const rows = await exportRows(dataset);
  const stats = new Map<
    string,
    { n: number; rejected: number; sumErr: number; maxErr: number; over100: number }
  >();
  const reasons = new Map<string, number>();
  let unknownArea = 0;
  let first = "";
  let last = "";
  for (const row of rows) {
    if (typeof row !== "object" || row === null || !("consommation" in row)) continue;
    if (row.consommation === null) continue; // a step not yet published
    const area = areaOf(row);
    if (area === undefined) {
      unknownArea++;
      continue;
    }
    const s = stats.get(area) ?? { n: 0, rejected: 0, sumErr: 0, maxErr: 0, over100: 0 };
    stats.set(area, s);
    s.n++;
    const result = parseEco2mix(area, { results: [row] });
    if (!result.ok) {
      s.rejected++;
      reasons.set(result.reason, (reasons.get(result.reason) ?? 0) + 1);
      continue;
    }
    const r = result.reading;
    if (first === "" || r.time < first) first = r.time;
    if (r.time > last) last = r.time;
    const production = SOURCES.reduce((sum, source) => sum + r.productionMw[source], 0);
    const balance =
      production + r.exchangesMw + r.pumpingMw + r.batteryChargeMw + r.batteryDischargeMw;
    const err = Math.abs(r.consumptionMw - balance);
    s.sumErr += err;
    s.maxErr = Math.max(s.maxErr, err);
    if (err > 100) s.over100++;
  }
  console.log(`${dataset}: published steps from ${first} to ${last}`);
  for (const [area, s] of [...stats].sort()) {
    const mean = s.sumErr / Math.max(1, s.n - s.rejected);
    console.log(
      `  ${area}: ${String(s.n)} steps, ${String(s.rejected)} rejected, balance error mean ${mean.toFixed(1)} MW, max ${String(s.maxErr)} MW, ${String(s.over100)} steps off by > 100 MW`,
    );
  }
  if (unknownArea > 0) console.log(`  rows of no known area: ${String(unknownArea)}`);
  for (const [reason, n] of reasons) console.log(`  rejected: ${reason} × ${String(n)}`);
}
