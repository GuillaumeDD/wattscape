/**
 * Re-records the hashes of the reference frames (e2e/reference-frames.ts) into
 * tests/fixtures/frames/hashes.json, after a drawing change that is intended. Run by
 * hand, then commit the file with the change (AGENTS.md § Determinism):
 *
 *   node --experimental-strip-types tools/record-frames.ts
 *
 * Node draws the frames here; e2e/frame-hash.spec.ts then checks that Chromium draws
 * the same pixels (`npm run e2e`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { REFERENCE_FRAMES } from "../e2e/reference-frames.ts";
import { hashSurface } from "../src/render/surface.ts";

const FILE = "tests/fixtures/frames/hashes.json";
const old = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, string>;
const hashes: Record<string, string> = { _comment: old._comment ?? "" };
const changed: string[] = [];
for (const [name, draw] of Object.entries(REFERENCE_FRAMES)) {
  hashes[name] = hashSurface(draw());
  if (old[name] !== hashes[name]) changed.push(`${name}: ${old[name] ?? "new"} → ${hashes[name]}`);
}
const dropped = Object.keys(old).filter((name) => !(name in hashes));
writeFileSync(FILE, `${JSON.stringify(hashes, null, 2)}\n`);
console.log(changed.length > 0 ? changed.join("\n") : "no frame changed");
if (dropped.length > 0) console.log(`dropped: ${dropped.join(", ")}`);
