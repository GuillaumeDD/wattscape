import { detectLocale, translate, type Locale, type MessageKey } from "./i18n";
import { MAP_BAKED_ON } from "./map/france";
import { fixedClock, replayClock, systemClock } from "./clock/clock";
import { HISTORY_MS } from "./data/eco2mix";
import { mountAreaPicker, renderAreaOptions, type AreaState } from "./ui/area-picker";
import { loadSample } from "./data/samples";
import { feedState, type FeedState, startPlantFeed } from "./ui/plant-feed";
import { startReplayFeed } from "./ui/replay-feed";
import { mountSceneView, type SceneView, type ShownCaption } from "./ui/scene-view";
import { captionPosition, captionText } from "./ui/captions";
import {
  atFromQuery,
  browserStorage,
  initialArea,
  initialPanelFolded,
  sampleFromQuery,
  savePanelFolded,
  savedLocale,
  saveLocale,
  timelapseFromQuery,
} from "./ui/settings";

/** The time-lapse plays a day in this long (PRD § 4.9: a day in a minute). */
const TIMELAPSE_MS = 60_000;

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** The month the map data was extracted, as Licence Ouverte asks for its date. */
function mapDate(locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${MAP_BAKED_ON}T00:00:00Z`));
}

function render(locale: Locale): void {
  const t = (key: MessageKey): string => translate(locale, key);
  document.documentElement.lang = locale;
  document.title = t("title");
  setText("title", t("title"));
  setText("tagline", t("tagline"));
  setText("status", t("status"));
  setText("language", t("switchLanguage"));
  setText("credits-data", t("creditsData"));
  setText("credits-eco2mix-licence", t("creditsEco2mixLicence"));
  setText("credits-weather-licence", t("creditsWeatherLicence"));
  setText("credits-map", t("creditsMap"));
  setText("credits-map-licence", t("creditsMapLicence").replace("{date}", mapDate(locale)));
  setText("credits-plants", t("creditsPlants"));
  setText("credits-plants-licence", t("creditsPlantsLicence"));
  document.getElementById("language")?.setAttribute("aria-label", t("switchLanguageLabel"));
  renderPanel();
  setText("area-label", t("areaLabel"));
  setText("locate", t("useMyLocation"));
  setText("debug-link", t("debugTitle"));
  document.getElementById("scene")?.setAttribute("aria-label", t("sceneLabel"));
  renderPlantsNote();
}

let plantsState: FeedState = { kind: "loading" };
/** The caption shown now, to write again when the language changes. */
let caption: ShownCaption | null = null;

/**
 * The panel folds to its title and the figures' note, so a phone sees the map: a
 * "−" folds it, a "+" opens it again, named for screen readers.
 */
function renderPanel(): void {
  const label = translate(locale, panelFolded ? "panelUnfold" : "panelFold");
  document.querySelector("main")?.classList.toggle("folded", panelFolded);
  document.getElementById("panel-body")?.toggleAttribute("hidden", panelFolded);
  const toggle = document.getElementById("panel-toggle");
  if (toggle === null) return;
  toggle.textContent = panelFolded ? "+" : "−";
  toggle.setAttribute("aria-expanded", String(!panelFolded));
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
}

/** Where the plants' figures come from, and their time: every animated figure is traceable. */
function renderPlantsNote(): void {
  const t = (key: MessageKey): string => translate(locale, key);
  const state = plantsState;
  if (state.kind === "loading" || state.kind === "unavailable") {
    setText("plants-note", t(state.kind === "loading" ? "plantsLoading" : "plantsUnavailable"));
    return;
  }
  // A live step is under 3 hours old: its time says enough. Any other gets its date.
  const time = new Intl.DateTimeFormat(locale, {
    ...(state.kind === "live" ? {} : { dateStyle: "short" as const }),
    timeStyle: "short",
  }).format(new Date(state.timeMs));
  const keys = {
    live: "plantsLive",
    stale: "plantsStale",
    sample: "plantsSample",
    ahead: "plantsAhead",
    replay: "plantsReplay",
  } as const satisfies Record<typeof state.kind, MessageKey>;
  setText("plants-note", t(keys[state.kind]).replace("{time}", time));
}

/** The area list: rebuilt only when the language changes, otherwise just selected. */
function renderArea(rebuild: boolean): void {
  const select = document.getElementById("area");
  if (!(select instanceof HTMLSelectElement)) return;
  if (rebuild) renderAreaOptions(select, (key) => translate(locale, key), areaState.area);
  else select.value = areaState.area;
  setText("location-note", translate(locale, areaState.note));
}

const storage = browserStorage();

const areaState: AreaState = {
  area: initialArea(location.search, storage),
  position: null,
  note: "locationWhy",
};

let locale: Locale = savedLocale(storage) ?? detectLocale(navigator.languages);
/** A phone, in portrait or landscape: under 40 rem wide or under 30 rem high. */
const NARROW = "(max-width: 40rem), (max-height: 30rem)";
let panelFolded = initialPanelFolded(storage, window.matchMedia(NARROW).matches);
render(locale);
renderArea(true);

// `?at=` fixes the time of day the scene shows (demos, screenshots); `?timelapse=day`
// replays the day before it (or before now) in a minute.
const at = atFromQuery(location.search);
const timelapse = timelapseFromQuery(location.search);
const end = at ?? systemClock.now();
const clock =
  timelapse !== undefined
    ? replayClock(end - HISTORY_MS, HISTORY_MS, TIMELAPSE_MS)
    : at === undefined
      ? systemClock
      : fixedClock(at);
/** A landmark's caption, by its sprite, in the viewer's language; text only, never HTML. */
function renderCaption(): void {
  const box = document.getElementById("caption");
  if (box === null) return;
  const text = caption === null ? null : captionText(caption.mark, locale);
  if (caption === null || text === null) {
    box.hidden = true;
    return;
  }
  setText("caption-name", text.name);
  setText("caption-line", text.line);
  box.hidden = false;
  const { left, top } = captionPosition(
    caption.box,
    box.offsetWidth,
    box.offsetHeight,
    window.innerWidth,
    window.innerHeight,
  );
  box.style.left = `${String(left)}px`;
  box.style.top = `${String(top)}px`;
}

const canvas = document.getElementById("scene");
const scene: SceneView | null =
  canvas instanceof HTMLCanvasElement
    ? mountSceneView(canvas, clock, areaState.area, timelapse !== undefined, (shown) => {
        caption = shown;
        renderCaption();
      })
    : null;

// The plants' figures: live, or a recorded sample (`?sample=`), labelled as such.
const sample = sampleFromQuery(location.search);
const showPlants = (readings: Parameters<SceneView["setReadings"]>[0], state: FeedState): void => {
  plantsState = state;
  renderPlantsNote();
  scene?.setReadings(readings, state.kind === "sample" || state.kind === "replay");
};
if (timelapse !== undefined)
  startReplayFeed(clock, end, (input, init) => fetch(input, init), showPlants);
else if (sample === undefined)
  startPlantFeed(clock, (input, init) => fetch(input, init), showPlants);
else
  loadSample(sample)
    .then((result) => {
      const readings = result.ok ? result.reading : null;
      showPlants(readings, feedState(readings, true, clock.now()));
    })
    .catch(() => {
      // The sample's chunk did not load (offline, or a newer deploy): say so.
      showPlants(null, { kind: "unavailable" });
    });

let shownArea = areaState.area;
mountAreaPicker(areaState, () => {
  renderArea(false);
  // The picker also calls back for a new note ("looking for your position…"): the
  // camera flies only when the area changes.
  if (areaState.area === shownArea) return;
  shownArea = areaState.area;
  scene?.showArea(areaState.area);
});

document.getElementById("panel-toggle")?.addEventListener("click", () => {
  panelFolded = !panelFolded;
  savePanelFolded(storage, panelFolded);
  renderPanel();
  renderCaption();
});

document.getElementById("language")?.addEventListener("click", () => {
  locale = locale === "fr" ? "en" : "fr";
  saveLocale(storage, locale);
  render(locale);
  renderArea(true);
});
