import { describe, expect, it } from "vitest";
import { PREFECTURES, REGION_CAPITALS } from "../src/geo/regions";
import { KIND_REGIONS, kmOf } from "../src/map/grid";
import { coarseLayer } from "../src/map/layers";
import {
  areaBox,
  type Camera,
  clampCamera,
  DRIFT_REACH,
  driftAt,
  ease,
  fitBox,
  flightAt,
  flightMs,
  HIGHEST_METRES,
  kmAtPixel,
  MAX_SCALE,
  MIN_SCALE,
  panBy,
  RISE_METRES_PER_KM,
  zoomAt,
} from "../src/scene/camera";
import {
  detailForScale,
  DETAIL_FROM_SCALE,
  DETAIL_FULL_SCALE,
  prefectureTowns,
  viewLight,
} from "../src/scene/scene";
import { lightAt } from "../src/sky/light";
import { sunPosition } from "../src/sky/sun";
import { mulberry32 } from "./random";

const W = 480;
const H = 270;
const coarse = coarseLayer();
const random = mulberry32(2026);
const randomCamera = (): Camera => ({
  x: random() * 1152,
  y: random() * 1104,
  scale: MIN_SCALE + random() * (MAX_SCALE - MIN_SCALE),
});
/** Buffer pixel of a ground point (the inverse of kmAtPixel). */
const pixelOf = (c: Camera, x: number, y: number): [number, number] => [
  (x - c.x) * c.scale + W / 2,
  ((y - c.y) * c.scale) / 2 + H / 2,
];

describe("areaBox", () => {
  it("holds each region's prefectures, and France holds them all", () => {
    const france = areaBox(coarse, null);
    for (const [dept, town, region, lat, lon] of PREFECTURES) {
      const { x, y } = kmOf(lat, lon);
      for (const box of [france, areaBox(coarse, region)]) {
        expect(
          x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
          `${dept} ${town}`,
        ).toBe(true);
      }
    }
  });

  it("is a few hundred km for a region, about 1 000 km for France", () => {
    const france = areaBox(coarse, null);
    expect(france.right - france.left).toBeGreaterThan(950);
    expect(france.right - france.left).toBeLessThan(1150);
    for (const region of KIND_REGIONS) {
      const b = areaBox(coarse, region);
      expect(b.right - b.left, region).toBeGreaterThan(60); // Corsica: 76 km
      expect(b.right - b.left, region).toBeLessThan(500);
    }
  });
});

describe("fitBox", () => {
  it("shows the whole box, with room above for the highest relief", () => {
    for (const size of [
      [480, 270],
      [293, 633],
    ] as const) {
      for (const region of [null, ...KIND_REGIONS]) {
        const box = areaBox(coarse, region);
        const c = fitBox(box, size[0], size[1]);
        const sw = (x: number, y: number): [number, number] => [
          (x - c.x) * c.scale + size[0] / 2,
          ((y - c.y) * c.scale) / 2 + size[1] / 2,
        ];
        const [left, top] = sw(box.left, box.top);
        const [right, bottom] = sw(box.right, box.bottom);
        const rise = (HIGHEST_METRES / RISE_METRES_PER_KM) * c.scale;
        expect(left, String(region)).toBeGreaterThanOrEqual(-1e-9);
        expect(right, String(region)).toBeLessThanOrEqual(size[0] + 1e-9);
        expect(top - rise, String(region)).toBeGreaterThanOrEqual(-1e-9);
        expect(bottom, String(region)).toBeLessThanOrEqual(size[1] + 1e-9);
      }
    }
  });

  it("frames every region close enough for the 1 km relief, and France on the 4 km map (D-018)", () => {
    // Landscape screens at the usual buffer size; a phone held upright is tighter.
    for (const region of KIND_REGIONS) {
      expect(detailForScale(fitBox(areaBox(coarse, region), W, H).scale), region).toBe(16);
      expect(
        detailForScale(fitBox(areaBox(coarse, region), 293, 633).scale),
        region,
      ).toBeGreaterThan(8);
    }
    expect(detailForScale(fitBox(areaBox(coarse, null), W, H).scale)).toBe(0);
  });
});

