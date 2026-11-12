import { describe, expect, it } from "vitest";
import { REGION_CODES } from "../src/data/eco2mix";
import { FRAME_HEIGHT, FRAME_WIDTH, recordedPlants } from "../e2e/reference-frames";
import {
  ELEVATION_CLASSES,
  FOREIGN,
  kindOfRegion,
  kmOf,
  SEA,
  type CellRegion,
} from "../src/map/grid";
import { coarseLayer, fineLayer, type TerrainLayer } from "../src/map/layers";
import { FINE_ELEVATION_RLE } from "../src/map/relief";
import { BAYER_4 } from "../src/render/dither";
import { COLOUR_NAMES, type ColourName, PALETTE } from "../src/render/palette";
import {
  drawPixelScene,
  groundColour,
  heightPx,
  minPlantMw,
  seaColour,
  tintPattern,
  townCells,
  visiblePlants,
} from "../src/render/pixel-theme";
import { createSurface, getPixel, hashSurface, type Surface } from "../src/render/surface";
import { DEFAULT_THEME, THEMES } from "../src/render/theme";
import { areaBox, type Camera, fitBox } from "../src/scene/camera";
import { bakedTowns, type Scene } from "../src/scene/scene";
import { type Light, lightAt, tinted } from "../src/sky/light";
import { mulberry32 } from "./random";

const day = lightAt(35);
const golden = lightAt(2);
const night = lightAt(-20);
const coarse = coarseLayer();
const fine = fineLayer(FINE_ELEVATION_RLE);

function sceneOf(overrides: Partial<Scene> & { camera: Camera }): Scene {
  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    light: day,
    focus: null,
    coarse,
    fine,
    detail: 16,
    towns: bakedTowns(),
    plants: [],
    // Every region's towns half lit: half their range of consumption.
    townLights: Object.fromEntries(REGION_CODES.map((r) => [r, 0.5])),
    ...overrides,
  };
}

function draw(scene: Scene): Surface {
  const out = createSurface(scene.width, scene.height);
  drawPixelScene(scene, out);
  return out;
}

const framed = (region: CellRegion | null): Camera =>
  fitBox(areaBox(coarse, region), FRAME_WIDTH, FRAME_HEIGHT);

/**
 * The whole grid at 2-pixel tiles, as the B-010 mockups drew it: a 4 km cell's top
 * face starts at x = column × 2, y = row + 9 − its height (9: room for the relief).
 */
const mockup = (light: Light): Scene =>
  sceneOf({
    width: 576,
    height: 285,
    camera: { x: 576, y: 532, scale: 0.5 },
    light,
    fine: null,
    detail: 0,
  });

