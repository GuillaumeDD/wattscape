import { describe, expect, it } from "vitest";
import {
  BAYER_4,
  DITHER_LEVELS,
  ditherLevel,
  fillDithered,
  fillGradient,
  takesSecond,
} from "../src/render/dither";
import {
  COLOUR_NAMES,
  type ColourName,
  DARKER,
  darken,
  luma,
  PALETTE,
} from "../src/render/palette";
import { createSurface, getPixel, hashSurface, setPixel } from "../src/render/surface";
import { drawTestCard } from "../src/render/test-card";
import {
  darknessAt,
  DARKNESS_KEYFRAMES,
  lightAt,
  periodOf,
  SKY_KEYFRAMES,
  skyColour,
  tinted,
} from "../src/sky/light";
import hashes from "./fixtures/frames/hashes.json";

const SOURCES: readonly ColourName[] = [
  "nuclear",
  "hydro",
  "wind",
  "solar",
  "thermal",
  "bioenergy",
];

describe("Surface", () => {
  it("is RGBA, row after row, and rejects a bad size", () => {
    const s = createSurface(3, 2);
    expect(s.data).toHaveLength(24);
    setPixel(s, 2, 1, [1, 2, 3]);
    expect(Array.from(s.data.slice(20, 24))).toEqual([1, 2, 3, 255]);
    expect(getPixel(s, 2, 1)).toEqual([1, 2, 3]);
    expect(() => createSurface(-1, 2)).toThrow();
    expect(() => createSurface(1.5, 2)).toThrow();
  });

  it("tells sizes apart beyond 16 bits (all 4 bytes of each size are hashed)", () => {
    expect(hashSurface(createSurface(65537, 0))).not.toBe(hashSurface(createSurface(1, 0)));
  });

  it("refuses to read a pixel outside the surface, rather than one of the next row", () => {
    const s = createSurface(2, 2);
    setPixel(s, 0, 1, [7, 7, 7]);
    for (const [x, y] of [
      [2, 0],
      [-1, 0],
      [0, 2],
      [0.5, 0],
    ] as const)
      expect(() => getPixel(s, x, y), `${String(x)}, ${String(y)}`).toThrow(RangeError);
  });

  it("clips pixels outside the surface", () => {
    const s = createSurface(2, 2);
    for (const [x, y] of [
      [-1, 0],
      [0, -1],
      [2, 0],
      [0, 2],
    ] as const)
      setPixel(s, x, y, [9, 9, 9]);
    expect(s.data.every((v) => v === 0)).toBe(true);
  });

  it("hashes like a naive FNV-1a over the size and the bytes (reference)", () => {
    const naive = (bytes: number[]): string => {
      let h = 0x811c9dc5n;
      for (const b of bytes) h = ((h ^ BigInt(b)) * 0x01000193n) % 2n ** 32n;
      return h.toString(16).padStart(8, "0");
    };
    let seed = 3;
    for (let t = 0; t < 20; t++) {
      const w = 1 + (t % 5);
      const h = 1 + (t % 3);
      const s = createSurface(w, h);
      for (let i = 0; i < s.data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        s.data[i] = seed >>> 24;
      }
      expect(hashSurface(s)).toBe(naive([w, 0, 0, 0, h, 0, 0, 0, ...s.data]));
    }
  });

  it("tells two frames apart by one pixel", () => {
    const a = createSurface(4, 4);
    const b = createSurface(4, 4);
    setPixel(b, 3, 3, [0, 0, 1]);
    expect(hashSurface(a)).not.toBe(hashSurface(b));
  });
});

describe("palette", () => {
  it("has 24 distinct colours, each a byte triple", () => {
    expect(COLOUR_NAMES).toHaveLength(24);
    const seen = new Set(COLOUR_NAMES.map((n) => PALETTE[n].join(",")));
    expect(seen.size).toBe(24);
    for (const n of COLOUR_NAMES) {
      for (const v of PALETTE[n]) expect(Number.isInteger(v) && v >= 0 && v <= 255, n).toBe(true);
    }
  });

  it("darkens every colour to a strictly darker one, down to skyNight", () => {
    for (const n of COLOUR_NAMES) {
      if (n === "skyNight") {
        expect(DARKER[n]).toBe("skyNight");
        continue;
      }
      expect(luma(PALETTE[DARKER[n]]), n).toBeLessThan(luma(PALETTE[n]));
      expect(darken(n, COLOUR_NAMES.length), n).toBe("skyNight");
    }
    expect(darken("grass", 0)).toBe("grass");
    expect(darken("grass", 2)).toBe("seaDeep");
  });

  it("never darkens a colour into a source's signature colour", () => {
    for (const n of COLOUR_NAMES) expect(SOURCES, n).not.toContain(DARKER[n]);
  });
});

