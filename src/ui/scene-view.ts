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
import { CONSUMPTION_RANGES } from "../map/consumption";
import { LANDMARKS } from "../map/landmarks";
import { PLANT_SITES } from "../map/plants";
import {
  DEFAULT_THEME,
  type Drawn,
  type Mark,
  type Rect,
  type Theme,
  THEMES,
  type ThemeId,
} from "../render/theme";
import { type Box, markAt } from "./captions";
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
  bakedTowns,
  type Scene,
  type ScenePlant,
  scenePlants,
  type TownLights,
  townLights,
  viewLight,
} from "../scene/scene";
import { hasSky, type RegionalWeather, sceneWeather } from "../scene/weather";
import {
  bufferSize,
  type BufferSize,
  isDoubleTap,
  isTap,
  keyIntent,
  type Press,
  wheelZoomFactor,
} from "./controls";
import { seasonAt } from "../scene/season.ts";

/** Frames are drawn at most this often (PRD Q-7: 30 fps). */
const FRAME_MS = 1000 / 30;
/** A still scene wakes this often, to follow the sun. */
const LIGHT_EVERY_MS = 60_000;
/** The clouds move by steps of this long (B-018). */
const CLOUD_STEP_MS = 60_000;
/** Below this scale the 1 km relief is not needed yet; from it, it is loaded. */
const LOAD_FINE_FROM_SCALE = 0.4;
/** The lesser rivers when their chunk could not be loaded: none. */
const NO_RIVERS: readonly string[] = [];
/** Dither levels the crossfade moves by per frame: 16 levels in about half a second. */
const DETAIL_STEP = 1;
/** How long the national view shows before the camera flies to the viewer's region. */
const INTRO_MS = 1500;
/**
 * The plants move by steps of this long: 10 a second is smooth enough for pixel art
 * and a third of the frame cap, for the battery (ARCHITECTURE § Performance).
 */
const MOTION_STEP_MS = 100;
/** How long after a drag, a wheel turn or a pinch the camera still counts as moving. */
const SETTLE_MS = 150;
/** How far around a sprite the mouse still shows its caption, in buffer pixels. */
const HOVER_SLACK = 1;
/** The same for a finger, wider than a cursor. */
const TAP_SLACK = 4;
/** A tapped caption stays this long (PRD § 4.8: never over the scene for long). */
const TAP_CAPTION_MS = 8000;

