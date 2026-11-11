/**
 * Draws the frames whose hashes the browser must match (tests/fixtures/frames), and
 * writes the hashes into the page as JSON for e2e/frame-hash.spec.ts to read.
 */
import { hashSurface } from "../src/render/surface";
import { drawTestCard } from "../src/render/test-card";

const out = document.getElementById("hashes");
if (out) out.textContent = JSON.stringify({ "test-card": hashSurface(drawTestCard()) });
