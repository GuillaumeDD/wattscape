/**
 * The seasons (B-022): the season of a date, the change spreading by patches, and
 * how each theme draws it.
 */
import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH, referenceScene } from "../e2e/reference-frames";
import { ELEVATION_CLASSES } from "../src/map/grid";
import { coarseLayer } from "../src/map/layers";
import { drawModernScene, MODERN_SEASON_TINTS, modernTint } from "../src/render/modern-theme";
import { PALETTE } from "../src/render/palette";
import { drawPixelScene, groundColour, SEASON_DOTS } from "../src/render/pixel-theme";
import { createSurface, hashSurface, type Surface } from "../src/render/surface";
import { areaBox, fitBox } from "../src/scene/camera";
import {
  type Season,
  seasonAt,
  seasonOf,
  SEASONS,
  type SeasonState,
  TURN_DAYS,
  turnAt,
  turnedAt,
} from "../src/scene/season";

const day = (month: number, date: number, year = 2026): number => Date.UTC(year, month - 1, date);
const pure = (season: Season): SeasonState => ({ from: season, to: season, share: 0 });

describe("seasonAt", () => {
  it("shows each season whole on the 15th of its month", () => {
    expect(seasonAt(day(1, 15))).toEqual(pure("winter"));
    expect(seasonAt(day(4, 15))).toEqual(pure("spring"));
    expect(seasonAt(day(7, 15))).toEqual(pure("summer"));
    expect(seasonAt(day(10, 15))).toEqual(pure("autumn"));
  });

  it("turns over TURN_DAYS days around the middle between two keyframes", () => {
    // Winter (day 14) to spring (day 104): the middle is day 59, 1 March.
    expect(seasonAt(day(3, 1) + 12 * 3_600_000)).toEqual({
      from: "winter",
      to: "spring",
      share: 0.5,
    });
    const start = Date.UTC(2026, 0, 1) + (59 - TURN_DAYS / 2) * 86_400_000;
    expect(seasonAt(start - 86_400_000)).toEqual(pure("winter"));
    expect(seasonAt(start + TURN_DAYS * 86_400_000 + 86_400_000)).toEqual(pure("spring"));
  });

  it("never jumps: day by day, the land turns a little at a time, the whole year round", () => {
    // How far through the year the land is, in shares: 0 at winter, 1 at spring, ….
    const position = (s: SeasonState): number => SEASONS.indexOf(s.from) + s.share;
    let last = position(seasonAt(day(1, 15)));
    for (let d = 1; d <= 365; d++) {
      const now = position(seasonAt(day(1, 15) + d * 86_400_000));
      const step = (now - last + 4) % 4;
      expect(step).toBeLessThanOrEqual(1 / 32 + 1e-9);
      last = now;
    }
  });

  it("turns from autumn to winter around 30 November, and stays winter across the new year", () => {
    for (const year of [2026, 2028]) {
      const turning = seasonAt(Date.UTC(year, 10, 29, 12));
      expect([turning.from, turning.to]).toEqual(["autumn", "winter"]);
      expect(turning.share).toBeGreaterThan(0.3);
      expect(turning.share).toBeLessThan(0.7);
      expect(seasonAt(Date.UTC(year, 11, 31, 23))).toEqual(pure("winter"));
      expect(seasonAt(Date.UTC(year + 1, 0, 1, 1))).toEqual(pure("winter"));
      // A leap year's 29 February is in the change to spring, like 28 February.
      if (year === 2028) expect(seasonAt(Date.UTC(year, 1, 29)).to).toBe("spring");
    }
  });

  it("keeps the share to steps of 1/32, and reads a non-finite time as summer", () => {
    for (let d = 0; d < 365; d += 3) {
      const { share } = seasonAt(day(1, 1) + d * 86_400_000);
      expect(share * 32).toBe(Math.round(share * 32));
    }
    expect(seasonAt(Number.NaN)).toEqual(pure("summer"));
  });
});

