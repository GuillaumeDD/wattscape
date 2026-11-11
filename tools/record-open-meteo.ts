/**
 * Records real Open-Meteo answers as test fixtures (B-006). Run by hand, never in CI:
 *
 *   node --experimental-strip-types tools/record-open-meteo.ts
 *
 * Positions are landmarks, never a real user's (AGENTS.md §5). Each answer is saved
 * byte for byte as `<name>.json`, next to `<name>.meta.json` (URL, HTTP status,
 * recording time, source id). A fixture is dated, never refreshed in place.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { openMeteoUrl, roundPosition } from "../src/data/open-meteo.ts";

const OUT = "tests/fixtures/open-meteo";
const day = new Date().toISOString().slice(0, 10);

// Landmarks: Rouen cathedral, the Mont Blanc summit, Pointe du Raz.
const places = [
  ["rouen", 49.44, 1.095],
  ["mont-blanc", 45.833, 6.865],
  ["pointe-du-raz", 48.039, -4.74],
] as const;

const targets: { name: string; url: string }[] = places.map(([label, lat, lon]) => {
  const position = roundPosition(lat, lon);
  if (position === null) throw new Error(`bad position for ${label}`);
  return { name: `${day}-${label}`, url: openMeteoUrl(position) };
});
// What the API answers to a bad query (latitude out of range).
targets.push({
  name: `${day}-error-bad-latitude`,
  url: "https://api.open-meteo.com/v1/forecast?latitude=91.0&longitude=1.1&current=temperature_2m",
});

/**
 * The cloud sessions share their egress address, so the API's per-address daily
 * quota often answers 429 there, and connections are sometimes reset: retry.
 */
async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status !== 429 || attempt === 12) return response;
    } catch (error) {
      if (attempt === 12) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
}

mkdirSync(OUT, { recursive: true });
for (const target of targets) {
  const response = await get(target.url);
  const body = await response.text();
  const meta = {
    url: target.url,
    status: response.status,
    recordedAt: new Date().toISOString(),
    source: "DS-03, S-005",
  };
  if (response.status === 429) {
    console.log(`429 ${target.name}: not saved`);
    continue;
  }
  writeFileSync(`${OUT}/${target.name}.json`, body);
  writeFileSync(`${OUT}/${target.name}.meta.json`, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`${String(response.status)} ${target.name}`);
}
