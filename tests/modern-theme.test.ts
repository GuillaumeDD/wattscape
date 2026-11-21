import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH, referenceScene } from "../e2e/reference-frames";
import { type CellRegion } from "../src/map/grid";
import { coarseLayer } from "../src/map/layers";
import {
  coastDistance,
  drawModernScene,
  MODERN_PIXEL_BUDGET,
  MODERN_SHARP_DENSITY,
  MODERN_TINTS,
  modernDensity,
  modernLight,
  modernMapDensity,
  modernSea,
  modernSky,
  modernTint,
  spread,
} from "../src/render/modern-theme";
import { drawPixelScene } from "../src/render/pixel-theme";
import { createSurface, hashSurface, type Surface } from "../src/render/surface";
import { THEMES } from "../src/render/theme";
import { DEFAULT_THEME_ID, isThemeId, THEME_IDS } from "../src/render/theme-ids";
import { areaBox, type Camera, fitBox } from "../src/scene/camera";
import { type Scene } from "../src/scene/scene";
import { mulberry32 } from "./random";

const framed = (region: CellRegion | null): Camera =>
  fitBox(areaBox(coarseLayer(), region), FRAME_WIDTH, FRAME_HEIGHT);

function draw(scene: Scene, density = 2): Surface {
  const out = createSurface(scene.width * density, scene.height * density);
  drawModernScene(scene, out);
  return out;
}

/** The brightest red of a frame: the lamps are the only thing that bright at night. */
function brightest(surface: Surface): number {
  let max = 0;
  for (let i = 0; i < surface.data.length; i += 4) max = Math.max(max, surface.data[i] ?? 0);
  return max;
}

describe("theme names", () => {
  it("has a theme for every id, each under its own id, the modern one the default", () => {
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort());
    for (const id of THEME_IDS) expect(THEMES[id].id).toBe(id);
    // D-079: the modern theme by default, listed first in the panel.
    expect(DEFAULT_THEME_ID).toBe("modern");
    expect(THEME_IDS[0]).toBe("modern");
  });

  it("accepts the known ids only", () => {
    for (const id of THEME_IDS) expect(isThemeId(id)).toBe(true);
    for (const value of ["", "Modern", "modern ", "toString", "__proto__", 1, null, undefined, {}])
      expect(isThemeId(value), JSON.stringify(value)).toBe(false);
  });
});

describe("spread", () => {
  /** The same reading, in fractions: between the centres of the four nearest pixels. */
  function naive(from: Uint8ClampedArray, width: number, height: number): Float64Array {
    const out = new Float64Array(width * 2 * height * 2 * 4);
    const at = (x: number, y: number, c: number): number =>
      from[
        (Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * 4 + c
      ] ?? 0;
    for (let y = 0; y < height * 2; y++)
      for (let x = 0; x < width * 2; x++) {
        const u = (x + 0.5) / 2 - 0.5;
        const v = (y + 0.5) / 2 - 0.5;
        const x0 = Math.floor(u);
        const y0 = Math.floor(v);
        for (let c = 0; c < 4; c++)
          out[(y * width * 2 + x) * 4 + c] =
            (at(x0, y0, c) * (1 - (u - x0)) + at(x0 + 1, y0, c) * (u - x0)) * (1 - (v - y0)) +
            (at(x0, y0 + 1, c) * (1 - (u - x0)) + at(x0 + 1, y0 + 1, c) * (u - x0)) * (v - y0);
      }
    return out;
  }

  it("reads each pixel between the four nearest, as a naive reference does, to half a level", () => {
    const rng = mulberry32(58);
    for (let round = 0; round < 40; round++) {
      const width = 1 + Math.floor(rng() * 9);
      const height = 1 + Math.floor(rng() * 9);
      const from = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < from.length; i++) from[i] = i % 4 === 3 ? 255 : Math.floor(rng() * 256);
      const out = createSurface(width * 2, height * 2);
      spread(from, width, height, out);
      const expected = naive(from, width, height);
      for (let i = 0; i < out.data.length; i++)
        expect(Math.abs((out.data[i] ?? 0) - (expected[i] ?? 0))).toBeLessThanOrEqual(0.5);
    }
  });

  it("keeps a flat picture as it is, opaque", () => {
    const from = new Uint8ClampedArray(3 * 2 * 4);
    for (let i = 0; i < from.length; i += 4) from.set([255, 0, 137, 255], i);
    const out = createSurface(6, 4);
    spread(from, 3, 2, out);
    for (let i = 0; i < out.data.length; i += 4)
      expect([...out.data.subarray(i, i + 4)]).toEqual([255, 0, 137, 255]);
  });

  it("refuses a surface that is not twice the picture", () => {
    const from = new Uint8ClampedArray(3 * 2 * 4);
    expect(() => {
      spread(from, 3, 2, createSurface(9, 6));
    }).toThrow();
    expect(() => {
      spread(from, 3, 2, createSurface(6, 6));
    }).toThrow();
    expect(() => {
      spread(from, 2, 2, createSurface(4, 4));
    }).toThrow();
  });
});