describe("turnAt and seasonOf: the change spreads by patches", () => {
  const points: [number, number][] = [];
  for (let y = 0; y < 1000; y += 23) for (let x = 0; x < 1000; x += 29) points.push([x, y]);

  it("spreads the points over the whole change", () => {
    const turns = points.map(([x, y]) => turnAt(x, y));
    expect(Math.min(...turns)).toBeLessThan(0.1);
    expect(Math.max(...turns)).toBeGreaterThan(0.9);
    for (const t of turns) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1);
    }
  });

  it("turns more of the land as the share grows, about as much as the share", () => {
    let last = 0;
    for (let k = 0; k <= 32; k++) {
      const state: SeasonState = { from: "summer", to: "autumn", share: k / 32 };
      const turned = points.filter(([x, y]) => seasonOf(state, x, y) === "autumn").length;
      expect(turned).toBeGreaterThanOrEqual(last);
      expect(Math.abs(turned / points.length - k / 32)).toBeLessThan(0.2);
      last = turned;
    }
    expect(seasonOf({ from: "summer", to: "autumn", share: 0 }, 10, 10)).toBe("summer");
  });

  it("turns at an even pace: no step of 1/32 turns more than a few percent of the land", () => {
    // A dense sample: a clamped noise once turned about a tenth of the land on the
    // first step and another tenth on the last.
    const dense: [number, number][] = [];
    for (let y = 0; y < 1000; y += 7) for (let x = 0; x < 1000; x += 11) dense.push([x, y]);
    const turns = dense.map(([x, y]) => turnAt(x, y));
    for (let k = 0; k < 32; k++) {
      const inStep = turns.filter((t) => t >= k / 32 && t < (k + 1) / 32).length;
      expect(inStep / turns.length).toBeLessThan(0.07);
    }
  });

  it("keeps neighbours together: points 4 km apart mostly agree", () => {
    const state: SeasonState = { from: "winter", to: "spring", share: 0.5 };
    let agree = 0;
    for (const [x, y] of points) if (seasonOf(state, x, y) === seasonOf(state, x + 4, y)) agree++;
    expect(agree / points.length).toBeGreaterThan(0.85);
  });

  it("blends with a soft edge for the modern theme, 0 to 1, growing with the share", () => {
    for (const [x, y] of points.slice(0, 200)) {
      let last = 0;
      for (let k = 0; k <= 32; k++) {
        const t = turnedAt({ from: "summer", to: "autumn", share: k / 32 }, x, y);
        expect(t).toBeGreaterThanOrEqual(last);
        expect(t).toBeLessThanOrEqual(1);
        last = t;
      }
      expect(turnedAt({ from: "summer", to: "autumn", share: 0 }, x, y)).toBe(0);
    }
  });

  it("never jumps at the ends of the change: every point starts near 0 and ends at 1", () => {
    const first: SeasonState = { from: "summer", to: "autumn", share: 1 / 32 };
    const last: SeasonState = { from: "summer", to: "autumn", share: 31 / 32 };
    const whole: SeasonState = { from: "summer", to: "autumn", share: 1 };
    for (const [x, y] of points) {
      expect(turnedAt(first, x, y)).toBeLessThan(0.1);
      expect(turnedAt(last, x, y)).toBeGreaterThan(0.9);
      expect(turnedAt(whole, x, y)).toBe(1);
    }
  });
});

