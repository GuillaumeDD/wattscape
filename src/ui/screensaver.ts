/**
 * The screensaver mode (B-021): the map alone, full screen, the cursor hidden when
 * idle, the screen kept on, the survey mode playing (D-073). Entered by its button or
 * `F` (full screen), or by `?screensaver` (no full screen: a browser grants it only
 * to a press); left by `Escape`, the browser's own way out of full screen, or the
 * button again. Where the figures come from stays on screen, small (AGENTS.md: every
 * figure is traceable).
 *
 * The browser APIs are optional: without the Fullscreen API the mode still hides
 * the interface; without the Screen Wake Lock API the screen may sleep.
 */

/** The cursor hides after this long without a move of the mouse. */
export const CURSOR_HIDES_AFTER_MS = 3000;

export interface Screensaver {
  readonly on: boolean;
  /** Enters the mode, `fullscreen` if the browser allows it (it must follow a press). */
  enter(fullscreen: boolean): void;
  exit(): void;
}

/** Whether a key press belongs to a form field or asks for a browser shortcut. */
function notForUs(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  return e.target instanceof HTMLElement && e.target.closest("select, input") !== null;
}

/**
 * Wires the mode to the page: `onChange` hears when it starts or ends (the page then
 * plays the survey, and redraws its controls).
 */
export function mountScreensaver(onChange: (on: boolean) => void): Screensaver {
  const body = document.body;
  let on = false;
  /** Whether this mode asked for the full screen: leaving it then leaves the mode. */
  let ownsFullscreen = false;
  /** The last request for the full screen, until it is answered. */
  let asked: Promise<void> | null = null;
  /** The browser refused the full screen: F then leaves the mode, as Escape does. */
  let refused = false;
  /** The mode ended while its full screen was asked for: a late grant is left at once. */
  let leaving = false;
  let lock: WakeLockSentinel | null = null;
  /** A wake lock is being asked for: one request at a time, so none is orphaned. */
  let asking = false;
  let cursorTimer: number | null = null;

  /** Asks the browser to keep the screen on, while the mode is on and the tab shows. */
  function keepAwake(): void {
    if (!on || lock !== null || asking || document.hidden || !("wakeLock" in navigator)) return;
    asking = true;
    navigator.wakeLock
      .request("screen")
      .then((sentinel) => {
        asking = false;
        // The mode may have ended, or the tab hidden, while the request was pending.
        if (!on || lock !== null) {
          void sentinel.release();
          return;
        }
        lock = sentinel;
        sentinel.addEventListener("release", () => {
          if (lock === sentinel) lock = null;
        });
      })
      .catch(() => {
        // Refused (battery saver, a policy): the screen may sleep, nothing else changes.
        asking = false;
      });
  }

  /** Leaves the full screen this mode asked for, once the request is answered. */
  function leaveFullscreen(): void {
    void (asked ?? Promise.resolve()).then(() => {
      if (!on && document.fullscreenElement != null)
        void document.exitFullscreen().catch(() => undefined);
    });
  }

  function idleCursor(): void {
    body.classList.remove("idle");
    if (cursorTimer !== null) window.clearTimeout(cursorTimer);
    cursorTimer = null;
    if (!on) return;
    cursorTimer = window.setTimeout(() => {
      cursorTimer = null;
      body.classList.add("idle");
    }, CURSOR_HIDES_AFTER_MS);
  }

  const self: Screensaver = {
    get on() {
      return on;
    },
    enter(fullscreen) {
      if (fullscreen && document.fullscreenElement === null && document.fullscreenEnabled) {
        ownsFullscreen = true;
        refused = false;
        leaving = false;
        const request = document.documentElement.requestFullscreen().catch(() => {
          // Refused: the mode goes on without the full screen.
          ownsFullscreen = false;
          refused = true;
        });
        asked = request;
        void request.then(() => {
          if (asked === request) asked = null;
        });
      }
      if (on) return;
      on = true;
      body.classList.add("screensaver");
      idleCursor();
      keepAwake();
      onChange(true);
    },
    exit() {
      if (!on) return;
      on = false;
      body.classList.remove("screensaver");
      idleCursor();
      if (lock !== null) void lock.release();
      lock = null;
      // Also when the request is still pending: it may be granted after this.
      if (ownsFullscreen) {
        leaving = true;
        leaveFullscreen();
      }
      ownsFullscreen = false;
      onChange(false);
    },
  };

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement !== null) {
      // Granted after the mode had ended (the request outlived it): leave it.
      if (!on && leaving) void document.exitFullscreen().catch(() => undefined);
      return;
    }
    // Escape, or the browser's own control, left the full screen: the mode ends too.
    // Not while a request is pending: that change is the end of an earlier full
    // screen, arriving after a quick F asked for a new one.
    if (ownsFullscreen && asked === null) {
      ownsFullscreen = false;
      self.exit();
    }
  });
  document.addEventListener("visibilitychange", () => {
    // A hidden tab loses its wake lock; it is asked for again when the tab shows.
    if (!document.hidden) keepAwake();
  });
  window.addEventListener("pointermove", idleCursor, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (notForUs(e)) return;
    if (e.key === "Escape" && on) self.exit();
    else if ((e.key === "f" || e.key === "F") && !e.repeat) {
      // Opened by `?screensaver`, the mode is not full screen yet: F makes it so.
      // Full screen, refused or impossible, F leaves it.
      if (on && (document.fullscreenElement != null || refused || !document.fullscreenEnabled))
        self.exit();
      else self.enter(true);
    }
  });
  return self;
}