describe("modernDensity", () => {
  it("is sharp on a full HD screen and on larger ones: 4, the map drawn at 2 (D-058)", () => {
    expect(MODERN_SHARP_DENSITY).toBe(4);
    expect(modernDensity(480, 270, 4)).toBe(4);
    expect(modernDensity(640, 360, 6)).toBe(4);
    expect(modernMapDensity(4)).toBe(2);
    for (const d of [1, 2, 3, 5, 6]) expect(modernMapDensity(d)).toBe(d);
  });

  it("stays at 2 where the screen has fewer than 4 pixels per scene pixel", () => {
    expect(modernDensity(480, 270, 3)).toBe(2);
    expect(modernDensity(480, 270, 2)).toBe(2);
  });

  it("draws more in a small window, up to the device's pixels, within the budget", () => {
    expect(modernDensity(267, 200, 3)).toBe(3);
    const rng = mulberry32(11);
    for (let i = 0; i < 200; i++) {
      const width = 1 + Math.floor(rng() * 700);
      const height = 1 + Math.floor(rng() * 400);
      const factor = 3 + Math.floor(rng() * 4);
      const d = modernDensity(width, height, factor);
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(factor);
      // The budget is the map's: its pixels are the ones that cost.
      const map = modernMapDensity(d);
      if (map > 2) expect(width * height * map * map).toBeLessThanOrEqual(MODERN_PIXEL_BUDGET);
    }
  });

  it("falls back to 2 on a factor that is not a number", () => {
    expect(modernDensity(480, 270, Number.NaN)).toBe(2);
    expect(modernDensity(480, 270, Number.POSITIVE_INFINITY)).toBe(2);
    expect(modernDensity(480, 270, 0)).toBe(2);
  });

  it("halves the map's, rounded down and never under 1, while the camera moves (Q-34)", () => {
    for (const [width, height, factor] of [
      [480, 270, 4],
      [320, 180, 3],
      [160, 90, 6],
      [480, 270, Number.NaN],
    ] as const) {
      const still = modernMapDensity(modernDensity(width, height, factor));
      const moving = modernDensity(width, height, factor, true);
      expect(moving).toBe(Math.floor(still / 2));
      expect(moving).toBeGreaterThanOrEqual(1);
      expect(moving * moving * 4).toBeLessThanOrEqual(still * still);
    }
  });

  it("is 1 for pixel art, moving or not", () => {
    expect(THEMES.pixel.density(480, 270, 4)).toBe(1);
    expect(THEMES.pixel.density(480, 270, 4, true)).toBe(1);
  });
});