describe("ordered dithering", () => {
  it("uses each threshold 0–15 once", () => {
    expect(BAYER_4.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it("gives the second colour to exactly `level` pixels of any 4 × 4 block", () => {
    for (let level = 0; level <= DITHER_LEVELS; level++) {
      for (const [ox, oy] of [
        [0, 0],
        [1, 2],
        [-3, -7],
        [101, 54],
      ] as const) {
        let n = 0;
        for (let y = oy; y < oy + 4; y++)
          for (let x = ox; x < ox + 4; x++) if (takesSecond(x, y, level)) n++;
        expect(n, `level ${String(level)} at ${String(ox)}, ${String(oy)}`).toBe(level);
      }
    }
  });

  it("rounds a fraction to the nearest level and clamps the rest", () => {
    expect(ditherLevel(0)).toBe(0);
    expect(ditherLevel(0.5)).toBe(8);
    expect(ditherLevel(0.53)).toBe(8);
    expect(ditherLevel(0.97)).toBe(16);
    expect(ditherLevel(1)).toBe(16);
    expect(ditherLevel(7)).toBe(16);
    expect(ditherLevel(-1)).toBe(0);
    expect(ditherLevel(Number.NaN)).toBe(0);
  });

  it("fills only palette colours, and a gradient from its first colour to its second", () => {
    const s = createSurface(8, 17);
    fillGradient(s, 0, 0, 8, 17, "skyNight", "skyGolden");
    for (let x = 0; x < 8; x++) {
      expect(getPixel(s, x, 0)).toEqual(PALETTE.skyNight);
      expect(getPixel(s, x, 16)).toEqual(PALETTE.skyGolden);
    }
    // Every level is as wide as the others, give or take a row: 17 levels over 34
    // rows, two rows each (the first fix made the last level one row only).
    const g = createSurface(4, 34);
    fillGradient(g, 0, 0, 4, 34, "skyNight", "skyGolden");
    const rows = new Map<number, number>();
    for (let y = 0; y < 34; y++) {
      let golden = 0;
      for (let x = 0; x < 4; x++)
        if (getPixel(g, x, y).join() === PALETTE.skyGolden.join()) golden++;
      rows.set(y, golden);
    }
    expect(rows.get(32)).toBe(4);
    expect(rows.get(33)).toBe(4);
    expect(rows.get(31)).toBeLessThan(4);
    const t = createSurface(8, 8);
    fillDithered(t, 0, 0, 8, 8, "grass", "field", 5);
    const colours = new Set<string>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) colours.add(getPixel(t, x, y).join());
    expect([...colours].sort()).toEqual([PALETTE.field.join(), PALETTE.grass.join()].sort());
  });
});

describe("light keyframes", () => {
  it("names the period by the geometric elevation", () => {
    expect(periodOf(6)).toBe("day");
    expect(periodOf(5.99)).toBe("goldenHour");
    expect(periodOf(-4)).toBe("goldenHour");
    expect(periodOf(-4.01)).toBe("blueHour");
    expect(periodOf(-12)).toBe("blueHour");
    expect(periodOf(-12.01)).toBe("night");
  });

  it("darkens the land by the keyframes, never lighter as the sun sinks (randomized)", () => {
    for (const [e, d] of DARKNESS_KEYFRAMES) expect(darknessAt(e)).toBe(d);
    expect(darknessAt(90)).toBe(0);
    expect(darknessAt(-90)).toBe(2);
    expect(darknessAt(Number.NaN)).toBe(2);
    let seed = 11;
    for (let i = 0; i < 1000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const e = -20 + (seed / 2 ** 32) * 40;
      expect(darknessAt(e - 0.1)).toBeGreaterThanOrEqual(darknessAt(e));
    }
  });

  it("lights windows once the sun is below the horizon, with the land a full step dark", () => {
    expect(lightAt(30).emissive).toBe(false);
    expect(lightAt(0).emissive).toBe(false);
    expect(lightAt(-0.01).emissive).toBe(true);
    // At −3.9° the land is almost 1.5 steps dark: the windows must be lit (review).
    expect(lightAt(-3.9).emissive).toBe(true);
    expect(lightAt(-8).emissive).toBe(true);
    expect(lightAt(-30).emissive).toBe(true);
    expect(lightAt(Number.NaN).emissive).toBe(true);
    expect(lightAt(30)).toMatchObject({ skyTop: "skyDay", skyHorizon: "skyDay", darkness: 0 });
  });

  it("moves the sky by keyframes without a jump at any period boundary", () => {
    for (const [e, top, horizon] of SKY_KEYFRAMES)
      expect(lightAt(e), String(e)).toMatchObject({ skyTop: top, skyHorizon: horizon });
    // Across each boundary of the periods, at most one 16th of a step.
    for (const boundary of [-12, -4, 0, 6]) {
      const before = lightAt(boundary - 0.01);
      const after = lightAt(boundary);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++)
          for (const level of [0, 16]) {
            const a = skyColour(before, level, x, y);
            const b = skyColour(after, level, x, y);
            if (a !== b) expect(before.skyLevel, `${String(boundary)}°`).toBeGreaterThanOrEqual(15);
          }
    }
  });

  it("reads a NaN darkness as night, and a huge one as the darkest colour", () => {
    expect(tinted("grass", Number.NaN, 0, 0)).toBe(darken("grass", 2));
    expect(tinted("grass", Number.POSITIVE_INFINITY, 0, 0)).toBe("skyNight");
    expect(tinted("grass", -3, 0, 0)).toBe("grass");
  });

  it("tints by whole steps, and a fraction by its share of each 4 × 4 block", () => {
    expect(tinted("meadow", 0, 3, 5)).toBe("meadow");
    expect(tinted("meadow", 2, 3, 5)).toBe("forest");
    for (const darkness of [0.25, 0.5, 1.75]) {
      let darker = 0;
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++)
          if (tinted("sand", darkness, x, y) !== darken("sand", Math.floor(darkness))) darker++;
      expect(darker, String(darkness)).toBe(ditherLevel(darkness % 1));
    }
  });
});

describe("frame hashes (AGENTS.md § Determinism)", () => {
  it("draws the test card the same way twice, and as recorded", () => {
    expect(hashSurface(drawTestCard())).toBe(hashSurface(drawTestCard()));
    expect(hashSurface(drawTestCard())).toBe(hashes["test-card"]);
  });
});
