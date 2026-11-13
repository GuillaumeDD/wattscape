import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH } from "../e2e/reference-frames";
import { REGION_CODES } from "../src/data/eco2mix";
import { FINE_ROWS_RLE } from "../src/map/france";
import { decodeRuns, FINE_COLUMNS, FINE_ROWS, kmOf, SEA } from "../src/map/grid";
import { LANDMARKS } from "../src/map/landmarks";
import { coarseLayer, fineLayer } from "../src/map/layers";
import { FINE_ELEVATION_RLE } from "../src/map/relief";
import { LESSER_RIVERS_PACKED } from "../src/map/rivers-fine";
import { drawLandmark, LANDMARK_SPRITES } from "../src/render/art/landmarks";
import { type Pen } from "../src/render/art/plants";
import { type ColourName, PALETTE } from "../src/render/palette";
import { drawPixelScene, SPRITES_FROM_SCALE } from "../src/render/pixel-theme";
import { createSurface } from "../src/render/surface";
import { type Camera } from "../src/scene/camera";
import { type Scene } from "../src/scene/scene";
import { lightAt } from "../src/sky/light";

/** The rows of docs/POI.md: id → decision. */
function poiDecisions(): Map<string, string> {
  const rows = readFileSync(new URL("../docs/POI.md", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.startsWith("| P-"))
    .map((l) => l.split("|").map((c) => c.trim()));
  return new Map(rows.map((c) => [c[1] ?? "", c[4] ?? ""]));
}

describe("the landmarks (src/map/landmarks.ts)", () => {
  it("are each GO in docs/POI.md, once", () => {
    const decisions = poiDecisions();
    for (const l of LANDMARKS) expect(decisions.get(l.id), l.id).toBe("GO");
    expect(new Set(LANDMARKS.map((l) => l.id)).size).toBe(LANDMARKS.length);
  });

  it("stand on the coast of Seine-Maritime, within 2 km of the sea", () => {
    const kinds = decodeRuns(FINE_ROWS_RLE, FINE_COLUMNS);
    for (const l of LANDMARKS) {
      expect(l.x, l.id).toBeGreaterThan(0);
      expect(l.y, l.id).toBeGreaterThan(0);
      expect(l.x, l.id).toBeLessThan(FINE_COLUMNS);
      expect(l.y, l.id).toBeLessThan(FINE_ROWS);
      let sea = false;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++)
          sea ||= kinds[(Math.floor(l.y) + dr) * FINE_COLUMNS + Math.floor(l.x) + dc] === SEA;
      expect(sea, l.id).toBe(true);
    }
  });
});

describe("the landmarks' sprites (src/render/art/landmarks.ts)", () => {
  const recorder = (emissive: boolean): Pen & { pixels: Map<string, string> } => {
    const pixels = new Map<string, string>();
    return {
      pixels,
      emissive,
      put: (x, y, c: ColourName) => pixels.set(`${String(x)},${String(y)}`, c),
      glow: (x, y) => pixels.set(`${String(x)},${String(y)}`, "lamp"),
    };
  };

  it("are rectangular pixel maps", () => {
    for (const [name, map] of Object.entries(LANDMARK_SPRITES))
      for (const row of map) expect(row.length, name).toBe(map[0]?.length);
  });

  it("stand on their anchor, and light their lights at night only", () => {
    for (const l of LANDMARKS) {
      const day = recorder(false);
      drawLandmark(day, l, 50, 50);
      expect(
        [...day.pixels.keys()].some((k) => k.endsWith(",50")),
        l.id,
      ).toBe(true);
      expect([...day.pixels.keys()].every((k) => Number(k.split(",")[1]) <= 50)).toBe(true);
      expect([...day.pixels.values()]).not.toContain("lamp");
      const night = recorder(true);
      drawLandmark(night, l, 50, 50);
      const lights = LANDMARK_SPRITES[l.sprite].join("").split("L").length - 1;
      expect(
        [...night.pixels.values()].filter((c) => c === "lamp"),
        l.id,
      ).toHaveLength(lights);
    }
  });
});

describe("the landmarks in a frame", () => {
  const coarse = coarseLayer();
  const fine = fineLayer(FINE_ELEVATION_RLE, LESSER_RIVERS_PACKED);
  const etretat = LANDMARKS.find((l) => l.id === "P-001");
  const sceneAt = (camera: Camera, landmarks: Scene["landmarks"]): Scene => ({
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    camera,
    light: lightAt(35),
    focus: "28",
    coarse,
    fine,
    detail: 16,
    towns: [],
    plants: [],
    townLights: Object.fromEntries(REGION_CODES.map((r) => [r, 0.5])),
    landmarks,
  });
  const snow = (scene: Scene): number => {
    const out = createSurface(scene.width, scene.height);
    drawPixelScene(scene, out);
    const [r, g, b] = PALETTE.snow;
    let n = 0;
    for (let i = 0; i < out.data.length; i += 4)
      if (out.data[i] === r && out.data[i + 1] === g && out.data[i + 2] === b) n++;
    return n;
  };

  it("show Étretat's chalk at a region's scale, and nothing on the national view", () => {
    if (etretat === undefined) throw new Error("no Étretat");
    const near = { ...kmOf(49.7, 0.3), scale: 2 };
    expect(snow(sceneAt(near, [etretat]))).toBeGreaterThan(snow(sceneAt(near, [])));
    const far = { ...near, scale: SPRITES_FROM_SCALE / 2 };
    expect(snow(sceneAt(far, [etretat]))).toBe(snow(sceneAt(far, [])));
  });
});
