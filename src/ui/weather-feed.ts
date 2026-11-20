/**
 * Keeps the scene's weather current (B-018): the current Open-Meteo reading of every
 * region, at its prefecture or, for the viewer's own region, at the viewer's position
 * rounded to 0.1° (PRD Q-41, D-063), and of the 5 mountain ranges' fixed points, for
 * the snow on the ground (Q-45). Seventeen calls every 15 minutes while the tab is
 * visible, never faster (ARCHITECTURE § Open-Meteo). A point whose call fails keeps
 * its last good reading, which the page labels with its time; the failed calls are
 * tried again after a minute, then after twice as long each time, up to 15 minutes.
 * An answer that lands after the tab was hidden, or after the point it was asked for
 * changed, is dropped.
 */
import { animationClock, type Clock } from "../clock/clock";
import { REGION_CODES, type RegionCode } from "../data/eco2mix";
import { type Result } from "../data/fetch-json";
import {
  fetchOpenMeteo,
  roundPosition,
  type RoundedPosition,
  type WeatherReading,
  weatherFreshness,
} from "../data/open-meteo";
import { referencePoint } from "../geo/regions";
import {
  MASSIFS,
  type RegionalWeather,
  WEATHER_POINT_IDS,
  type WeatherPointId,
} from "../scene/weather";

export const WEATHER_REFRESH_MS = 15 * 60 * 1000;
export const WEATHER_RETRY_MS = 60 * 1000;
/** How long the first answer of a round waits for the next ones before it is shown. */
export const SEND_AFTER_MS = 1000;

/** What the page says about the weather the scene shows. */
export type WeatherState =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | {
      /**
       * `ahead`: every reading is dated after the clock's time (a fixed `?at=` in the
       * past, the time-lapse): none is shown. `stale`: at least one shown reading is
       * over an hour old. The time is the oldest shown reading's (the newest's for
       * `ahead`), so that the note never makes the weather look fresher than it is.
       */
      readonly kind: "live" | "stale" | "ahead";
      readonly timeMs: number;
    };

/** The page's note for a set of readings, from the clock's time. */
export function weatherState(byRegion: RegionalWeather, nowMs: number): WeatherState {
  const readings = WEATHER_POINT_IDS.flatMap((r) => {
    const reading = byRegion[r];
    return reading === undefined ? [] : [reading];
  });
  if (readings.length === 0) return { kind: "unavailable" };
  const shown = readings.filter((r) => weatherFreshness(r, nowMs) !== "future");
  if (shown.length === 0)
    return { kind: "ahead", timeMs: Math.max(...readings.map((r) => r.timeMs)) };
  const stale = shown.some((r) => weatherFreshness(r, nowMs) === "stale");
  return {
    kind: stale ? "stale" : "live",
    timeMs: Math.min(...shown.map((r) => r.timeMs)),
  };
}

/**
 * Where a point's weather is asked for: a range's own point; for a region, the
 * viewer's rounded position when it lies in that region, else its prefecture, rounded
 * too (only a rounded value is ever sent).
 */
export function weatherPoint(
  region: WeatherPointId,
  viewer: { readonly region: RegionCode; readonly position: RoundedPosition } | null,
): RoundedPosition | null {
  // A mountain range's point is fixed, and already on 0.1°.
  const massif = MASSIFS.find((m) => m.id === region);
  if (massif !== undefined) return roundPosition(massif.latitude, massif.longitude);
  if (viewer !== null && viewer.region === region) return viewer.position;
  const code = REGION_CODES.find((r) => r === region);
  const point = code === undefined ? null : referencePoint(code);
  return point === null ? null : roundPosition(point.latitude, point.longitude);
}

const samePoint = (a: RoundedPosition | null, b: RoundedPosition | null): boolean =>
  a?.latitude === b?.latitude && a?.longitude === b?.longitude;

export interface WeatherFeed {
  /**
   * The viewer's region and rounded position, or null: that region's weather is then
   * asked for there, at once, and its reading from the old point is dropped.
   */
  setViewer(
    viewer: { readonly region: RegionCode; readonly position: RoundedPosition } | null,
  ): void;
}

