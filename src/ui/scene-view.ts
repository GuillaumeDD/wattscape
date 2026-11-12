/**
 * The scene on the page (B-011): the canvas, its pixel buffer, the frame loop, and
 * the controls that move the camera (wheel, pinch, drag, double-click or double-tap,
 * keys). The drawing itself is pure (src/scene/, src/render/); this module owns the
 * DOM, the animation clock and the lazy load of the 1 km relief.
 */
import { animationClock, type Clock } from "../clock/clock";
import { type Eco2mixArea, type RegionalReadings } from "../data/eco2mix";
import { type CellRegion } from "../map/grid";
import { coarseLayer, fineLayer, type TerrainLayer } from "../map/layers";
import { PLANT_SITES } from "../map/plants";
import { DEFAULT_THEME, type Drawn } from "../render/theme";
import { createSurface, type Surface } from "../render/surface";
import {
  areaBox,
  type Camera,
  clampCamera,
  driftAt,
  fitBox,
  flightAt,
  flightMs,
  IDLE_DRIFT_AFTER_MS,
  type KmBox,
  panBy,
  zoomAt,
} from "../scene/camera";
import {
  detailForScale,
  prefectureTowns,
  type Scene,
  type ScenePlant,
  scenePlants,
  viewLight,
} from "../scene/scene";
import {
  bufferSize,
  type BufferSize,
  isDoubleTap,
  isTap,
  keyIntent,
  type Press,
  wheelZoomFactor,
} from "./controls";

/** Frames are drawn at most this often (PRD Q-7: 30 fps). */
const FRAME_MS = 1000 / 30;
/** A still scene wakes this often, to follow the sun. */
const LIGHT_EVERY_MS = 60_000;
/** Below this scale the 1 km relief is not needed yet; from it, it is loaded. */
const LOAD_FINE_FROM_SCALE = 0.4;
/** Dither levels the crossfade moves by per frame: 16 levels in about half a second. */
const DETAIL_STEP = 1;
/** How long the national view shows before the camera flies to the viewer's region. */
const INTRO_MS = 1500;
/**
 * The plants move by steps of this long: 10 a second is smooth enough for pixel art
 * and a third of the frame cap, for the battery (ARCHITECTURE § Performance).
 */
const MOTION_STEP_MS = 100;

export interface SceneView {
  /** Flies to an area: the whole of France, or a region. */
  showArea(area: Eco2mixArea): void;
  /**
   * The latest step of every region, which drives the plants; null when there is
   * none (not yet loaded, or unavailable): every plant is then idle. A recorded
   * `sample` shows whatever the clock says; a live step dated after the clock's time
   * (`?at=` in the past) does not.
   */
  setReadings(readings: RegionalReadings | null, sample?: boolean): void;
}

interface Flight {
  readonly from: Camera;
  readonly to: Camera;
  readonly start: number;
  readonly ms: number;
}

function regionOf(area: Eco2mixArea): CellRegion | null {
  return area === "FR" ? null : area;
}

/** The France box, with room around it to look at the coasts and the neighbours. */
function roamBox(): KmBox {
  const b = areaBox(coarseLayer(), null);
  return { left: b.left - 60, top: b.top - 60, right: b.right + 60, bottom: b.bottom + 60 };
}