describe("zoomAt", () => {
  it("keeps the ground point under the cursor in place (randomized)", () => {
    for (let n = 0; n < 500; n++) {
      const c = randomCamera();
      const px = random() * W;
      const py = random() * H;
      const factor = 0.25 + random() * 4;
      const z = zoomAt(c, factor, px, py, W, H);
      const before = kmAtPixel(c, px, py, W, H);
      const after = kmAtPixel(z, px, py, W, H);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
      expect(z.scale).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(z.scale).toBeLessThanOrEqual(MAX_SCALE);
    }
  });

  it("stops at the scale limits and ignores a factor that is not a positive number", () => {
    const c: Camera = { x: 500, y: 500, scale: 1 };
    expect(zoomAt(c, 1000, 10, 10, W, H).scale).toBe(MAX_SCALE);
    expect(zoomAt(c, 0.0001, 10, 10, W, H).scale).toBe(MIN_SCALE);
    for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY])
      expect(zoomAt(c, bad, 10, 10, W, H)).toBe(c);
  });
});

describe("panBy", () => {
  it("moves the ground with the drag, and back (randomized)", () => {
    for (let n = 0; n < 200; n++) {
      const c = randomCamera();
      const dx = random() * 200 - 100;
      const dy = random() * 200 - 100;
      const p = panBy(c, dx, dy);
      // The ground point that was at the centre is now dx, dy pixels away from it.
      const [x, y] = pixelOf(p, c.x, c.y);
      expect(x).toBeCloseTo(W / 2 + dx, 6);
      expect(y).toBeCloseTo(H / 2 + dy, 6);
      const back = panBy(p, -dx, -dy);
      expect(back.x).toBeCloseTo(c.x, 6);
      expect(back.y).toBeCloseTo(c.y, 6);
    }
  });

  it("ignores a move that is not a number", () => {
    const c: Camera = { x: 500, y: 500, scale: 1 };
    expect(panBy(c, Number.NaN, 0)).toBe(c);
    expect(panBy(c, 0, Number.POSITIVE_INFINITY)).toBe(c);
  });
});

describe("clampCamera", () => {
  const box = { left: 0, top: 0, right: 1000, bottom: 1000 };
  const fallback: Camera = { x: 1, y: 2, scale: 1 };

  it("keeps the centre in the box and the scale in its limits", () => {
    expect(clampCamera({ x: -50, y: 2000, scale: 99 }, box, fallback)).toEqual({
      x: 0,
      y: 1000,
      scale: MAX_SCALE,
    });
    const inside: Camera = { x: 10, y: 20, scale: 1 };
    expect(clampCamera(inside, box, fallback)).toBe(inside);
  });

  it("falls back on a camera that is not a number, never showing NaN", () => {
    expect(clampCamera({ x: Number.NaN, y: 0, scale: 1 }, box, fallback)).toBe(fallback);
    expect(clampCamera({ x: 0, y: 0, scale: Number.POSITIVE_INFINITY }, box, fallback)).toBe(
      fallback,
    );
  });
});

describe("flights", () => {
  it("start and end exactly, and zoom steadily, never overshooting (randomized)", () => {
    for (let n = 0; n < 200; n++) {
      const from = randomCamera();
      const to = randomCamera();
      expect(flightAt(from, to, 0)).toBe(from);
      expect(flightAt(from, to, 1)).toBe(to);
      expect(flightAt(from, to, -1)).toBe(from);
      expect(flightAt(from, to, 2)).toBe(to);
      // Halfway in time is halfway in log scale: the geometric mean.
      expect(flightAt(from, to, 0.5).scale).toBeCloseTo(Math.sqrt(from.scale * to.scale), 9);
      let previous = from.scale;
      for (let t = 0.05; t < 1; t += 0.05) {
        const c = flightAt(from, to, t);
        if (to.scale >= from.scale) expect(c.scale).toBeGreaterThanOrEqual(previous - 1e-12);
        else expect(c.scale).toBeLessThanOrEqual(previous + 1e-12);
        expect(c.x).toBeGreaterThanOrEqual(Math.min(from.x, to.x) - 1e-9);
        expect(c.x).toBeLessThanOrEqual(Math.max(from.x, to.x) + 1e-9);
        previous = c.scale;
      }
    }
  });

  it("pans in a straight line when the scale does not change", () => {
    const from: Camera = { x: 0, y: 0, scale: 2 };
    const to: Camera = { x: 100, y: 50, scale: 2 };
    const mid = flightAt(from, to, 0.5);
    expect(mid).toEqual({ x: 50, y: 25, scale: 2 });
  });

  it("last between 0.6 and 3 seconds", () => {
    for (let n = 0; n < 100; n++) {
      const ms = flightMs(randomCamera(), randomCamera());
      expect(ms).toBeGreaterThanOrEqual(600);
      expect(ms).toBeLessThanOrEqual(3000);
    }
    expect(flightMs({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0, scale: Number.NaN })).toBe(600);
  });

  it("ease from 0 to 1, flat at both ends", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(-3)).toBe(0);
    expect(ease(Number.NaN)).toBe(0);
    expect(ease(0.01)).toBeLessThan(0.001);
  });
});