export interface SceneView {
  /** Flies to an area: the whole of France, or a region. */
  showArea(area: Eco2mixArea): void;
  /**
   * The latest step of every region, which drives the plants; null when there is
   * none (not yet loaded, or unavailable): every plant is then idle. A recorded
   * `sample`, or a step of the time-lapse, shows whatever the clock says; a live step
   * dated after the clock's time (`?at=` in the past) does not.
   */
  setReadings(readings: RegionalReadings | null, sample?: boolean): void;
  /**
   * Each region's current weather (B-018). A reading dated after the clock's time is
   * not shown; an `override` (`?weather=`) always is.
   */
  setWeather(byRegion: RegionalWeather, override?: boolean): void;
  /** Draws the scene with another theme (PRD G-011), from the next frame on. */
  setTheme(id: ThemeId): void;
  /**
   * Hides the sky's weather, or shows it again (B-030, D-072): the clouds, rain and
   * fog go; the snow on the ground stays.
   */
  setWeatherHidden(hidden: boolean): void;
  /** Lets the camera drift at rest, or keeps it still where it is (B-036, D-074). */
  setDrift(on: boolean): void;
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

/** A mark whose caption shows, and its box on the page, in CSS pixels. */
export interface ShownCaption {
  readonly mark: Mark;
  readonly box: Box;
}

/** Copies a box of a surface to the same place of another of the same size. */
function copyBox(from: Surface, to: Surface, box: Rect): void {
  for (let y = box.top; y < box.bottom; y++) {
    const start = (y * to.width + box.left) * 4;
    to.data.set(from.data.subarray(start, (y * to.width + box.right) * 4), start);
  }
}

const sameBox = (a: Rect, b: Rect): boolean =>
  a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;

export function mountSceneView(
  canvas: HTMLCanvasElement,
  clock: Clock,
  initialArea: Eco2mixArea,
  /** The clock runs fast (the time-lapse): the light changes every frame. */
  fastClock = false,
  /** Called with the mark whose caption shows, wherever it moves, or null to hide it. */
  onCaption: (shown: ShownCaption | null) => void = () => undefined,
  /** The theme the scene opens with. */
  initialTheme: ThemeId = DEFAULT_THEME.id,
  /** Whether the camera drifts at rest (D-074). */
  initialDrift = true,
  /** Called when the viewer presses Space, to turn the drift off or on. */
  onDriftKey: () => void = () => undefined,
): SceneView {
  const context = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = coarseLayer();
  const roam = roamBox();

  let theme: Theme = THEMES[initialTheme];
  /** The scene's size, in scene pixels: what the camera, the marks and the inputs count in. */
  let size: BufferSize = bufferSize(window.innerWidth, window.innerHeight, devicePixelRatio);
  /** The frame the theme draws: the scene's size times the theme's density. */
  let surface: Surface = createSurface(0, 0);
  /** The still frame, without the plants' motion; `surface` is it plus the motion. */
  let still: Surface = createSurface(0, 0);
  let drawn: Drawn | null = null;
  let lastStep = Number.NaN;
  let plants: readonly ScenePlant[] = scenePlants(PLANT_SITES, null, clock.now());
  let lights: TownLights = {};
  let plantsVersion = 0;
  let weather: RegionalWeather = {};
  let weatherVersion = 0;
  /** Whether any region has weather to show: the clouds then drift. */
  let weatherShown = false;
  /** The viewer turned the sky's weather off (B-030). */
  let weatherHidden = false;
  /** The camera drifts at rest: as the viewer chose, and never with reduced motion. */
  let drift = initialDrift;
  let image: ImageData | null = null;
  /** The boxes of `surface` the last step's motion was drawn in, if the theme says. */
  let moved: readonly Rect[] | null = null;
  /** The frames already allocated, by density: one at rest, one for a moving camera. */
  const frames = new Map<number, { surface: Surface; still: Surface }>();
  /** When an input last moved the camera at once (a drag, the wheel, a pinch). */
  let lastMove = Number.NEGATIVE_INFINITY;
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

  // Captions (B-020): the mark under the mouse, or the one last tapped, for a while.
  let captioned: string | null = null;
  let lastShown: string | null = null;
  let captionTimer: number | null = null;

  /** Tells the page where the captioned mark is now, or that there is none. */
  function showCaption(): void {
    const mark = captioned === null ? null : (drawn?.marks.find((m) => m.id === captioned) ?? null);
    if (mark === null) {
      if (lastShown !== null) onCaption(null);
      lastShown = null;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / Math.max(1, size.width);
    const sy = rect.height / Math.max(1, size.height);
    lastShown = mark.id;
    onCaption({
      mark,
      box: {
        left: rect.left + mark.left * sx,
        top: rect.top + mark.top * sy,
        right: rect.left + mark.right * sx,
        bottom: rect.top + mark.bottom * sy,
      },
    });
  }

  /** Captions the mark at a point of the page (or none), for `ms` or until changed. */
  function captionAt(clientX: number, clientY: number, slack: number, ms: number | null): void {
    const [x, y] = toBuffer(clientX, clientY);
    const id = drawn === null ? null : (markAt(drawn.marks, x, y, slack)?.id ?? null);
    if (captionTimer !== null) window.clearTimeout(captionTimer);
    captionTimer = null;
    if (id !== null && ms !== null)
      captionTimer = window.setTimeout(() => {
        captionTimer = null;
        captioned = null;
        showCaption();
      }, ms);
    if (id === captioned) return;
    captioned = id;
    showCaption();
  }

  /**
   * Sizes the frame for the theme's density, at rest or with the camera moving (a
   * smooth theme then draws fewer pixels, PRD Q-34). The frames of both are kept, so
   * that going from one to the other allocates nothing.
   */
  function fit(moving: boolean): void {
    const density = theme.density(size.width, size.height, size.factor, moving);
    const width = size.width * density;
    const height = size.height * density;
    if (surface.width !== width || surface.height !== height) {
      const kept = frames.get(density);
      const next =
        kept?.surface.width === width && kept.surface.height === height
          ? kept
          : { surface: createSurface(width, height), still: createSurface(width, height) };
      frames.set(density, next);
      surface = next.surface;
      still = next.still;
      image = null;
      // What the still frame held was drawn for another camera: draw it again.
      lastKey = "";
    }
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    // Pixel art keeps its pixels square and crisp; a smooth theme drawn at fewer
    // pixels than the screen's is scaled up smoothly.
    canvas.classList.toggle("smooth", theme.density(size.width, size.height, size.factor) > 1);
  }

  function resize(): void {
    size = bufferSize(window.innerWidth, window.innerHeight, devicePixelRatio);
    frames.clear();
    fit(false);
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
    if (drift && !reducedMotion && idle > 0)
      return clampCamera(driftAt(base, idle, size.width), roam, base);
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
    const now = animationClock.now();
    takeOver(now);
    lastMove = now;
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
    // Two separate chunks (the relief, about 86 KB compressed, and the lesser rivers,
    // 25 KB), fetched from this site only. Decoding them takes some tens of
    // milliseconds, once: with a region, during the still France of the intro.
    // Without the lesser rivers the relief still shows, with the great rivers alone.
    Promise.all([
      import("../map/relief"),
      import("../map/rivers-fine").then(
        (m) => m.LESSER_RIVERS_PACKED,
        () => NO_RIVERS,
      ),
    ])
      .then(([relief, rivers]) => {
        fine = fineLayer(relief.FINE_ELEVATION_RLE, rivers);
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
    // While the camera flies, crossfades or follows an input, a smooth theme draws
    // fewer pixels; the full frame comes back once it has settled.
    const settling = now - lastMove < SETTLE_MS;
    fit(flight !== null || detail !== target || settling);
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
      towns: bakedTowns(),
      plants,
      townLights: lights,
      landmarks: LANDMARKS,
      weather,
      weatherHidden,
      // By steps, so that a redraw for another reason does not nudge the clouds.
      timeMs: Math.floor(clock.now() / CLOUD_STEP_MS) * CLOUD_STEP_MS,
      season: seasonAt(clock.now()),
    };
    // Redraw only when what is drawn changes: the drift moves the camera by a pixel
    // every second or two, and a still scene costs nothing.
    const key = [
      theme.id,
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
      weatherVersion,
      weatherHidden,
      // The clouds drift with the wind, by steps of a minute (the light wakes the loop as often).
      weatherShown && !weatherHidden ? scene.timeMs : 0,
      scene.season.from,
      scene.season.to,
      scene.season.share,
    ].join();
    // The plants' motion, by steps; at half speed with reduced motion.
    const step = Math.floor(now / MOTION_STEP_MS);
    const redraw = key !== lastKey;
    if (context !== null && (redraw || (drawn?.moving === true && step !== lastStep))) {
      if (redraw) {
        lastKey = key;
        drawn = theme.draw(scene, still);
        // The caption follows its mark, or goes when the mark leaves the frame.
        showCaption();
      }
      lastStep = step;
      // Where the last step's motion was drawn, the still frame comes back; all of
      // it after a redraw, or when the theme does not say where it draws.
      const stale = redraw ? null : moved;
      if (stale === null) surface.data.set(still.data);
      else for (const box of stale) copyBox(still, surface, box);
      moved =
        drawn?.animate(surface, (step * MOTION_STEP_MS * (reducedMotion ? 0.5 : 1)) / 1000) ?? null;
      // The image wraps the surface's own bytes: no copy per frame.
      image ??= new ImageData(
        surface.data as Uint8ClampedArray<ArrayBuffer>,
        surface.width,
        surface.height,
      );
      if (stale === null || moved === null) context.putImageData(image, 0, 0);
      else {
        // Only what changed goes to the canvas. A plant's motion mostly stays in the
        // same box from a step to the next: that box goes once.
        const now = moved;
        const gone = stale.filter((a) => !now.some((b) => sameBox(a, b)));
        for (const box of [...gone, ...now])
          context.putImageData(
            image,
            0,
            0,
            box.left,
            box.top,
            box.right - box.left,
            box.bottom - box.top,
          );
      }
    }
    // Keep going while the camera moves; the plants wake the loop by their steps only;
    // otherwise sleep until the drift starts, the light changes or an input comes.
    const untilDrift = lastInput + IDLE_DRIFT_AFTER_MS - now;
    if (
      flight !== null ||
      detail !== target ||
      settling ||
      fastClock ||
      (drift && !reducedMotion && untilDrift <= 0)
    )
      wake();
    else if (drawn?.moving === true) sleep((step + 1) * MOTION_STEP_MS - now);
    else sleep(reducedMotion || !drift ? LIGHT_EVERY_MS : Math.min(LIGHT_EVERY_MS, untilDrift));
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
    if (p === undefined) {
      // A mouse moving with no button down: the caption of what it is on, while it is.
      if (e.pointerType === "mouse") captionAt(e.clientX, e.clientY, HOVER_SLACK, null);
      return;
    }
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
    } else {
      lastTap = press;
      // A tap shows the caption of what it is on for a while; a tap elsewhere hides it.
      captionAt(e.clientX, e.clientY, TAP_SLACK, TAP_CAPTION_MS);
    }
  };
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") captionAt(Number.NaN, Number.NaN, 0, null);
  });
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
    // A held Space repeats: the drift switches once per press.
    if (intent.kind === "drift") {
      if (!e.repeat) onDriftKey();
    } else if (intent.kind === "home") flyTo(home);
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
      lights = townLights(readings, CONSUMPTION_RANGES, now);
      plantsVersion++;
      wake();
    },
    setWeather(byRegion: RegionalWeather, override = false): void {
      weather = override ? byRegion : sceneWeather(byRegion, clock.now());
      weatherShown = hasSky(weather);
      weatherVersion++;
      wake();
    },
    setWeatherHidden(hidden: boolean): void {
      if (weatherHidden === hidden) return;
      weatherHidden = hidden;
      wake();
    },
    setDrift(on: boolean): void {
      if (drift === on) return;
      // The camera stays where it is on screen, mid-drift too; switched back on, it
      // starts drifting from there after the usual rest.
      takeOver(animationClock.now());
      drift = on;
      wake();
    },
    setTheme(id: ThemeId): void {
      if (theme.id === id) return;
      theme = THEMES[id];
      // The frame of the theme before is not this one's: nothing of it is kept.
      drawn = null;
      lastKey = "";
      resize();
      wake();
    },
  };
}
