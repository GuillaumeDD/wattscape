/**
 * Draws the frames whose hashes the browser must match (tests/fixtures/frames), and
 * writes the hashes into the page as JSON for e2e/frame-hash.spec.ts to read.
 */
import { drawMapView } from "../src/render/map-view";
import { hashSurface } from "../src/render/surface";
import { drawTestCard } from "../src/render/test-card";
import { lightAt } from "../src/sky/light";

const day = lightAt(35);
const night = lightAt(-20);
const out = document.getElementById("hashes");
if (out)
  out.textContent = JSON.stringify({
    "test-card": hashSurface(drawTestCard()),
    "map-france-day": hashSurface(drawMapView({ tile: 2, light: day })),
    "map-france-night": hashSurface(drawMapView({ tile: 2, light: night })),
    "map-normandie-night": hashSurface(drawMapView({ tile: 8, light: night, region: "28" })),
  });