describe("driftAt", () => {
  it("starts from the camera without a jump, stays near it, and never zooms", () => {
    const base: Camera = { x: 500, y: 500, scale: 1.5 };
    expect(driftAt(base, 0, W)).toBe(base);
    expect(driftAt(base, -5, W)).toBe(base);
    const early = driftAt(base, 100, W);
    expect(Math.abs(early.x - base.x) * base.scale).toBeLessThan(0.01);
    const reach = (DRIFT_REACH * W) / base.scale;
    for (let ms = 0; ms < 600_000; ms += 7_000) {
      const c = driftAt(base, ms, W);
      expect(Math.abs(c.x - base.x)).toBeLessThanOrEqual(reach + 1e-9);
      expect(Math.abs(c.y - base.y)).toBeLessThanOrEqual(reach + 1e-9);
      expect(c.scale).toBe(base.scale);
    }
  });

  it("moves slowly: under 2 pixels a second", () => {
    const base: Camera = { x: 500, y: 500, scale: 2 };
    for (let ms = 0; ms < 300_000; ms += 1000) {
      const a = driftAt(base, ms, W);
      const b = driftAt(base, ms + 1000, W);
      expect(Math.abs(b.x - a.x) * base.scale).toBeLessThan(2);
      expect((Math.abs(b.y - a.y) * base.scale) / 2).toBeLessThan(2);
    }
  });
});

describe("the scene model", () => {
  it("asks for the 1 km layer between the two documented scales", () => {
    expect(detailForScale(DETAIL_FROM_SCALE)).toBe(0);
    expect(detailForScale(0.1)).toBe(0);
    expect(detailForScale(DETAIL_FULL_SCALE)).toBe(16);
    expect(detailForScale(MAX_SCALE)).toBe(16);
    expect(detailForScale((DETAIL_FROM_SCALE + DETAIL_FULL_SCALE) / 2)).toBe(8);
    expect(detailForScale(Number.NaN)).toBe(0);
  });

  it("has the 96 prefectures as towns, 12 of them regional capitals", () => {
    const towns = prefectureTowns();
    expect(towns).toHaveLength(96);
    expect(towns.filter((t) => t.capital)).toHaveLength(Object.keys(REGION_CAPITALS).length);
  });
});

describe("viewLight", () => {
  it("takes the sun at the view's centre: dusk comes to Strasbourg before Brest", () => {
    // Regression: under ?at= the light was computed once, at the first view, and
    // never followed the camera to another region.
    const at = Date.UTC(2026, 5, 21, 19, 45); // 21:45 in Paris, near sunset
    const brest = viewLight({ ...kmOf(48.39, -4.49), scale: 1 }, at);
    const strasbourg = viewLight({ ...kmOf(48.57, 7.75), scale: 1 }, at);
    expect(strasbourg.darkness).toBeGreaterThan(brest.darkness);
  });

  it("is the light of the sun there, its darkness rounded to a sixteenth of a step", () => {
    const random = mulberry32(7);
    for (let n = 0; n < 200; n++) {
      const camera = { x: 100 + random() * 900, y: 100 + random() * 900, scale: 1 };
      const time = Date.UTC(2026, 0, 1) + random() * 365 * 86_400_000;
      const light = viewLight(camera, time);
      const lat = 51.2 - camera.y / 111.2;
      const lon = -5.4 + camera.x / (111.2 * 0.6883545);
      const sun = sunPosition(time, lat, lon);
      const exact = lightAt(sun?.geometricElevationDeg ?? Number.NaN);
      expect(Math.abs(light.darkness - exact.darkness)).toBeLessThanOrEqual(1 / 32 + 1e-3);
      expect(light.darkness * 16).toBe(Math.round(light.darkness * 16));
      expect(light.emissive).toBe(exact.emissive);
    }
  });

  it("reads a view off the globe as night", () => {
    expect(viewLight({ x: 1e9, y: 0, scale: 1 }, Date.UTC(2026, 5, 21, 12)).period).toBe("night");
  });
});
