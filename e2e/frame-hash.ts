/**
 * Draws the reference frames (e2e/reference-frames.ts), and writes their hashes into
 * the page as JSON for e2e/frame-hash.spec.ts to read.
 */
import { hashSurface } from "../src/render/surface";
import { REFERENCE_FRAMES } from "./reference-frames";

const out = document.getElementById("hashes");
if (out)
  out.textContent = JSON.stringify(
    Object.fromEntries(
      Object.entries(REFERENCE_FRAMES).map(([name, draw]) => [name, hashSurface(draw())]),
    ),
  );