describe("the seasons in pixel art", () => {
  it("changes the green bands with the season, never the rock nor the snow", () => {
    const at = (metres: number, season: Season): string =>
      groundColour(ELEVATION_CLASSES.indexOf(metres), season);
    expect(SEASONS.map((s) => at(0, s))).toEqual(["dull", "fresh", "meadow", "meadow"]);
    expect(SEASONS.map((s) => at(300, s))).toEqual(["grass", "meadow", "grass", "grass"]);
    for (const s of SEASONS) {
      expect(at(1300, s)).toBe("rock");
      expect(at(2400, s)).toBe("snow");
    }
  });

  const normandie = fitBox(areaBox(coarseLayer(), "28"), FRAME_WIDTH, FRAME_HEIGHT);
  const draw = (season: SeasonState): Surface => {
    const out = createSurface(FRAME_WIDTH, FRAME_HEIGHT);
    drawPixelScene({ ...referenceScene("28", normandie, 35), season }, out);
    return out;
  };
  const count = (s: Surface, colour: readonly number[]): number => {
    let n = 0;
    for (let i = 0; i < s.data.length; i += 4)
      if (s.data[i] === colour[0] && s.data[i + 1] === colour[1] && s.data[i + 2] === colour[2])
        n++;
    return n;
  };

  it("scatters each season's own marks, and no other season's", () => {
    const winter = draw(pure("winter"));
    const spring = draw(pure("spring"));
    expect(count(winter, PALETTE.frost)).toBeGreaterThan(200);
    expect(count(spring, PALETTE.frost)).toBe(0);
    expect(count(spring, PALETTE.blossom)).toBeGreaterThan(200);
    expect(count(winter, PALETTE.blossom)).toBe(0);
    expect(SEASON_DOTS.winter.dull?.[0]?.[0]).toBe("frost");
    // The fill draws at most two marks per band.
    for (const s of SEASONS)
      for (const marks of Object.values(SEASON_DOTS[s]))
        expect(marks.length).toBeLessThanOrEqual(2);
  });

  it("marks only the region in focus: the veiled land around stays calm", () => {
    const winter = draw(pure("winter"));
    // The left edge of the frame is Brittany, outside Normandie: no frost there.
    let frost = 0;
    for (let y = 150; y < 260; y++)
      for (let x = 0; x < 40; x++) {
        const i = (y * FRAME_WIDTH + x) * 4;
        if (winter.data[i] === PALETTE.frost[0] && winter.data[i + 1] === PALETTE.frost[1]) frost++;
      }
    expect(frost).toBe(0);
  });

  it("turns patch by patch: a share of 0 is the season before, the same frame each time", () => {
    const before = hashSurface(draw(pure("summer")));
    expect(hashSurface(draw({ from: "summer", to: "autumn", share: 0 }))).toBe(before);
    const half = draw({ from: "summer", to: "autumn", share: 0.5 });
    expect(hashSurface(half)).not.toBe(before);
    expect(hashSurface(draw({ from: "summer", to: "autumn", share: 0.5 }))).toBe(hashSurface(half));
    // Half way, both seasons' marks show: summer's crops and autumn's leaves.
    expect(count(half, PALETTE.leafGold)).toBeGreaterThan(0);
  });
});

describe("the seasons in the modern theme", () => {
  it("tints each season from its keyframes, the rock and the snow alike in all", () => {
    for (const s of SEASONS) {
      for (const [metres, colour] of MODERN_SEASON_TINTS[s])
        expect(modernTint(metres, s)).toEqual(colour);
      expect(modernTint(2000, s)).toEqual(modernTint(2000, "summer"));
    }
    expect(modernTint(0, "winter")).not.toEqual(modernTint(0, "spring"));
  });

  it("draws a share of 0 as the season before", () => {
    const camera = fitBox(areaBox(coarseLayer(), "28"), FRAME_WIDTH, FRAME_HEIGHT);
    const frame = (season: SeasonState): string => {
      const out = createSurface(FRAME_WIDTH * 2, FRAME_HEIGHT * 2);
      drawModernScene({ ...referenceScene("28", camera, 35), season }, out);
      return hashSurface(out);
    };
    expect(frame({ from: "winter", to: "spring", share: 0 })).toBe(frame(pure("winter")));
    expect(frame({ from: "winter", to: "spring", share: 0.5 })).not.toBe(frame(pure("winter")));
  });
});