describe("the modern colours", () => {
  it("gives each altitude its tint, linear between two keys, flat beyond the ends", () => {
    for (const [metres, colour] of MODERN_TINTS) expect(modernTint(metres)).toEqual(colour);
    const [a, b] = [MODERN_TINTS[2], MODERN_TINTS[3]];
    if (a === undefined || b === undefined) throw new Error("tints");
    const mid = modernTint((a[0] + b[0]) / 2);
    for (let k = 0; k < 3; k++) expect(mid[k]).toBeCloseTo(((a[1][k] ?? 0) + (b[1][k] ?? 0)) / 2);
    expect(modernTint(-5)).toEqual(MODERN_TINTS[0]?.[1]);
    expect(modernTint(9000)).toEqual(MODERN_TINTS[MODERN_TINTS.length - 1]?.[1]);
  });

  it("darkens the sea away from the coast, never lighter (randomized)", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 300; i++) {
      const near = rng() * 120;
      const far = near + rng() * 30;
      const [a, b] = [modernSea(near), modernSea(far)];
      expect(a[0] + a[1] + a[2]).toBeGreaterThanOrEqual(b[0] + b[1] + b[2] - 1e-9);
    }
  });

  it("lights the land white by day, darker as the sun sinks, and reads NaN as night", () => {
    expect(modernLight(0)).toEqual([1, 1, 1]);
    expect(modernLight(-3)).toEqual([1, 1, 1]);
    expect(modernLight(Number.NaN)).toEqual(modernLight(2));
    expect(modernLight(7)).toEqual(modernLight(2));
    let before = 3;
    for (let d = 0; d <= 2.0001; d += 1 / 16) {
      const [r, g, b] = modernLight(d);
      expect(r + g + b).toBeLessThanOrEqual(before + 1e-9);
      before = r + g + b;
    }
  });

  it("moves the light and the sky without a jump (randomized)", () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 300; i++) {
      const d = rng() * 2;
      const t = rng();
      const [a, b] = [modernLight(d), modernLight(d + 0.001)];
      const [s, u] = [modernSky(d, t), modernSky(d + 0.001, t)];
      for (let k = 0; k < 3; k++) {
        expect(Math.abs((a[k] ?? 0) - (b[k] ?? 0))).toBeLessThan(0.002);
        expect(Math.abs((s[k] ?? 0) - (u[k] ?? 0))).toBeLessThan(0.5);
      }
    }
  });
});

describe("coastDistance", () => {
  it("stays close to the straight-line distance to the land (randomized, naive reference)", () => {
    const rng = mulberry32(3);
    const columns = 48;
    const rows = 36;
    const land = new Uint8Array(columns * rows);
    for (let k = 0; k < 9; k++) land[Math.floor(rng() * land.length)] = 255;
    const found = coastDistance(land, columns, rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        let nearest = Infinity;
        for (let i = 0; i < land.length; i++)
          if (land[i] === 255)
            nearest = Math.min(nearest, Math.hypot(r - Math.floor(i / columns), c - (i % columns)));
        // A 3-4 chamfer is within 8 % of the straight line; the blur moves it by
        // under a cell.
        const cells = (found[r * columns + c] ?? 0) / 3;
        expect(Math.abs(cells - nearest)).toBeLessThanOrEqual(0.08 * nearest + 1);
      }
  });

  it("is capped at a hundred cells, and is all zero on land", () => {
    const sea = coastDistance(new Uint8Array(400), 20, 20);
    expect(new Set(sea)).toEqual(new Set([300]));
    const land = coastDistance(new Uint8Array(400).fill(255), 20, 20);
    expect(new Set(land)).toEqual(new Set([0]));
  });
});

