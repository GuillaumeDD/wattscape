/**
 * Records real éCO2mix answers as test fixtures (B-005). Run by hand, never in CI:
 *
 *   node --experimental-strip-types tools/record-eco2mix.ts
 *
 * Each answer is saved byte for byte as `<name>.json`, next to `<name>.meta.json`
 * (URL, HTTP status, recording time, source id). A fixture is dated, never refreshed
 * in place: re-recording writes new names.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { eco2mixUrl, type Eco2mixArea } from "../src/data/eco2mix.ts";

const OUT = "tests/fixtures/eco2mix";
const API = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets";

const day = new Date().toISOString().slice(0, 10);
const targets: { name: string; url: string; source: string }[] = [
  ...(
    [
      ["FR", "national"],
      ["28", "normandie"],
      ["53", "bretagne"],
      ["84", "auvergne-rhone-alpes"],
      ["11", "ile-de-france"],
    ] as const satisfies readonly (readonly [Eco2mixArea, string])[]
  ).map(([area, label]) => ({
    name: `${day}-${label}`,
    url: eco2mixUrl(area),
    source: area === "FR" ? "DS-02, S-009" : "DS-01, S-003",
  })),
  {
    // A step of the day not yet published: every figure is null.
    name: `${day}-regional-empty-step`,
    url: `${API}/eco2mix-regional-tr/records?${new URLSearchParams({ where: "consommation is null", limit: "1" }).toString()}`,
    source: "DS-01, S-003",
  },
  {
    // What the API answers to a malformed query.
    name: `${day}-error-bad-query`,
    url: `${API}/eco2mix-regional-tr/records?${new URLSearchParams({ where: "no_such_field = 1" }).toString()}`,
    source: "DS-01, S-003",
  },
];

/** ODRÉ sometimes resets the connection: retry with growing pauses. */
async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (attempt === 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

mkdirSync(OUT, { recursive: true });
for (const target of targets) {
  const response = await get(target.url);
  const body = await response.text();
  writeFileSync(`${OUT}/${target.name}.json`, body);
  const meta = {
    url: target.url,
    status: response.status,
    recordedAt: new Date().toISOString(),
    source: target.source,
  };
  writeFileSync(`${OUT}/${target.name}.meta.json`, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`${String(response.status)} ${target.name}`);
}
