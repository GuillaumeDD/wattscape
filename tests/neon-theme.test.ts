import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH, referenceScene } from "../e2e/reference-frames";
import { ELEVATION_CLASSES, type CellRegion } from "../src/map/grid";
import { coarseLayer } from "../src/map/layers";
import { drawModernScene, modernDensity } from "../src/render/modern-theme";
import {
  drawNeonScene,
  NEON_CONTOURS_FAR,
  NEON_CONTOURS_NEAR,
  NEON_LAMP,
  type NeonFrame,
  NEON_PLANT_FLOOR,
  NEON_SOURCES,
  neonGlow,
  neonNight,
  neonPlantColour,
  neonTheme,
  neonToolsOf,
} from "../src/render/neon-theme";
import { box, lamp, shadow } from "../src/render/art/shapes";
import { type Rgb } from "../src/render/palette";
import { createSurface, hashSurface, type Surface } from "../src/render/surface";
import { areaBox, type Camera, fitBox } from "../src/scene/camera";
import { type Scene } from "../src/scene/scene";

const framed = (region: CellRegion | null): Camera =>
  fitBox(areaBox(coarseLayer(), region), FRAME_WIDTH, FRAME_HEIGHT);

function draw(scene: Scene, density = 2): Surface {
  const out = createSurface(scene.width * density, scene.height * density);
  drawNeonScene(scene, out);
  return out;
}

/** How many pixels are lamp-coloured: much more red than blue, and bright. */
function amber(surface: Surface): number {
  let count = 0;
  const d = surface.data;
  for (let i = 0; i < d.length; i += 4)
    if ((d[i] ?? 0) > 120 && (d[i] ?? 0) > 1.6 * (d[i + 2] ?? 0)) count++;
  return count;
}

describe("neonGlow", () => {
  it("is brightest on the line, falls with the distance, and never goes negative", () => {
    let last = Infinity;
    for (let d = 0; d <= 40; d += 0.25) {
      const g = neonGlow(d, 2, 5);
      expect(g).toBeGreaterThan(0);
      expect(g).toBeLessThanOrEqual(last);
      last = g;
    }
    // A full core on the line, its halo on top.
    expect(neonGlow(0, 2, 5)).toBeCloseTo(1.45, 10);
    // Far away, the halo alone, under a twentieth.
    expect(neonGlow(40, 2, 5)).toBeLessThan(0.05);
  });

  it("is wider with a wider core and a wider halo", () => {
    expect(neonGlow(2, 4, 5)).toBeGreaterThan(neonGlow(2, 2, 5));
    expect(neonGlow(6, 2, 10)).toBeGreaterThan(neonGlow(6, 2, 5));
  });
});

describe("neonNight", () => {
  it("goes from 0 by day to 1 at night, and is night with no figure", () => {
    expect(neonNight(0)).toBe(0);
    expect(neonNight(0.4)).toBe(0);
    expect(neonNight(1)).toBeCloseTo(0.5, 10);
    expect(neonNight(1.6)).toBe(1);
    expect(neonNight(2)).toBe(1);
    expect(neonNight(Number.NaN)).toBe(1);
  });
});

describe("contour levels", () => {
  it("never lie on a class's floor, which is a plateau, and rise", () => {
    for (const levels of [NEON_CONTOURS_NEAR, NEON_CONTOURS_FAR]) {
      for (const level of levels) expect(ELEVATION_CLASSES).not.toContain(level);
      expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    }
    // The national view's are a subset of the close view's.
    for (const level of NEON_CONTOURS_FAR) expect(NEON_CONTOURS_NEAR).toContain(level);
  });
});

