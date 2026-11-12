/**
 * The camera (B-011, ARCHITECTURE § Camera): where the view is centred, in map
 * kilometres (`kmOf` in src/map/grid.ts), and how close it is, in buffer pixels per
 * kilometre. Pure: every function takes what it needs (sizes, times) and returns a
 * new camera; nothing here reads the clock or the DOM.
 *
 * The camera animates the scene and never decides what the world holds, so it may use
 * Math.exp and Math.sin (AGENTS.md § Determinism); a given camera draws the same frame
 * in every engine, because the theme only adds, multiplies and floors it.
 */
import { type TerrainLayer } from "../map/layers.ts";
import { type CellRegion, kindOfRegion } from "../map/grid.ts";

export interface Camera {
  /** Centre of the view, map kilometres east of the grid's west edge. */
  readonly x: number;
  /** Centre of the view, map kilometres south of the grid's north edge (on the ground). */
  readonly y: number;
  /** Buffer pixels per kilometre east–west; north–south, half as many (2:1 tiles). */
  readonly scale: number;
}

/** A box in map kilometres. */
export interface KmBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The closest the camera comes: a 1 km cell 8 pixels wide. */
export const MAX_SCALE = 8;
/** The farthest: France at a third of the view it fits in. */
export const MIN_SCALE = 0.15;

/**
 * Vertical exaggeration of the relief: metres of altitude per kilometre of rise,
 * counted in east–west pixels. A 4 km cell rises by its own width per 1 000 m
 * (ARCHITECTURE § Mockups), so 250 m rise by a kilometre's width, at any zoom and on
 * both layers.
 */
export const RISE_METRES_PER_KM = 250;

/** The highest relief the map holds, in metres (the top elevation class). */
export const HIGHEST_METRES = 3600;

/** The cells of a region, or of France (every region and Corsica), in map kilometres. */
export function areaBox(layer: TerrainLayer, region: CellRegion | null): KmBox {
  const kind = region === null ? -1 : kindOfRegion(region);
  let top = layer.rows;
  let left = layer.columns;
  let bottom = -1;
  let right = -1;
  for (let i = 0; i < layer.kinds.length; i++) {
    const k = layer.kinds[i] ?? 0;
    if (kind === -1 ? k < 2 : k !== kind) continue;
    const r = Math.floor(i / layer.columns);
    const c = i - r * layer.columns;
    if (r < top) top = r;
    if (r > bottom) bottom = r;
    if (c < left) left = c;
    if (c > right) right = c;
  }
  if (bottom < 0)
    return { left: 0, top: 0, right: layer.columns * layer.km, bottom: layer.rows * layer.km };
  return {
    left: left * layer.km,
    top: top * layer.km,
    right: (right + 1) * layer.km,
    bottom: (bottom + 1) * layer.km,
  };
}

/**
 * The camera that shows a box whole in a `width` × `height` buffer, with a margin
 * (a share of the view on each side), room above for the relief, and the box centred.
 */
export function fitBox(box: KmBox, width: number, height: number, margin = 0.06): Camera {
  const w = Math.max(1, box.right - box.left);
  const h = Math.max(1, box.bottom - box.top);
  const usable = 1 - 2 * margin;
  // North–south, a kilometre is half as many pixels; the highest relief can rise
  // `lift` × scale pixels above the box's north edge, so the view leaves room for it.
  const lift = HIGHEST_METRES / RISE_METRES_PER_KM;
  const scale = Math.min((width * usable) / w, (height * usable) / (h / 2 + lift));
  return clampScale({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 - lift, scale });
}

function clampScale(camera: Camera): Camera {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale));
  return scale === camera.scale ? camera : { ...camera, scale };
}

/**
 * Keeps the camera usable: a finite centre within `box` (the map's French land, so
 * the view never wanders off into empty sea), and a scale within the limits. A
 * non-finite camera falls back to `fallback`.
 */
export function clampCamera(camera: Camera, box: KmBox, fallback: Camera): Camera {
  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.scale))
    return fallback;
  const c = clampScale(camera);
  const x = Math.min(box.right, Math.max(box.left, c.x));
  const y = Math.min(box.bottom, Math.max(box.top, c.y));
  return x === c.x && y === c.y ? c : { ...c, x, y };
}