function colours(s: Surface): Map<ColourName, number> {
  const byRgb = new Map(COLOUR_NAMES.map((n) => [PALETTE[n].join(), n] as const));
  const seen = new Map<ColourName, number>();
  for (let i = 0; i < s.data.length; i += 4) {
    const name = byRgb.get(
      `${String(s.data[i])},${String(s.data[i + 1])},${String(s.data[i + 2])}`,
    );
    if (name === undefined) throw new Error(`pixel ${String(i / 4)} is off the palette`);
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return seen;
}

const at = (s: Surface, x: number, y: number): string => getPixel(s, x, y).join();

function hasLamp(s: Surface): boolean {
  const [r, g, b] = PALETTE.lamp;
  for (let i = 0; i < s.data.length; i += 4)
    if (s.data[i] === r && s.data[i + 1] === g && s.data[i + 2] === b) return true;
  return false;
}

describe("tintPattern", () => {
  it("draws exactly what tinted() draws, pixel by pixel (randomized)", () => {
    const random = mulberry32(11);
    for (let n = 0; n < 2000; n++) {
      const colour = COLOUR_NAMES[Math.floor(random() * COLOUR_NAMES.length)] ?? "sea";
      const darkness = random() * 4;
      const x = Math.floor(random() * 200) - 100;
      const y = Math.floor(random() * 200) - 100;
      const word = tintPattern(colour, darkness)[(y & 3) * 4 + (x & 3)] ?? 0;
      const surface = createSurface(1, 1);
      new Uint32Array(surface.data.buffer)[0] = word;
      expect(getPixel(surface, 0, 0)).toEqual(PALETTE[tinted(colour, darkness, x, y)]);
    }
  });
});

describe("the pixel-art theme", () => {
  it("is the default and only theme, by id", () => {
    expect(DEFAULT_THEME.id).toBe("pixel");
    expect(Object.keys(THEMES)).toEqual(["pixel"]);
  });

  it("draws only palette colours, and no source colour on the bare map", () => {
    for (const light of [day, golden, night])
      for (const camera of [framed(null), framed("28"), framed("84")]) {
        const seen = colours(draw(sceneOf({ camera, light })));
        for (const source of ["nuclear", "hydro", "wind", "solar", "thermal", "bioenergy"] as const)
          expect(seen.has(source), `${light.period} ${source}`).toBe(false);
      }
  });

  it("lights town lamps at night only", () => {
    expect(colours(draw(mockup(day))).has("lamp")).toBe(false);
    // 96 prefectures, regional ones larger.
    expect(colours(draw(mockup(night))).get("lamp") ?? 0).toBeGreaterThanOrEqual(96);
  });

  it("veils the land abroad by day only, so that at night it never reads as sea", () => {
    const pixel = (s: Surface, lat: number, lon: number): string => {
      const { x, y } = kmOf(lat, lon);
      return at(s, Math.floor(x / 4) * 2, Math.floor(y / 4) + 9);
    };
    const beauce: [number, number] = [48.3, 1.6]; // French lowland, about 130 m
    const belgium: [number, number] = [50.9, 4.0]; // foreign land
    const byDay = draw(mockup(day));
    expect(pixel(byDay, ...beauce)).toBe(PALETTE.meadow.join());
    expect(pixel(byDay, ...belgium)).toBe(PALETTE.grass.join());
    const atNight = draw(mockup(night));
    expect(pixel(atNight, ...belgium)).toBe(pixel(atNight, ...beauce));
    expect(pixel(atNight, ...belgium)).not.toBe(PALETTE.sea.join());
  });

  it("veils the other regions on a region view, and not the region itself", () => {
    const { x, y } = kmOf(48.3, 1.6); // Beauce, Centre-Val de Loire (24)
    const pixel = (focus: CellRegion | null): string =>
      at(draw({ ...mockup(day), focus }), Math.floor(x / 4) * 2, Math.floor(y / 4) + 9);
    expect(pixel(null)).toBe(PALETTE.meadow.join());
    expect(pixel("24")).toBe(PALETTE.meadow.join());
    expect(pixel("28")).toBe(PALETTE.grass.join());
  });

  it("colours the altitude bands from their documented lower bounds", () => {
    // Regression: rock and snow started one class too high (1 600 m and 2 800 m).
    const band = (metres: number): string => groundColour(ELEVATION_CLASSES.indexOf(metres));
    expect(band(0)).toBe("meadow");
    expect(band(200)).toBe("meadow");
    expect(band(300)).toBe("grass");
    expect(band(800)).toBe("forest");
    expect(band(1000)).toBe("forest");
    expect(band(1300)).toBe("rock");
    expect(band(2000)).toBe("rock");
    expect(band(2400)).toBe("snow");
  });

  it("bands the sea by kilometres from the coast, the same on both layers", () => {
    expect(seaColour(4)).toBe("seaShallow");
    expect(seaColour(5)).toBe("sea");
    expect(seaColour(20)).toBe("sea");
    expect(seaColour(21)).toBe("seaDeep");
  });

  it("raises the relief by the same height on both layers, a 4 km width per 1 000 m", () => {
    expect(heightPx(ELEVATION_CLASSES.indexOf(1000), 0.5)).toBe(2);
    expect(heightPx(ELEVATION_CLASSES.indexOf(1000), 2)).toBe(8);
    expect(heightPx(15, 0.5)).toBe(7);
    expect(heightPx(0, 8)).toBe(0);
  });

  it("puts every town on French land, Bastia included, on both layers", () => {
    // Regression: the prefecture of Haute-Corse fell on a sea cell, off the coast.
    for (const layer of [coarse, fine] as TerrainLayer[]) {
      const cells = townCells(layer, bakedTowns());
      let count = 0;
      cells.forEach((t, i) => {
        if (t === 0) return;
        count++;
        expect(layer.kinds[i], String(i)).toBeGreaterThanOrEqual(2);
      });
      expect(count).toBeGreaterThan(layer.km === 1 ? 5000 : 250);
      const bastia = kmOf(42.7, 9.45);
      const r = Math.floor(bastia.y / layer.km);
      const c = Math.floor(bastia.x / layer.km);
      let near = false;
      for (let dr = -8; dr <= 8; dr++)
        for (let dc = -8; dc <= 8; dc++)
          near ||= (cells[(r + dr) * layer.columns + c + dc] ?? 0) > 0;
      expect(near, `${String(layer.km)} km`).toBe(true);
    }
  });

  it("draws every town that no relief hides, at any framing of France", () => {
    // Regression: towns on rows or columns narrower than a pixel were skipped with
    // them, 22 of 96 prefectures at 480 × 270 and 35 at 427 × 240. Of the 100 largest
    // towns, Ajaccio has no figure of consumption, so no lamps (B-014), and Chambéry
    // lies behind the relief in front of it, except on the tall framing.
    const largest = bakedTowns().slice(0, 100);
    for (const [width, height, visible] of [
      [480, 270, 98],
      [427, 240, 98],
      [293, 633, 99],
    ] as const) {
      const camera = fitBox(areaBox(coarse, null), width, height);
      let seen = 0;
      for (const town of largest) {
        const s = draw(
          sceneOf({ width, height, camera, light: night, fine: null, detail: 0, towns: [town] }),
        );
        if (hasLamp(s)) seen++;
      }
      expect(seen, `${String(width)} × ${String(height)}`).toBe(visible);
    }
  }, 30_000);

  it("draws the scene's own towns, whatever was drawn before", () => {
    // Regression: the towns of a layer were cached by layer only, so the first town
    // list ever drawn stuck to it.
    const scene = mockup(night);
    expect(colours(draw({ ...scene, towns: [] })).has("lamp")).toBe(false);
    expect(colours(draw(scene)).has("lamp")).toBe(true);
    expect(colours(draw({ ...scene, towns: [] })).has("lamp")).toBe(false);
  });

  it("hides a town behind the relief in front of it (painter's order)", () => {
    // Regression: towns were drawn after all the terrain, over the hills south of
    // them (Rodez, Saint-Étienne, Annecy).
    const s = draw(mockup(night));
    const top = (i: number): number =>
      Math.floor(i / coarse.columns) + 9 - heightPx(coarse.elevation[i] ?? 0, 0.5);
    let hidden = 0;
    townCells(coarse, bakedTowns()).forEach((town, i) => {
      if (town === 0) return;
      const x = (i % coarse.columns) * 2;
      const y = top(i);
      const south = i + coarse.columns;
      if (coarse.kinds[south] === SEA || top(south) > y) return;
      hidden++;
      expect(at(s, x, y), String(i)).not.toBe(PALETTE.lamp.join());
    });
    expect(hidden).toBeGreaterThan(0);
  });

  it("draws a south face as a cliff only where the land drops by 250 m or more", () => {
    // Regression: on the 1 km layer, every 100 m step of the plains drew a dark line.
    const normandie = colours(draw(sceneOf({ camera: framed("28"), focus: "28" })));
    // Normandie is below 300 m: meadow, and its one-step-darker cliff colour, nowhere.
    expect(normandie.get("meadow") ?? 0).toBeGreaterThan(20_000);
    const cliffs = draw(sceneOf({ camera: { ...kmOf(45.83, 6.86), scale: 4 }, focus: "84" }));
    expect(colours(cliffs).size).toBeGreaterThan(6);
  });

  it("moves the picture by whole pixels when the camera pans: no shimmer, even at dusk", () => {
    for (const light of [day, golden, night]) {
      const camera = { ...kmOf(49.4, 0.5), scale: 1.5 };
      const a = draw(sceneOf({ camera, light, focus: "28" }));
      // 5 pixels east and 3 pixels south (6 rows of half-scale kilometres).
      const b = draw(
        sceneOf({
          camera: { ...camera, x: camera.x + 5 / 1.5, y: camera.y + 6 / 1.5 },
          light,
          focus: "28",
        }),
      );
      for (let y = 0; y < FRAME_HEIGHT - 3; y += 3)
        for (let x = 0; x < FRAME_WIDTH - 5; x += 3)
          expect(at(b, x, y), `${light.period} ${String(x)},${String(y)}`).toBe(
            at(a, x + 5, y + 3),
          );
    }
  });

  it("crossfades the two layers by ordered dithering, anchored to the ground", () => {
    const camera = { ...kmOf(45.5, 3), scale: 0.6 };
    const coarseOnly = draw(sceneOf({ camera, detail: 0 }));
    const fineOnly = draw(sceneOf({ camera, detail: 16 }));
    expect(hashSurface(draw(sceneOf({ camera, detail: 16, fine: null })))).toBe(
      hashSurface(coarseOnly),
    );
    const half = draw(sceneOf({ camera, detail: 8 }));
    // The ground pixel at the buffer's top-left corner (the theme's own offset).
    const ox = Math.round(camera.x * camera.scale) - FRAME_WIDTH / 2;
    const oy = Math.round((camera.y * camera.scale) / 2) - FRAME_HEIGHT / 2;
    let differ = 0;
    for (let y = 0; y < FRAME_HEIGHT; y++)
      for (let x = 0; x < FRAME_WIDTH; x++) {
        const takesFine = (BAYER_4[(y + oy) & 3]?.[(x + ox) & 3] ?? 0) < 8;
        const want = takesFine ? at(fineOnly, x, y) : at(coarseOnly, x, y);
        if (at(fineOnly, x, y) !== at(coarseOnly, x, y)) differ++;
        if (at(half, x, y) !== want) throw new Error(`pixel ${String(x)},${String(y)}`);
      }
    expect(differ).toBeGreaterThan(1000);
  });

  it("goes on past the grid's edges: sea to the west, land to the east, sky only to the north", () => {
    const sky = new Set([PALETTE.skyDay.join()]);
    const west = draw(sceneOf({ camera: { x: -400, y: 500, scale: 1 } }));
    const east = draw(sceneOf({ camera: { x: 1400, y: 400, scale: 1 } }));
    const north = draw(sceneOf({ camera: { x: 600, y: -300, scale: 1 } }));
    expect(colours(west).has("skyDay")).toBe(false);
    expect(colours(east).has("skyDay")).toBe(false);
    expect(sky.has(at(north, 240, 10))).toBe(true);
    const sea =
      (colours(west).get("seaDeep") ?? 0) +
      (colours(west).get("sea") ?? 0) +
      (colours(west).get("seaShallow") ?? 0);
    expect(sea).toBe(FRAME_WIDTH * FRAME_HEIGHT);
    expect(colours(east).has("seaDeep")).toBe(false);
  });

  it("refuses a surface that does not have the scene's size", () => {
    expect(() => {
      drawPixelScene(sceneOf({ camera: framed(null) }), createSurface(10, 10));
    }).toThrow(/size/);
  });

  it("draws the same frame twice, at any scale (determinism)", () => {
    const random = mulberry32(5);
    for (let n = 0; n < 8; n++) {
      const camera = {
        x: 200 + random() * 800,
        y: 200 + random() * 700,
        scale: 0.2 + random() * 7,
      };
      const scene = sceneOf({
        camera,
        detail: Math.floor(random() * 17),
        light: lightAt(random() * 50 - 25),
      });
      expect(hashSurface(draw(scene))).toBe(hashSurface(draw(scene)));
    }
  });

  it("keeps foreign land and sea flat (BD ALTI covers France only)", () => {
    for (const layer of [coarse, fine] as TerrainLayer[])
      layer.kinds.forEach((k, i) => {
        if ((k === SEA || k === FOREIGN) && layer.elevation[i] !== 0) throw new Error(String(i));
      });
    expect(kindOfRegion("28")).toBeGreaterThan(FOREIGN);
  });
});

describe("plants in the pixel theme (B-012)", () => {
  const plants = recordedPlants(false);
  const normandie = sceneOf({ camera: framed("28"), focus: "28", plants });

  it("shows only the giants on the national view, then more as the camera comes close", () => {
    expect(minPlantMw(0.38)).toBe(1000);
    expect(minPlantMw(0.8)).toBe(50);
    expect(minPlantMw(1.5)).toBe(0);
    const france = visiblePlants(sceneOf({ camera: framed(null), plants }), 0, FRAME_WIDTH);
    expect(france.length).toBeGreaterThan(10);
    for (const p of france) expect(p.site.mw).toBeGreaterThanOrEqual(1000);
  });

  it("never sets two plants on top of each other: the larger one stays", () => {
    const s = normandie.camera.scale;
    const shown = visiblePlants(normandie, 0, 1e9);
    for (const a of shown)
      for (const b of shown) {
        if (a === b) continue;
        const dx = Math.abs(Math.floor(a.site.x * s) - Math.floor(b.site.x * s));
        const dy = Math.abs(Math.floor((a.site.y * s) / 2) - Math.floor((b.site.y * s) / 2));
        expect(dx >= 8 || dy >= 4, `${a.site.commune} ${b.site.commune}`).toBe(true);
      }
    // Paluel, the largest site of Normandie, is always shown.
    expect(shown.some((p) => p.site.commune === "Paluel")).toBe(true);
  });

  it("draws the plants' bodies into the still frame, and nothing when there are none", () => {
    expect(hashSurface(draw(normandie))).not.toBe(
      hashSurface(draw(sceneOf({ camera: framed("28"), focus: "28" }))),
    );
  });

  it("leaves the frame still when every plant is idle (no figure): nothing to animate", () => {
    const idle = plants.map((p) => ({ ...p, activity: null }));
    const out = createSurface(FRAME_WIDTH, FRAME_HEIGHT);
    const drawn = drawPixelScene(sceneOf({ camera: framed("28"), focus: "28", plants: idle }), out);
    expect(drawn.moving).toBe(false);
    const before = hashSurface(out);
    drawn.animate(out, 2.5);
    expect(hashSurface(out)).toBe(before);
  });

  it("animates the same pixels for the same time, other pixels at another", () => {
    const at = (seconds: number): string => {
      const out = createSurface(FRAME_WIDTH, FRAME_HEIGHT);
      const drawn = drawPixelScene(normandie, out);
      expect(drawn.moving).toBe(true);
      drawn.animate(out, seconds);
      return hashSurface(out);
    };
    expect(at(1.3)).toBe(at(1.3));
    expect(at(1.3)).not.toBe(at(1.7));
  });

  it("draws nothing into a target of another size", () => {
    const drawn = drawPixelScene(normandie, createSurface(FRAME_WIDTH, FRAME_HEIGHT));
    const other = createSurface(10, 10);
    drawn.animate(other, 1);
    expect(other.data.every((v) => v === 0)).toBe(true);
  });
});