describe("drawModernScene", () => {
  const normandie = referenceScene("28", framed("28"), 35);

  it("refuses a surface that is not a whole multiple of the scene", () => {
    for (const [w, h] of [
      [FRAME_WIDTH * 2, FRAME_HEIGHT * 3],
      [FRAME_WIDTH * 2 + 1, FRAME_HEIGHT * 2],
      [FRAME_WIDTH / 2, FRAME_HEIGHT / 2],
      [0, 0],
    ] as const)
      expect(() => drawModernScene(normandie, createSurface(w, h))).toThrow();
  });

  it("draws every pixel, opaque, at any density", () => {
    for (const density of [1, 2, 3]) {
      const out = draw(normandie, density);
      for (let i = 3; i < out.data.length; i += 4)
        if (out.data[i] !== 255) throw new Error(`pixel ${String(i >> 2)} is not opaque`);
    }
  });

  it("draws the same frame twice, also after another frame was drawn in between", () => {
    const first = hashSurface(draw(normandie));
    draw(referenceScene(null, framed(null), -20));
    expect(hashSurface(draw(normandie))).toBe(first);
  });

  it("shows the marks of the pixel-art theme, at the same places within 2 pixels", () => {
    for (const [focus, elevation] of [
      ["28", 35],
      ["84", -20],
      [null, 35],
    ] as const) {
      const scene = referenceScene(focus, framed(focus), elevation);
      const modern = drawModernScene(scene, createSurface(scene.width * 2, scene.height * 2));
      const pixel = drawPixelScene(scene, createSurface(scene.width, scene.height));
      expect(modern.marks.map((m) => m.id).sort()).toEqual(pixel.marks.map((m) => m.id).sort());
      expect(modern.moving).toBe(pixel.moving);
      for (const mark of modern.marks) {
        const other = pixel.marks.find((m) => m.id === mark.id);
        if (other === undefined) throw new Error(mark.id);
        expect(Math.abs(mark.left - other.left), mark.id).toBeLessThanOrEqual(2);
        // The relief is smoothed here: a foot stands up to a class's step away.
        expect(Math.abs(mark.bottom - other.bottom), mark.id).toBeLessThanOrEqual(
          2 + Math.ceil(scene.camera.scale * 2),
        );
        expect(mark.right - mark.left).toBe(other.right - other.left);
      }
    }
  });

  it("draws the plants and the landmarks at their marks, and touches nothing else", () => {
    for (const [focus, elevation] of [
      ["28", 35],
      ["84", -20],
      [null, 35],
    ] as const) {
      const scene = referenceScene(focus, framed(focus), elevation);
      const full = createSurface(scene.width * 2, scene.height * 2);
      const { marks } = drawModernScene(scene, full);
      const bare = draw({ ...scene, plants: [], landmarks: [] });
      // A rotor's blades and a shadow reach a few pixels past a box.
      const near = new Uint8Array(scene.width * scene.height);
      for (const m of marks)
        for (let y = Math.max(0, m.top - 4); y < Math.min(scene.height, m.bottom + 3); y++)
          for (let x = Math.max(0, m.left - 4); x < Math.min(scene.width, m.right + 4); x++)
            near[y * scene.width + x] = 1;
      let changed = 0;
      for (let p = 0; p < full.width * full.height; p++) {
        if (
          full.data[p * 4] === bare.data[p * 4] &&
          full.data[p * 4 + 1] === bare.data[p * 4 + 1] &&
          full.data[p * 4 + 2] === bare.data[p * 4 + 2]
        )
          continue;
        changed++;
        const x = Math.floor((p % full.width) / 2);
        const y = Math.floor(Math.floor(p / full.width) / 2);
        expect(near[y * scene.width + x], `${String(x)},${String(y)}`).toBe(1);
      }
      expect(changed).toBeGreaterThan(0);
    }
  });

  it("at the sharp density, spreads the map drawn at half of it, and nothing else", () => {
    for (const [focus, elevation] of [
      ["28", 35],
      [null, -20],
    ] as const) {
      const bare = {
        ...referenceScene(focus, framed(focus), elevation),
        plants: [],
        landmarks: [],
      };
      const half = draw(bare, 2);
      const expected = createSurface(bare.width * 4, bare.height * 4);
      spread(half.data, half.width, half.height, expected);
      expect(hashSurface(draw(bare, 4))).toBe(hashSurface(expected));
    }
  });

  it("at the sharp density, draws what stands on the map at its marks, and finer", () => {
    const scene = referenceScene("28", framed("28"), 35);
    const full = createSurface(scene.width * 4, scene.height * 4);
    const { marks } = drawModernScene(scene, full);
    const bare = draw({ ...scene, plants: [], landmarks: [] }, 4);
    const near = new Uint8Array(scene.width * scene.height);
    for (const m of marks)
      for (let y = Math.max(0, m.top - 4); y < Math.min(scene.height, m.bottom + 3); y++)
        for (let x = Math.max(0, m.left - 4); x < Math.min(scene.width, m.right + 4); x++)
          near[y * scene.width + x] = 1;
    // A scene pixel that holds a detail: its 16 pixels are not all the same.
    let changed = 0;
    let detailed = 0;
    for (let y = 0; y < scene.height; y++)
      for (let x = 0; x < scene.width; x++) {
        const values = new Set<number>();
        let differs = false;
        for (let dy = 0; dy < 4; dy++)
          for (let dx = 0; dx < 4; dx++) {
            const i = ((y * 4 + dy) * full.width + x * 4 + dx) * 4;
            values.add(full.data[i] ?? 0);
            if (
              full.data[i] !== bare.data[i] ||
              full.data[i + 1] !== bare.data[i + 1] ||
              full.data[i + 2] !== bare.data[i + 2]
            )
              differs = true;
          }
        if (!differs) continue;
        changed++;
        if (values.size > 4) detailed++;
        expect(near[y * scene.width + x], `${String(x)},${String(y)}`).toBe(1);
      }
    expect(changed).toBeGreaterThan(100);
    // More than four levels in a scene pixel: finer than 2 pixels each way could show.
    expect(detailed).toBeGreaterThan(50);
  });

  it("lights no lamp without a figure, and lamps where there is one", () => {
    const camera = framed("11");
    const base = { ...referenceScene("11", camera, -20), plants: [], landmarks: [] };
    const dark = brightest(draw({ ...base, townLights: {} }));
    const lit = brightest(draw(base));
    expect(dark).toBeLessThan(110);
    expect(lit).toBeGreaterThan(200);
    // By day the lamps are off, whatever the figure.
    const noon = { ...referenceScene("11", camera, 35), plants: [], landmarks: [] };
    expect(hashSurface(draw({ ...noon, townLights: {} }))).toBe(hashSurface(draw(noon)));
  });

  it("lights more lamps the more a region consumes", () => {
    const camera = framed("11");
    const base = { ...referenceScene("11", camera, -20), plants: [], landmarks: [] };
    const sum = (surface: Surface): number => surface.data.reduce((a, b) => a + b, 0);
    const low = sum(draw({ ...base, townLights: { "11": 0 } }));
    const high = sum(draw({ ...base, townLights: { "11": 1 } }));
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(sum(draw({ ...base, townLights: {} })));
  });

  it("sets the region in focus apart from the land around, by day and by night", () => {
    for (const elevation of [35, -20]) {
      const scene = { ...referenceScene("28", framed("28"), elevation), plants: [], landmarks: [] };
      expect(hashSurface(draw(scene))).not.toBe(hashSurface(draw({ ...scene, focus: null })));
    }
  });

  it("draws the motion over a copy of the frame, the same at the same time", () => {
    const still = createSurface(normandie.width * 2, normandie.height * 2);
    const drawn = drawModernScene(normandie, still);
    expect(drawn.moving).toBe(true);
    const at = (seconds: number): string => {
      const copy = createSurface(still.width, still.height);
      copy.data.set(still.data);
      drawn.animate(copy, seconds);
      return hashSurface(copy);
    };
    expect(at(1.3)).toBe(at(1.3));
    expect(at(1.3)).not.toBe(at(0.4));
    expect(at(1.3)).not.toBe(hashSurface(still));
    // A target of another size is left alone.
    const other = createSurface(normandie.width, normandie.height);
    const before = hashSurface(other);
    drawn.animate(other, 1.3);
    expect(hashSurface(other)).toBe(before);
  });

  it("says where the motion was drawn: outside these boxes, the frame is as it was", () => {
    for (const density of [2, 4]) {
      const still = createSurface(normandie.width * density, normandie.height * density);
      const drawn = drawModernScene(normandie, still);
      for (const seconds of [0.4, 1.3, 2.7]) {
        const copy = createSurface(still.width, still.height);
        copy.data.set(still.data);
        const boxes = drawn.animate(copy, seconds) ?? [];
        expect(boxes.length).toBeGreaterThan(0);
        const inside = new Uint8Array(copy.width * copy.height);
        for (const box of boxes) {
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.top).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(copy.width);
          expect(box.bottom).toBeLessThanOrEqual(copy.height);
          for (let y = box.top; y < box.bottom; y++)
            inside.fill(1, y * copy.width + box.left, y * copy.width + box.right);
        }
        let changed = 0;
        let outside = 0;
        for (let i = 0; i < copy.data.length; i++) {
          if (copy.data[i] === still.data[i]) continue;
          changed++;
          if (inside[i >> 2] !== 1) outside++;
        }
        expect(changed).toBeGreaterThan(0);
        expect(outside).toBe(0);
        // The boxes are about the plants, not the whole frame.
        expect(inside.reduce((sum, v) => sum + v, 0)).toBeLessThan(inside.length / 10);
      }
    }
    // A target of another size: nothing drawn, no box.
    const drawn = drawModernScene(
      normandie,
      createSurface(normandie.width * 2, normandie.height * 2),
    );
    expect(drawn.animate(createSurface(normandie.width, normandie.height), 1.3)).toEqual([]);
  });

  it("draws a slow pan from a plate, every pixel and mark as a full draw gives them (B-028)", () => {
    const base = framed("28");
    for (const [label, elevation, detail] of [
      ["4 km, day", 35, 0],
      ["1 km, night", -20, 8],
      ["crossfade, day", 35, 3],
    ] as const) {
      const at = (dx: number, dy: number, sun = elevation): Scene => ({
        ...referenceScene(
          "28",
          { ...base, x: base.x + dx / base.scale, y: base.y + (2 * dy) / base.scale },
          sun,
        ),
        width: 120,
        height: 68,
        detail,
      });
      // A pan, a pixel at a time, then a leap past the plate's reach.
      const path = [
        [0, 0],
        [1, 0],
        [2, 1],
        [1, 2],
        [-1, 1],
        [30, -15],
        [31, -15],
      ] as const;
      const panned = path.map(([dx, dy]) => {
        const out = draw(at(dx, dy));
        return hashSurface(out);
      });
      const full = path.map(([dx, dy]) => {
        // Another light in between: what was drawn before is not reused.
        draw(at(dx + 40, dy, elevation > 0 ? -20 : 35));
        draw(at(dx + 41, dy, elevation > 0 ? -20 : 35));
        return hashSurface(draw(at(dx, dy)));
      });
      expect(panned, label).toEqual(full);
      // And the marks, and the motion over the frame, at the same places.
      const a = drawModernScene(at(2, 1), createSurface(240, 136));
      draw(at(50, 0, -20));
      draw(at(51, 0, -20));
      const b = drawModernScene(at(2, 1), createSurface(240, 136));
      expect(a.marks, label).toEqual(b.marks);
    }
  });

  it("shows the 4 km layer alone until the 1 km one is there", () => {
    const camera = framed("28");
    const scene = referenceScene("28", camera, 35);
    expect(hashSurface(draw({ ...scene, fine: null }))).toBe(
      hashSurface(draw({ ...scene, detail: 0 })),
    );
    expect(hashSurface(draw({ ...scene, detail: 8 }))).not.toBe(hashSurface(draw(scene)));
  });
});