describe("drawNeonScene", () => {
  it("has the modern theme's density, and refuses a surface of another size", () => {
    expect(neonTheme.id).toBe("neon");
    for (const [w, h, f, moving] of [
      [480, 270, 4, false],
      [480, 270, 2, false],
      [200, 120, 6, false],
      [480, 270, 4, true],
    ] as const)
      expect(neonTheme.density(w, h, f, moving)).toBe(modernDensity(w, h, f, moving));
    const scene = referenceScene("28", framed("28"), 35);
    expect(() =>
      drawNeonScene(scene, createSurface(scene.width * 2 + 1, scene.height * 2)),
    ).toThrow();
    expect(() => drawNeonScene(scene, createSurface(scene.width * 2, scene.height * 3))).toThrow();
  });

  // One case per density: both in one test passed in 3 s here, then timed out at 5 s
  // in CI once the seasons and the snow were added (B-043).
  it.each([2, 4])("draws the same frame from the same scene, at density %i", (density) => {
    const scene = referenceScene("84", framed("84"), -20);
    const a = hashSurface(draw(scene, density));
    // Another scene in between: nothing kept from it shows.
    draw(referenceScene("28", framed("28"), 35), density);
    expect(hashSurface(draw(scene, density))).toBe(a);
  });

  it("is dark: most pixels well under mid-grey, by day and at night", () => {
    for (const elevation of [35, -20]) {
      const out = draw(referenceScene("28", framed("28"), elevation));
      const d = out.data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4)
        if ((d[i] ?? 0) + (d[i + 1] ?? 0) + (d[i + 2] ?? 0) < 3 * 90) dark++;
      expect(dark / (d.length / 4), String(elevation)).toBeGreaterThan(0.85);
    }
  });

  it("lights the towns' lamps at night only, and none for a region with no figure", () => {
    const night = referenceScene("28", framed("28"), -20);
    const day = referenceScene("28", framed("28"), 35);
    expect(amber(draw(night))).toBeGreaterThan(200);
    expect(amber(draw({ ...day, plants: [] }))).toBeLessThan(amber(draw(night)) / 10);
    // No figure anywhere: no lamp.
    expect(amber(draw({ ...night, townLights: {}, plants: [] }))).toBeLessThan(
      amber(draw(night)) / 10,
    );
    expect(NEON_LAMP[0]).toBeGreaterThan(NEON_LAMP[2]);
  });

  it("puts the marks where the modern theme puts them, so the captions are the same", () => {
    for (const [focus, elevation] of [
      [null, 35],
      ["28", -20],
      ["84", 35],
    ] as const) {
      const scene = referenceScene(focus, framed(focus), elevation);
      const neon = drawNeonScene(scene, createSurface(scene.width * 2, scene.height * 2));
      const modern = drawModernScene(scene, createSurface(scene.width * 2, scene.height * 2));
      expect(neon.marks, String(focus)).toEqual(modern.marks);
      expect(neon.moving).toBe(modern.moving);
    }
  });

  it("draws a slow pan from a plate, every pixel and mark as a full draw gives them", () => {
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
      const panned = path.map(([dx, dy]) => hashSurface(draw(at(dx, dy))));
      const full = path.map(([dx, dy]) => {
        // Another zoom in between: what was drawn before is not reused, and the next
        // draw is a full one (the camera did more than pan).
        const scene = at(dx, dy);
        draw({ ...scene, camera: { ...scene.camera, scale: scene.camera.scale * 1.01 } });
        return hashSurface(draw(scene));
      });
      expect(panned, label).toEqual(full);
    }
  });

  it("animates the plants into the boxes it says, and nothing into a surface of another size", () => {
    const scene = referenceScene("28", framed("28"), 35);
    const out = createSurface(scene.width * 4, scene.height * 4);
    const drawn = drawNeonScene(scene, out);
    expect(drawn.moving).toBe(true);
    const before = out.data.slice();
    const boxes = drawn.animate(out, 1.3) ?? [];
    expect(boxes.length).toBeGreaterThan(0);
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < out.width; x++) {
        const i = (y * out.width + x) * 4;
        if (out.data[i] === before[i] && out.data[i + 1] === before[i + 1]) continue;
        const inside = boxes.some((b) => x >= b.left && x < b.right && y >= b.top && y < b.bottom);
        expect(inside, `${String(x)}, ${String(y)}`).toBe(true);
      }
    expect(drawn.animate(createSurface(scene.width, scene.height), 1.3)).toEqual([]);
  });
});

