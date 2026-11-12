import { describe, expect, it } from "vitest";
import {
  bufferSize,
  DOUBLE_TAP_MS,
  DOUBLE_TAP_PX,
  isDoubleTap,
  isTap,
  KEY_PAN_SHARE,
  KEY_ZOOM,
  keyIntent,
  MAX_FACTOR,
  MIN_FACTOR,
  type Press,
  TAP_MS,
  TAP_SLOP_PX,
  wheelZoomFactor,
} from "../src/ui/controls";

describe("bufferSize", () => {
  it("scales the buffer by an integer factor, 3 to 6, about 270 pixels on the short side", () => {
    expect(bufferSize(1920, 1080, 1)).toEqual({ width: 480, height: 270, factor: 4 });
    // A 1440 × 900 window on a 2× screen: 2 880 × 1 800 device pixels.
    expect(bufferSize(1440, 900, 2)).toEqual({ width: 480, height: 300, factor: 6 });
    // A phone held upright: 390 × 844 at 3×.
    expect(bufferSize(390, 844, 3)).toEqual({ width: 293, height: 633, factor: 4 });
    expect(bufferSize(300, 200, 1).factor).toBe(MIN_FACTOR);
    expect(bufferSize(8000, 8000, 1).factor).toBe(MAX_FACTOR);
  });

  it("always covers the whole window", () => {
    for (const [w, h, r] of [
      [1366, 768, 1],
      [1280, 720, 1.25],
      [375, 667, 2],
      [2560, 1440, 1.5],
    ] as const) {
      const size = bufferSize(w, h, r);
      expect(size.width * size.factor).toBeGreaterThanOrEqual(Math.round(w * r));
      expect(size.height * size.factor).toBeGreaterThanOrEqual(Math.round(h * r));
      expect(Number.isInteger(size.factor)).toBe(true);
    }
  });

  it("never gives an empty or NaN buffer", () => {
    for (const [w, h, r] of [
      [0, 0, 1],
      [Number.NaN, 500, 1],
      [800, 600, Number.NaN],
      [800, 600, -1],
    ] as const) {
      const size = bufferSize(w, h, r);
      expect(size.width).toBeGreaterThanOrEqual(1);
      expect(size.height).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(size.width) && Number.isInteger(size.height)).toBe(true);
    }
  });
});

describe("keyIntent", () => {
  it("zooms with + and −, goes home with Home", () => {
    expect(keyIntent("+", "Equal")).toEqual({ kind: "zoom", factor: KEY_ZOOM });
    expect(keyIntent("=", "Equal")).toEqual({ kind: "zoom", factor: KEY_ZOOM });
    expect(keyIntent("-", "Minus")).toEqual({ kind: "zoom", factor: 1 / KEY_ZOOM });
    expect(keyIntent("Home", "Home")).toEqual({ kind: "home" });
  });

  it("pans with the arrows: the ground moves the other way, as the view moves", () => {
    expect(keyIntent("ArrowLeft", "ArrowLeft")).toEqual({ kind: "pan", dx: KEY_PAN_SHARE, dy: 0 });
    expect(keyIntent("ArrowRight", "ArrowRight")).toEqual({
      kind: "pan",
      dx: -KEY_PAN_SHARE,
      dy: 0,
    });
    expect(keyIntent("ArrowUp", "ArrowUp")).toEqual({ kind: "pan", dx: 0, dy: KEY_PAN_SHARE });
    expect(keyIntent("ArrowDown", "ArrowDown")).toEqual({ kind: "pan", dx: 0, dy: -KEY_PAN_SHARE });
  });

  it("pans with WASD by key position, so ZQSD works on a French keyboard", () => {
    expect(keyIntent("w", "KeyW")).toEqual(keyIntent("ArrowUp", "ArrowUp"));
    expect(keyIntent("z", "KeyW")).toEqual(keyIntent("ArrowUp", "ArrowUp")); // AZERTY
    expect(keyIntent("q", "KeyA")).toEqual(keyIntent("ArrowLeft", "ArrowLeft")); // AZERTY
    expect(keyIntent("s", "KeyS")).toEqual(keyIntent("ArrowDown", "ArrowDown"));
    expect(keyIntent("d", "KeyD")).toEqual(keyIntent("ArrowRight", "ArrowRight"));
  });

  it("leaves every other key alone", () => {
    for (const [key, code] of [
      ["Enter", "Enter"],
      [" ", "Space"],
      ["Tab", "Tab"],
      ["x", "KeyX"],
      ["", ""],
    ] as const)
      expect(keyIntent(key, code)).toBeNull();
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in on a wheel turned up, out on one turned down, by about 1.2 a notch", () => {
    expect(wheelZoomFactor(0, 0, 800)).toBe(1);
    expect(wheelZoomFactor(-100, 0, 800)).toBeCloseTo(1.189, 3);
    expect(wheelZoomFactor(100, 0, 800)).toBeCloseTo(1 / 1.189, 3);
  });

  it("counts lines and pages in pixels", () => {
    expect(wheelZoomFactor(-3, 1, 800)).toBe(wheelZoomFactor(-48, 0, 800));
    expect(wheelZoomFactor(0.1, 2, 800)).toBe(wheelZoomFactor(80, 0, 800));
  });

  it("never zooms by more than 2 at once, and ignores a delta that is not a number", () => {
    expect(wheelZoomFactor(-1e9, 0, 800)).toBe(2);
    expect(wheelZoomFactor(1e9, 0, 800)).toBe(0.5);
    expect(wheelZoomFactor(Number.NaN, 0, 800)).toBe(1);
    expect(wheelZoomFactor(1, 2, Number.NaN)).toBe(wheelZoomFactor(800, 0, 800));
  });
});

describe("taps", () => {
  const press = (over: Partial<Press> = {}): Press => ({
    x0: 100,
    y0: 100,
    t0: 1000,
    x1: 102,
    y1: 101,
    t1: 1100,
    multi: false,
    ...over,
  });

  it("counts a short, still, single-finger press as a tap", () => {
    expect(isTap(press())).toBe(true);
  });

  it("does not count the end of a drag, a long press or a pinch as a tap", () => {
    // Regression: the end of a short drag, or of a pinch, made a double-tap zoom.
    expect(isTap(press({ x1: 100 + TAP_SLOP_PX }))).toBe(false);
    expect(isTap(press({ t1: 1000 + TAP_MS }))).toBe(false);
    expect(isTap(press({ multi: true }))).toBe(false);
  });

  it("makes a double-tap of two taps close in time and space, only", () => {
    const first = press();
    const second = press({ t0: 1250, t1: 1300, x0: 110, x1: 110 });
    expect(isDoubleTap(first, second)).toBe(true);
    expect(isDoubleTap(null, second)).toBe(false);
    expect(isDoubleTap(first, press({ t0: 1400, t1: 1100 + DOUBLE_TAP_MS }))).toBe(false);
    expect(isDoubleTap(first, press({ t0: 1250, t1: 1300, x1: 102 + DOUBLE_TAP_PX }))).toBe(false);
  });
});