/** Buffer pixel (px, py) of a `width` × `height` view → map kilometres, on the ground. */
export function kmAtPixel(
  camera: Camera,
  px: number,
  py: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: camera.x + (px - width / 2) / camera.scale,
    y: camera.y + (2 * (py - height / 2)) / camera.scale,
  };
}

/**
 * Zooms by `factor` (above 1: closer) around buffer pixel (px, py), which keeps
 * showing the same point of the ground, as a map does under the cursor.
 */
export function zoomAt(
  camera: Camera,
  factor: number,
  px: number,
  py: number,
  width: number,
  height: number,
): Camera {
  if (!(factor > 0) || !Number.isFinite(factor)) return camera;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor));
  const anchor = kmAtPixel(camera, px, py, width, height);
  return {
    x: anchor.x - (px - width / 2) / scale,
    y: anchor.y - (2 * (py - height / 2)) / scale,
    scale,
  };
}

/** Moves the view by (dx, dy) buffer pixels: the ground follows a drag. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return camera;
  return { ...camera, x: camera.x - dx / camera.scale, y: camera.y - (2 * dy) / camera.scale };
}

/** Smoothstep easing, 0 → 1, slow at both ends. */
export function ease(t: number): number {
  if (!(t > 0)) return 0; // NaN too
  const u = Math.min(1, t);
  return u * u * (3 - 2 * u);
}

/**
 * The camera `t` (0–1) of the way through a flight from `from` to `to`: the scale moves
 * evenly in log space, so a zoom feels steady, and the centre moves so that it
 * covers the same share of the screen at every moment; both eased.
 */
export function flightAt(from: Camera, to: Camera, t: number): Camera {
  const u = ease(t);
  if (u <= 0) return from;
  if (u >= 1) return to;
  const ratio = to.scale / from.scale;
  const scale = from.scale * Math.pow(ratio, u);
  // With the scale geometric, a centre moving by the same share of the screen per
  // step moves by (s(u) − s0)/(s1 − s0) of the way; with equal scales, linearly.
  const share = Math.abs(ratio - 1) < 1e-9 ? u : (scale - from.scale) / (to.scale - from.scale);
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share, scale };
}

/** How long a flight lasts, in ms: longer for a longer zoom, between 0.6 and 3 s. */
export function flightMs(from: Camera, to: Camera): number {
  const zoom = Math.abs(Math.log2(to.scale / from.scale));
  const travel = Math.hypot(to.x - from.x, to.y - from.y) * Math.min(from.scale, to.scale);
  const ms = 600 + 400 * zoom + 2 * travel;
  return Number.isFinite(ms) ? Math.min(3000, ms) : 600;
}

/** Seconds without input before the camera starts drifting on its own. */
export const IDLE_DRIFT_AFTER_MS = 20_000;
/** One slow loop of the drift, in ms (4 minutes). */
export const DRIFT_PERIOD_MS = 240_000;
/** The drift's reach: a share of the view's width, each side. */
export const DRIFT_REACH = 0.04;
/** The drift fades in over this time, so it never jerks into motion. */
export const DRIFT_FADE_IN_MS = 10_000;

/**
 * Where the drifting camera is `ms` after it started from `base` in a `width`-pixel
 * view: a slow ellipse around `base`, starting from it (no jump), with an east–west
 * reach of `DRIFT_REACH` of the view and half that north–south. No zoom.
 */
export function driftAt(base: Camera, ms: number, width: number): Camera {
  if (!(ms > 0)) return base;
  const fade = ease(ms / DRIFT_FADE_IN_MS);
  const reach = (DRIFT_REACH * width) / base.scale;
  const a = (2 * Math.PI * ms) / DRIFT_PERIOD_MS;
  return {
    x: base.x + fade * reach * Math.sin(a),
    // A slower period north–south, so the path never quite repeats; the same reach
    // in kilometres is half as many pixels north–south (2:1 tiles).
    y: base.y + fade * reach * Math.sin(a * 0.73),
    scale: base.scale,
  };
}
