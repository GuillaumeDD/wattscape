import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// The tools run under plain Node (`node --experimental-strip-types`), which resolves
// no extension-less import. Regression: tools/check-eco2mix.ts broke when
// src/data/eco2mix.ts started importing "./fetch-json" (B-004).
describe("modules the tools import", () => {
  it.each([
    "src/data/eco2mix.ts",
    "src/data/open-meteo.ts",
    "src/geo/regions.ts",
    "src/map/grid.ts",
    "src/map/france.ts",
    "src/map/relief.ts",
    "src/map/plants.ts",
    "src/map/consumption.ts",
    "src/render/art/plants.ts",
    "tools/bake-plants-rules.ts",
    "e2e/reference-frames.ts",
    "src/map/layers.ts",
    "src/render/pixel-theme.ts",
    "src/render/theme.ts",
    "src/scene/camera.ts",
    "src/scene/scene.ts",
  ])("%s loads under plain Node", (file) => {
    const out = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--no-warnings",
        "--input-type=module",
        "-e",
        `await import("./${file}"); console.log("ok");`,
      ],
      { encoding: "utf8" },
    );
    expect(out.trim()).toBe("ok");
  });
});
