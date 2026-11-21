/**
 * The survey mode's controls (B-032): Play or Pause, Stop (Home while the tour is
 * off, B-021), and the area the tour shows. Discreet: while the tour plays, they fade away after a few seconds without
 * a move of the mouse or a key, and come back with the next one. Text only, never
 * HTML.
 */
import { REGION_NAMES } from "../geo/regions";
import { type MessageKey } from "../i18n";
import { type SurveyCommand, type SurveyState } from "../scene/survey";

/** The controls fade away after this long without input while the tour plays. */
export const SURVEY_QUIET_AFTER_MS = 4000;

type Translate = (key: MessageKey) => string;

/** What the controls say for a state: the toggle's label, the area line, Stop's and Home's labels. */
export interface SurveyBarText {
  /** Play's label (and tooltip), or Pause's. */
  readonly toggle: string;
  /** The area the tour shows, or an empty line when it is off. */
  readonly area: string;
  readonly stop: string;
  readonly home: string;
}

export function surveyBarText(state: SurveyState, t: Translate): SurveyBarText {
  const name =
    state.area === null ? "" : state.area === "FR" ? t("areaFrance") : REGION_NAMES[state.area];
  return {
    toggle: t(
      state.mode === "playing"
        ? "surveyPause"
        : state.mode === "paused"
          ? "surveyResume"
          : "surveyPlay",
    ),
    area:
      state.mode === "off"
        ? ""
        : t(state.mode === "playing" ? "surveyArea" : "surveyPaused").replace("{area}", name),
    stop: t("surveyStop"),
    home: t("homeButton"),
  };
}

export interface SurveyBar {
  /** Shows a state, in the current language. */
  render(state: SurveyState, t: Translate): void;
  /** Shows the controls, and fades them again later if they should. */
  stir(): void;
}

/** Wires the controls in the page; `onCommand` gets what a press asks for. */
export function mountSurveyBar(onCommand: (command: SurveyCommand) => void): SurveyBar {
  const bar = document.getElementById("survey");
  const toggle = document.getElementById("survey-play");
  const stop = document.getElementById("survey-stop");
  // Home stands in Stop's place while the tour is off (D-006, D-073).
  const home = document.getElementById("home");
  let state: SurveyState = { mode: "off", area: null };
  let quietTimer: number | null = null;

  /** Brings the controls back, and fades them again later if the tour plays. */
  const stir = (): void => {
    bar?.classList.remove("quiet");
    if (quietTimer !== null) window.clearTimeout(quietTimer);
    quietTimer = null;
    // While the tour plays, or in the screensaver mode (B-021) whatever it does.
    if (state.mode !== "playing" && !document.body.classList.contains("screensaver")) return;
    quietTimer = window.setTimeout(() => {
      quietTimer = null;
      bar?.classList.add("quiet");
    }, SURVEY_QUIET_AFTER_MS);
  };
  for (const type of ["pointermove", "pointerdown", "keydown"] as const)
    window.addEventListener(type, stir, { passive: true });
  // Keyboard users reach the controls by Tab: they show while they hold the focus.
  bar?.addEventListener("focusin", stir);

  toggle?.addEventListener("click", () => {
    onCommand(state.mode === "playing" ? "pause" : "play");
  });
  stop?.addEventListener("click", () => {
    onCommand("stop");
  });
  home?.addEventListener("click", () => {
    onCommand("home");
  });

  return {
    render(next, t) {
      const changedMode = next.mode !== state.mode;
      state = next;
      const text = surveyBarText(next, t);
      bar?.classList.toggle("playing", next.mode === "playing");
      if (toggle !== null) {
        toggle.setAttribute("aria-label", text.toggle);
        toggle.title = text.toggle;
      }
      if (stop !== null) {
        stop.hidden = next.mode === "off";
        stop.setAttribute("aria-label", text.stop);
        stop.title = text.stop;
      }
      if (home !== null) {
        home.hidden = next.mode !== "off";
        home.setAttribute("aria-label", text.home);
        home.title = text.home;
      }
      const area = document.getElementById("survey-area");
      if (area !== null) area.textContent = text.area;
      if (changedMode) stir();
    },
    stir,
  };
}