export function mountSceneView(
  canvas: HTMLCanvasElement,
  clock: Clock,
  initialArea: Eco2mixArea,
): SceneView {
  const context = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = coarseLayer();
  const roam = roamBox();

  let size: BufferSize = bufferSize(window.innerWidth, window.innerHeight, devicePixelRatio);
  let surface: Surface = createSurface(size.width, size.height);
  /** The still frame, without the plants' motion; `surface` is it plus the motion. */
  let still: Surface = createSurface(size.width, size.height);
  let drawn: Drawn | null = null;
  let lastStep = Number.NaN;
  let plants: readonly ScenePlant[] = scenePlants(PLANT_SITES, null, clock.now());
  let plantsVersion = 0;
  let image: ImageData | null = null;
  let area = initialArea;
  let camera = fitBox(areaBox(coarse, null), size.width, size.height);
  /** Where the drift started from, and when; reset by every input. */
  let base = camera;
  let lastInput = animationClock.now();
  let flight: Flight | null = null;
  let fine: TerrainLayer | null = null;
  let fineRequested = false;
  let detail = 0;
  let lastKey = "";
  let lastFrame = Number.NEGATIVE_INFINITY;
  let frameRequest: number | null = null;

  const home = (): Camera => fitBox(areaBox(coarse, regionOf(area)), size.width, size.height);

  function resize(): void {
    size = bufferSize(window.innerWidth, window.innerHeight, devicePixelRatio);
    if (surface.width !== size.width || surface.height !== size.height) {
      surface = createSurface(size.width, size.height);
      still = createSurface(size.width, size.height);
      image = null;
    }
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    // Whole device pixels per buffer pixel: CSS pixels are device pixels / ratio.
    canvas.style.width = `${String((size.width * size.factor) / devicePixelRatio)}px`;
    canvas.style.height = `${String((size.height * size.factor) / devicePixelRatio)}px`;
    lastKey = "";
  }

  /** The camera shown now: in flight, drifting, or still. */
  function currentCamera(now: number): Camera {
    if (flight !== null) {
      const t = (now - flight.start) / flight.ms;
      if (t < 1) return flightAt(flight.from, flight.to, t);
      camera = flight.to;
      base = camera;
      lastInput = now;
      flight = null;
    }
    const idle = now - lastInput - IDLE_DRIFT_AFTER_MS;
    if (!reducedMotion && idle > 0) return clampCamera(driftAt(base, idle, size.width), roam, base);
    return camera;
  }

  /** An input takes the camera from wherever it is now, stops a flight and the drift. */
  function takeOver(now: number): void {
    camera = currentCamera(now);
    flight = null;
    base = camera;
    lastInput = now;
  }

  /**
   * Moves the camera at once: `step` gets the camera on screen now (mid-flight or
   * drifting), never a stale one, so a wheel turn or a drag never jumps back.
   */
  function move(step: (from: Camera) => Camera): void {
    takeOver(animationClock.now());
    camera = clampCamera(step(camera), roam, camera);
    base = camera;
    wake();
  }

  /** Flies the camera from where it is on screen now to `step` of it. */
  function flyTo(step: (from: Camera) => Camera): void {
    const now = animationClock.now();
    takeOver(now);
    const to = clampCamera(step(camera), roam, camera);
    if (reducedMotion) camera = base = to;
    else flight = { from: camera, to, start: now, ms: flightMs(camera, to) };
    wake();
  }

  function loadFine(): void {
    if (fineRequested) return;
    fineRequested = true;
    // A separate chunk (about 86 KB compressed), fetched from this site only. Decoding
    // it takes about 40 ms, once: with a region, during the still France of the intro.
    import("../map/relief")
      .then((m) => {
        fine = fineLayer(m.FINE_ELEVATION_RLE);
        wake();
      })
      .catch(() => {
        // Without the 1 km relief the 4 km one goes on showing: nothing is lost but detail.
      });
  }

  function frame(now: number): void {
    frameRequest = null;
    if (document.hidden) return;
    if (now - lastFrame < FRAME_MS - 1) {
      wake();
      return;
    }
    lastFrame = now;
    const shown = currentCamera(now);
    if (shown.scale >= LOAD_FINE_FROM_SCALE || area !== "FR") loadFine();
    // The crossfade eases towards the level the scale asks for, also when the relief
    // arrives while the camera is already close.
    const target = fine === null ? 0 : detailForScale(shown.scale);
    detail =
      detail < target
        ? Math.min(target, detail + DETAIL_STEP)
        : Math.max(target, detail - DETAIL_STEP);
    // The light follows the view's centre, every frame: a few microseconds, and it
    // stays right during a flight and under a fixed clock (B-014 brings the rest).
    const light = viewLight(shown, clock.now());
    const scene: Scene = {
      width: size.width,
      height: size.height,
      camera: shown,
      light,
      focus: regionOf(area),
      coarse,
      fine,
      detail,
      towns: prefectureTowns(),
      plants,
    };
    // Redraw only when what is drawn changes: the drift moves the camera by a pixel
    // every second or two, and a still scene costs nothing.
    const key = [
      size.width,
      size.height,
      // The theme's own offsets: the picture moves only when these do.
      Math.round(shown.x * shown.scale),
      Math.round((shown.y * shown.scale) / 2),
      shown.scale,
      detail,
      fine === null ? 0 : 1,
      light.darkness,
      light.skyLevel,
      light.skyTop,
      light.skyHorizon,
      light.emissive,
      scene.focus,
      plantsVersion,
    ].join();
    // The plants' motion, by steps; at half speed with reduced motion.
    const step = Math.floor(now / MOTION_STEP_MS);
    const redraw = key !== lastKey;
    if (context !== null && (redraw || (drawn?.moving === true && step !== lastStep))) {
      if (redraw) {
        lastKey = key;
        drawn = DEFAULT_THEME.draw(scene, still);
      }
      lastStep = step;
      surface.data.set(still.data);
      drawn?.animate(surface, (step * MOTION_STEP_MS * (reducedMotion ? 0.5 : 1)) / 1000);
      // The image wraps the surface's own bytes: no copy per frame.
      image ??= new ImageData(
        surface.data as Uint8ClampedArray<ArrayBuffer>,
        surface.width,
        surface.height,
      );
      context.putImageData(image, 0, 0);
    }
    // Keep going while the camera moves; the plants wake the loop by their steps only;
    // otherwise sleep until the drift starts, the light changes or an input comes.
    const untilDrift = lastInput + IDLE_DRIFT_AFTER_MS - now;
    if (flight !== null || detail !== target || (!reducedMotion && untilDrift <= 0)) wake();
    else if (drawn?.moving === true) sleep((step + 1) * MOTION_STEP_MS - now);
    else sleep(reducedMotion ? LIGHT_EVERY_MS : Math.min(LIGHT_EVERY_MS, untilDrift));
  }

  let timer: number | null = null;
  function sleep(ms: number): void {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      wake();
    }, ms);
  }

  function wake(): void {
    if (frameRequest === null && !document.hidden) frameRequest = requestAnimationFrame(frame);
  }

  // Pointers: one drags, two pinch; a quick second tap or a double-click zooms in.
  interface Touch {
    x: number;
    y: number;
    readonly x0: number;
    readonly y0: number;
    readonly t0: number;
    /** Another finger came down meanwhile: a pinch, not a tap. */
    multi: boolean;
  }
  const pointers = new Map<number, Touch>();
  let lastTap: Press | null = null;
  let lastPointerType = "";
  /** CSS pixels → buffer pixels. */
  const toBuffer = (clientX: number, clientY: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [
      ((clientX - rect.left) * size.width) / Math.max(1, rect.width),
      ((clientY - rect.top) * size.height) / Math.max(1, rect.height),
    ];
  };
  const zoomInAt = (clientX: number, clientY: number): void => {
    const [px, py] = toBuffer(clientX, clientY);
    flyTo((c) => zoomAt(c, 2, px, py, size.width, size.height));
  };

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    lastPointerType = e.pointerType;
    const multi = pointers.size > 0;
    for (const p of pointers.values()) p.multi = true;
    pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      x0: e.clientX,
      y0: e.clientY,
      t0: animationClock.now(),
      multi,
    });
    takeOver(animationClock.now());
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (p === undefined) return;
    const [bx, by] = toBuffer(p.x, p.y);
    const [ax, ay] = toBuffer(e.clientX, e.clientY);
    p.x = e.clientX;
    p.y = e.clientY;
    const others = [...pointers.entries()].filter(([id]) => id !== e.pointerId);
    const other = others[0]?.[1];
    if (others.length === 1 && other !== undefined) {
      // Pinch: zoom by the change of distance from the other finger, around the
      // midpoint, and follow the midpoint.
      const [ox, oy] = toBuffer(other.x, other.y);
      const d0 = Math.hypot(bx - ox, by - oy);
      const d1 = Math.hypot(ax - ox, ay - oy);
      move((c) =>
        panBy(
          d0 > 0 ? zoomAt(c, d1 / d0, (ax + ox) / 2, (ay + oy) / 2, size.width, size.height) : c,
          (ax - bx) / 2,
          (ay - by) / 2,
        ),
      );
    } else if (others.length === 0) move((c) => panBy(c, ax - bx, ay - by));
  });
  const release = (e: PointerEvent): void => {
    const p = pointers.get(e.pointerId);
    if (p === undefined) return;
    pointers.delete(e.pointerId);
    if (e.pointerType !== "touch" || e.type !== "pointerup") return;
    const press: Press = { ...p, x1: e.clientX, y1: e.clientY, t1: animationClock.now() };
    if (!isTap(press)) lastTap = null;
    else if (isDoubleTap(lastTap, press)) {
      lastTap = null;
      zoomInAt(e.clientX, e.clientY);
    } else lastTap = press;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("dblclick", (e) => {
    e.preventDefault();
    // Touch double-taps are handled above; some browsers also send a dblclick for them.
    if (lastPointerType !== "touch") zoomInAt(e.clientX, e.clientY);
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const [px, py] = toBuffer(e.clientX, e.clientY);
      const factor = wheelZoomFactor(e.deltaY, e.deltaMode, window.innerHeight);
      move((c) => zoomAt(c, factor, px, py, size.width, size.height));
    },
    { passive: false },
  );
  window.addEventListener("keydown", (e) => {
    // Keys typed into the region list or a button are theirs; the browser's own
    // shortcuts (Ctrl and +, for its zoom) too.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLElement && e.target.closest("select, input, button, a") !== null)
      return;
    const intent = keyIntent(e.key, e.code);
    if (intent === null) return;
    e.preventDefault();
    if (intent.kind === "home") flyTo(home);
    else if (intent.kind === "zoom")
      flyTo((c) =>
        zoomAt(c, intent.factor, size.width / 2, size.height / 2, size.width, size.height),
      );
    else flyTo((c) => panBy(c, intent.dx * size.width, intent.dy * size.height));
  });
  window.addEventListener("resize", () => {
    resize();
    wake();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });

  resize();
  wake();
  // The intro: France first, then the flight to the viewer's region, unless the viewer
  // has taken the camera (or picked an area) in the meantime.
  const untouched = lastInput;
  if (area !== "FR")
    window.setTimeout(
      () => {
        if (lastInput === untouched && flight === null) flyTo(home);
      },
      reducedMotion ? 0 : INTRO_MS,
    );

  return {
    showArea(next: Eco2mixArea): void {
      area = next;
      lastKey = "";
      flyTo(home);
    },
    setReadings(readings: RegionalReadings | null, sample = false): void {
      const now = sample && readings !== null ? readings.timeMs : clock.now();
      plants = scenePlants(PLANT_SITES, readings, now);
      plantsVersion++;
      wake();
    },
  };
}