export function startWeatherFeed(
  clock: Clock,
  fetchFn: typeof fetch,
  onWeather: (byRegion: RegionalWeather, state: WeatherState) => void,
): WeatherFeed {
  const readings = new Map<WeatherPointId, WeatherReading>();
  /** Read through a function: the tab can be hidden while a call is awaited. */
  const hidden = (): boolean => document.hidden;
  const points = new Map<WeatherPointId, RoundedPosition | null>();
  /** The calls in flight, by point. */
  const inFlight = new Map<WeatherPointId, AbortController>();
  let viewer: { readonly region: RegionCode; readonly position: RoundedPosition } | null = null;
  let timer: number | null = null;
  let nextAt = 0;
  let retryMs = WEATHER_RETRY_MS;
  /** Points whose last call failed, tried again at the retry; all at a full refresh. */
  let failed = new Set<WeatherPointId>();
  let sentState: WeatherState | null = null;

  for (const id of WEATHER_POINT_IDS) points.set(id, weatherPoint(id, null));

  const send = (): void => {
    const byRegion: RegionalWeather = Object.fromEntries(readings);
    const state = weatherState(byRegion, clock.now());
    sentState = state;
    onWeather(byRegion, state);
  };

  const schedule = (ms: number): void => {
    if (timer !== null) window.clearTimeout(timer);
    nextAt = animationClock.now() + ms;
    timer = window.setTimeout(() => {
      timer = null;
      void load(failed.size > 0 && ms < WEATHER_REFRESH_MS ? [...failed] : [...WEATHER_POINT_IDS]);
    }, ms);
  };

  async function loadOne(id: WeatherPointId): Promise<boolean> {
    const point = points.get(id) ?? null;
    if (point === null) return true;
    inFlight.get(id)?.abort();
    const controller = new AbortController();
    inFlight.set(id, controller);
    const result: Result<WeatherReading> = await fetchOpenMeteo(point, fetchFn, controller.signal);
    // Hidden, superseded, or asked for a point that has changed since: dropped.
    if (controller.signal.aborted || inFlight.get(id) !== controller) return true;
    inFlight.delete(id);
    if (!samePoint(points.get(id) ?? null, point)) return true;
    if (result.ok) readings.set(id, result.reading);
    return result.ok;
  }

  /**
   * The answers that land within SEND_AFTER_MS of each other go to the scene together:
   * one redraw for them, and a slow call (up to the 30 s timeout) holds back no other.
   */
  let sendTimer: number | null = null;
  const queueSend = (): void => {
    if (sendTimer !== null) return;
    sendTimer = window.setTimeout(() => {
      sendTimer = null;
      send();
    }, SEND_AFTER_MS);
  };
  const flush = (): void => {
    if (sendTimer !== null) window.clearTimeout(sendTimer);
    sendTimer = null;
    send();
  };

  /** The latest load: one superseded (hidden and shown again meanwhile) keeps no books. */
  let generation = 0;
  async function load(ids: readonly WeatherPointId[]): Promise<void> {
    if (hidden()) return;
    const run = ++generation;
    const results = await Promise.all(
      ids.map(async (r) => {
        const ok = await loadOne(r);
        if (!hidden()) queueSend();
        return [r, ok] as const;
      }),
    );
    // Hidden meanwhile: the calls were aborted, and the tab's return calls again.
    if (hidden() || run !== generation) return;
    failed = new Set(results.filter(([, ok]) => !ok).map(([r]) => r));
    flush();
    if (failed.size === 0) {
      retryMs = WEATHER_RETRY_MS;
      schedule(WEATHER_REFRESH_MS);
    } else {
      schedule(retryMs);
      retryMs = Math.min(WEATHER_REFRESH_MS, retryMs * 2);
    }
  }

  const abortAll = (): void => {
    for (const controller of inFlight.values()) controller.abort();
    inFlight.clear();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      abortAll();
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    } else if (timer === null && inFlight.size === 0) {
      // Back in view: refresh everything now if the next call was due while hidden.
      const due = Math.max(0, nextAt - animationClock.now());
      if (due === 0) void load([...WEATHER_POINT_IDS]);
      else schedule(due);
    }
  });

  sentState = { kind: "loading" };
  onWeather({}, sentState);
  void load([...WEATHER_POINT_IDS]);

  return {
    setViewer(next): void {
      const before = viewer;
      // The picker also calls back for a new note alone: nothing changes then.
      if (
        before?.region === next?.region &&
        samePoint(before?.position ?? null, next?.position ?? null)
      )
        return;
      viewer = next;
      for (const region of new Set([before?.region, next?.region])) {
        if (region === undefined) continue;
        const point = weatherPoint(region, next);
        if (samePoint(points.get(region) ?? null, point)) continue;
        points.set(region, point);
        // The reading from the old point no longer describes where it is drawn.
        readings.delete(region);
        inFlight.get(region)?.abort();
        inFlight.delete(region);
        if (hidden()) {
          // Asked for as soon as the tab is back in view.
          failed.add(region);
          nextAt = animationClock.now();
        } else
          void loadOne(region).then((done) => {
            send();
            if (done || hidden()) return;
            // Failed: tried again at the next retry, not only at the next refresh.
            failed.add(region);
            if (nextAt - animationClock.now() > retryMs) {
              schedule(retryMs);
              retryMs = Math.min(WEATHER_REFRESH_MS, retryMs * 2);
            }
          });
      }
      if (sentState !== null) send();
    },
  };
}
