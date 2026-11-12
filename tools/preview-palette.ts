/**
 * Draws the test card (src/render/test-card.ts) as a PNG scaled ×6, to look at the
 * palette, the dithering and the light keyframes (B-009). Run by hand:
 *
 *   node --experimental-strip-types tools/preview-palette.ts [out.png]
 */
import { drawTestCard } from "../src/render/test-card.ts";
import { hashSurface } from "../src/render/surface.ts";
import { writePng } from "./png.ts";

const out = process.argv[2] ?? "palette-preview.png";
const card = drawTestCard();
writePng(out, card, 6);
console.log(`${out}: test card hash ${hashSurface(card)}`);