describe("neonPlantColour", () => {
  const full = NEON_SOURCES.nuclear;
  const at = (a: number | null): number => neonPlantColour("nuclear", a)[0] / full[0];
  it("is dim at rest, full at full activity, and in between in proportion", () => {
    expect(at(0)).toBeCloseTo(NEON_PLANT_FLOOR, 9);
    expect(at(1)).toBeCloseTo(1, 9);
    expect(at(0.5)).toBeCloseTo(NEON_PLANT_FLOOR + (1 - NEON_PLANT_FLOOR) * 0.5, 9);
    expect(at(0.5)).toBeGreaterThan(at(0.25));
  });
  it("is dim, never dark nor full, with no figure, and clamps an absurd one", () => {
    expect(at(null)).toBeCloseTo(NEON_PLANT_FLOOR, 9);
    expect(at(Number.NaN)).toBeCloseTo(NEON_PLANT_FLOOR, 9);
    expect(at(Number.POSITIVE_INFINITY)).toBeCloseTo(NEON_PLANT_FLOOR, 9);
    expect(at(-3)).toBeCloseTo(NEON_PLANT_FLOOR, 9);
    expect(at(7)).toBeCloseTo(1, 9);
  });
  it("keeps the source's hue: every channel scales by the same factor", () => {
    const [r, g, b] = neonPlantColour("wind", 0.4);
    const w = NEON_SOURCES.wind;
    expect(r / w[0]).toBeCloseTo(g / w[1], 9);
    expect(g / w[1]).toBeCloseTo(b / w[2], 9);
  });
});

describe("neonToolsOf", () => {
  const SIZE = 40;
  const DENSITY = 2;
  /** A flat, dark frame of SIZE × SIZE output pixels, the ground at row 0 everywhere. */
  function blank(): { frame: NeonFrame; out: Surface } {
    const out = createSurface(SIZE, SIZE);
    const frame: NeonFrame = {
      data: out.data,
      depth: new Int16Array(SIZE * SIZE),
      width: SIZE,
      height: SIZE,
      density: DENSITY,
      scale: DENSITY,
      ox: 0,
      oy: 0,
      light: [1, 1, 1],
      vx: new Float64Array(SIZE),
      vy: new Float64Array(SIZE),
      night: 0,
    };
    return { frame, out };
  }
  const red = (out: Surface, x: number, y: number): number =>
    out.data[(Math.floor(y * DENSITY) * SIZE + Math.floor(x * DENSITY)) * 4] ?? 0;
  const front = { x: 0, y: 0, row: 1000 };
  const TINT: Rgb = [200, 40, 40];

  it("draws a shape as its outline: brighter on the edge than inside, a halo outside", () => {
    const { frame, out } = blank();
    const pen = neonToolsOf(frame, false, out);
    pen.stand(front, TINT);
    box(pen, 6, 6, 14, 14, [90, 90, 90]);
    const edge = red(out, 6.1, 10);
    const middle = red(out, 10, 10);
    const halo = red(out, 5.4, 10);
    const far = red(out, 2, 10);
    expect(edge).toBeGreaterThan(middle);
    expect(halo).toBeGreaterThan(0);
    expect(edge).toBeGreaterThan(halo);
    expect(far).toBe(0);
    expect(pen.touched().length).toBe(1);
  });

  it("leaves a shadow out, and a see-through shade", () => {
    const { frame, out } = blank();
    const pen = neonToolsOf(frame, false, out);
    pen.stand(front, TINT);
    shadow(pen, 10, 10, 8);
    box(pen, 6, 6, 14, 14, [90, 90, 90], { alpha: 0.3 });
    expect(out.data.some((v, i) => i % 4 !== 3 && v > 0)).toBe(false);
  });

  it("draws a lamp solid, in its own colour, whatever stands", () => {
    const { frame, out } = blank();
    const pen = neonToolsOf(frame, true, out);
    pen.stand(front, [0, 0, 255]);
    lamp(pen, 10, 10, 1.5);
    const i = (20 * SIZE + 20) * 4;
    expect(out.data[i]).toBeGreaterThan(200);
    expect(out.data[i]).toBeGreaterThan(out.data[i + 2] ?? 0);
  });

  it("hides what the relief in front covers", () => {
    const { frame, out } = blank();
    frame.depth.fill(500);
    const pen = neonToolsOf(frame, false, out);
    pen.stand({ x: 0, y: 0, row: 10 }, TINT);
    box(pen, 6, 6, 14, 14, [90, 90, 90]);
    expect(out.data.some((v, i) => i % 4 !== 3 && v > 0)).toBe(false);
  });
});
