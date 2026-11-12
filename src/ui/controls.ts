/**
 * The pure parts of the scene's controls (B-011): the size of the pixel buffer for a
 * window, and what a key or a wheel turn asks the camera to do. No DOM here, so the
 * tests can enumerate them; src/ui/scene-view.ts wires them to events.
 */

/** The integer scale factor of the buffer on screen: 3 to 6 on common screens. */
export const MIN_FACTOR = 3;
export const MAX_FACTOR = 6;
/** About this many buffer pixels along the window's shorter side. */
export const SHORT_SIDE_PIXELS = 270;

export interface BufferSize {
  readonly width: number;
  readonly height: number;
  /** Device pixels per buffer pixel. */
  readonly factor: number;
}

/**
 * The buffer for a window of `cssWidth` × `cssHeight` CSS pixels at a device pixel
 * ratio: an integer factor, so that every buffer pixel is a square of whole device
 * pixels (crisp, ARCHITECTURE § Art direction), and enough pixels to cover the window.
 */
export function bufferSize(cssWidth: number, cssHeight: number, pixelRatio: number): BufferSize {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const w = Math.max(1, Math.round((Number.isFinite(cssWidth) ? cssWidth : 0) * ratio));
  const h = Math.max(1, Math.round((Number.isFinite(cssHeight) ? cssHeight : 0) * ratio));
  const factor = Math.min(
    MAX_FACTOR,
    Math.max(MIN_FACTOR, Math.round(Math.min(w, h) / SHORT_SIDE_PIXELS)),
  );
  return { width: Math.ceil(w / factor), height: Math.ceil(h / factor), factor };
}

/** What a key asks for: a pan by a share of the view, a zoom by a factor, or home. */
export type KeyIntent =
  | { readonly kind: "pan"; readonly dx: number; readonly dy: number }
  | { readonly kind: "zoom"; readonly factor: number }
  | { readonly kind: "home" };

/** Share of the view one press of an arrow moves it by. */
export const KEY_PAN_SHARE = 0.15;
/** Zoom factor of one press of + or −. */
export const KEY_ZOOM = 1.5;

/**
 * The camera intent of a key (`KeyboardEvent.key`), or null: arrows and WASD pan
 * (ZQSD is the same keys on a French keyboard, by `code`), + and − zoom, Home goes
 * home. `dx`, `dy` are the share of the view the ground moves by.
 */
export function keyIntent(key: string, code: string): KeyIntent | null {
  switch (key) {
    case "+":
    case "=":
      return { kind: "zoom", factor: KEY_ZOOM };
    case "-":
    case "_":
      return { kind: "zoom", factor: 1 / KEY_ZOOM };
    case "Home":
      return { kind: "home" };
    case "ArrowLeft":
      return { kind: "pan", dx: KEY_PAN_SHARE, dy: 0 };
    case "ArrowRight":
      return { kind: "pan", dx: -KEY_PAN_SHARE, dy: 0 };
    case "ArrowUp":
      return { kind: "pan", dx: 0, dy: KEY_PAN_SHARE };
    case "ArrowDown":
      return { kind: "pan", dx: 0, dy: -KEY_PAN_SHARE };
  }
  // WASD by position, whatever the layout says the key is.
  switch (code) {
    case "KeyA":
      return { kind: "pan", dx: KEY_PAN_SHARE, dy: 0 };
    case "KeyD":
      return { kind: "pan", dx: -KEY_PAN_SHARE, dy: 0 };
    case "KeyW":
      return { kind: "pan", dx: 0, dy: KEY_PAN_SHARE };
    case "KeyS":
      return { kind: "pan", dx: 0, dy: -KEY_PAN_SHARE };
  }
  return null;
}

/** `WheelEvent.deltaMode` values. */
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

/**
 * The zoom factor of one wheel event: a notch of a mouse wheel (about 100 pixels)
 * zooms by about 1.2, a trackpad's small steps by a little; one event never zooms by
 * more than 2. Up (negative delta) zooms in.
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (!Number.isFinite(deltaY)) return 1;
  const pixels =
    deltaMode === DOM_DELTA_LINE
      ? deltaY * 16
      : deltaMode === DOM_DELTA_PAGE
        ? deltaY * (Number.isFinite(pageHeight) ? pageHeight : 800)
        : deltaY;
  const clamped = Math.max(-400, Math.min(400, pixels));
  return Math.pow(2, -clamped / 400);
}

/** A tap lasts less than this… */
export const TAP_MS = 300;
/** …and moves less than this, in CSS pixels. */
export const TAP_SLOP_PX = 10;
/** Two taps this close in time and space are a double-tap. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 24;

/** A finger that came down and went up: where, when, and whether another joined it. */
export interface Press {
  readonly x0: number;
  readonly y0: number;
  readonly t0: number;
  readonly x1: number;
  readonly y1: number;
  readonly t1: number;
  /** Another finger came down meanwhile: a pinch. */
  readonly multi: boolean;
}

/** Whether a press is a tap: one finger, short, barely moved (not the end of a drag or a pinch). */
export function isTap(p: Press): boolean {
  return !p.multi && p.t1 - p.t0 < TAP_MS && Math.hypot(p.x1 - p.x0, p.y1 - p.y0) < TAP_SLOP_PX;
}

/** Whether a tap, after the previous one, makes a double-tap. */
export function isDoubleTap(previous: Press | null, tap: Press): boolean {
  return (
    previous !== null &&
    tap.t1 - previous.t1 < DOUBLE_TAP_MS &&
    Math.hypot(tap.x1 - previous.x1, tap.y1 - previous.y1) < DOUBLE_TAP_PX
  );
}
