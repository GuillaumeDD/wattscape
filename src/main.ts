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
import { isThemeId, THEME_IDS, type ThemeId } from "./render/theme-ids";
import {
  atFromQuery,
  browserStorage,
  initialArea,
  initialPanelFolded,
  initialTheme,
  sampleFromQuery,
  screensaverFromQuery,
  seasonFromQuery,
  savePanelFolded,
  savedLocale,
  saveLocale,
  saveTheme,
  timelapseFromQuery,
  weatherFromQuery,
} from "./ui/settings";
import { startWeatherFeed, type WeatherFeed, type WeatherState } from "./ui/weather-feed";
import { overrideWeather, sceneWeather } from "./scene/weather";
import { anySnow } from "./scene/snow";
import { type WeatherGroup } from "./data/open-meteo";
import { mountSurveyBar } from "./ui/survey-bar";
import { mountScreensaver } from "./ui/screensaver";
import { type Season } from "./scene/season";
import { type SurveyState } from "./scene/survey";

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
  setText("theme-label", t("themeLabel"));
  renderThemeOptions();
  setText("locate", t("useMyLocation"));
  setText("debug-link", t("debugTitle"));
  document.getElementById("scene")?.setAttribute("aria-label", t("sceneLabel"));
  renderPlantsNote();
  renderWeatherNote();
  renderSurvey();
  renderSeasonNote();
}

let plantsState: FeedState = { kind: "loading" };
let weatherState: WeatherState = { kind: "loading" };
/** Whether the scene lays snow on the ground: the note then says it is inferred. */
let snowShown = false;
/** The weather `?weather=` imposes, if any. */
const weatherOverride: WeatherGroup | undefined = weatherFromQuery(location.search);
/** The caption shown now, to write again when the language changes. */
let caption: ShownCaption | null = null;
/** What the survey mode does now (B-032), to write again when the language changes. */
let surveyState: SurveyState = { mode: "off", area: null };
/** The survey's controls; they send their commands to the scene, mounted below. */
const surveyBar = mountSurveyBar((command) => {
  scene?.survey(command);
});

function renderSurvey(): void {
  surveyBar.render(surveyState, (key) => translate(locale, key));
  const button = document.getElementById("screensaver");
  if (button === null) return;
  const label = translate(locale, screensaver.on ? "screensaverExit" : "screensaverEnter");
  button.setAttribute("aria-label", label);
  button.title = label;
}

/**
 * The screensaver mode (B-021): it starts the survey (D-073). It is left with the
 * survey playing, which the viewer stops if they wish.
 */
const screensaver = mountScreensaver((on) => {
  if (on) scene?.survey("play");
  renderSurvey();
});
document.getElementById("screensaver")?.addEventListener("click", () => {
  if (screensaver.on) screensaver.exit();
  else screensaver.enter(true);
});

const SEASON_NAMES = {
  winter: "seasonWinter",
  spring: "seasonSpring",
  summer: "seasonSummer",
  autumn: "seasonAutumn",
} as const satisfies Record<Season, MessageKey>;
/** The season `?season=` imposes, if any: labelled, as an imposed weather is. */
const seasonOverride: Season | undefined = seasonFromQuery(location.search);

function renderSeasonNote(): void {
  const note = document.getElementById("season-note");
  if (note === null) return;
  note.hidden = seasonOverride === undefined;
  if (seasonOverride !== undefined)
    note.textContent = translate(locale, "seasonOverride").replace(
      "{season}",
      translate(locale, SEASON_NAMES[seasonOverride]),
    );
}

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

/** A reading's time: a live step is under 3 hours old, its time says enough; any other gets its date. */
function readingTime(ms: number): string {
  return new Intl.DateTimeFormat(locale, {
    ...(plantsState.kind === "live" ? {} : { dateStyle: "short" as const }),
    timeStyle: "short",
  }).format(new Date(ms));
}

/** Where the plants' figures come from, and their time: every animated figure is traceable. */
function renderPlantsNote(): void {
  const t = (key: MessageKey): string => translate(locale, key);
  const state = plantsState;
  if (state.kind === "loading" || state.kind === "unavailable") {
    setText("plants-note", t(state.kind === "loading" ? "plantsLoading" : "plantsUnavailable"));
    return;
  }
  const time = readingTime(state.timeMs);
  const keys = {
    live: "plantsLive",
    stale: "plantsStale",
    sample: "plantsSample",
    ahead: "plantsAhead",
    replay: "plantsReplay",
  } as const satisfies Record<typeof state.kind, MessageKey>;
  setText("plants-note", t(keys[state.kind]).replace("{time}", time));
}

const WEATHER_NAMES = {
  clear: "weatherClear",
  cloudy: "weatherCloudy",
  fog: "weatherFog",
  drizzle: "weatherDrizzle",
  rain: "weatherRain",
  snow: "weatherSnow",
  storm: "weatherStorm",
} as const satisfies Record<WeatherGroup, MessageKey>;

/** Where the weather comes from, and its time, or that it is imposed by `?weather=`. */
function renderWeatherNote(): void {
  const t = (key: MessageKey): string => translate(locale, key);
  const state = weatherState;
  if (weatherOverride !== undefined) {
    setText(
      "weather-note",
      t("weatherOverride").replace("{group}", t(WEATHER_NAMES[weatherOverride])),
    );
    return;
  }
  if (state.kind === "loading" || state.kind === "unavailable") {
    setText("weather-note", t(state.kind === "loading" ? "weatherLoading" : "weatherUnavailable"));
    return;
  }
  const keys = {
    live: "weatherLive",
    stale: "weatherStale",
    ahead: "weatherAhead",
  } as const satisfies Record<typeof state.kind, MessageKey>;
  const time = new Intl.DateTimeFormat(locale, {
    ...(state.kind === "live" ? {} : { dateStyle: "short" as const }),
    timeStyle: "short",
  }).format(new Date(state.timeMs));
  const snow = snowShown && state.kind !== "ahead" ? ` ${t("weatherSnowInferred")}` : "";
  setText("weather-note", t(keys[state.kind]).replace("{time}", time) + snow);
}

/** The area list: rebuilt only when the language changes, otherwise just selected. */
function renderArea(rebuild: boolean): void {
  const select = document.getElementById("area");
  if (!(select instanceof HTMLSelectElement)) return;
  if (rebuild) renderAreaOptions(select, (key) => translate(locale, key), areaState.area);
  else select.value = areaState.area;
  setText("location-note", translate(locale, areaState.note));
}

const THEME_NAMES = {
  pixel: "themePixel",
  modern: "themeModern",
} as const satisfies Record<ThemeId, MessageKey>;

/** The list of themes (PRD G-011), in the viewer's language, the current one selected. */
function renderThemeOptions(): void {
  const select = document.getElementById("theme");
  if (!(select instanceof HTMLSelectElement)) return;
  select.replaceChildren(
    ...THEME_IDS.map((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = translate(locale, THEME_NAMES[id]);
      return option;
    }),
  );
  select.value = theme;
}

const storage = browserStorage();
let theme: ThemeId = initialTheme(location.search, storage);

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
  const text = caption === null ? null : captionText(caption.mark, locale, readingTime);
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
    ? mountSceneView(
        canvas,
        clock,
        areaState.area,
        timelapse !== undefined,
        (shown) => {
          caption = shown;
          renderCaption();
        },
        theme,
        (state) => {
          surveyState = state;
          renderSurvey();
        },
      )
    : null;

document.getElementById("theme")?.addEventListener("change", (event) => {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : undefined;
  // The list holds the known themes only; anything else is ignored.
  if (!isThemeId(value)) return;
  theme = value;
  saveTheme(storage, theme);
  scene?.setTheme(theme);
});

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

// The weather of every region (B-018): live, or the same one imposed by `?weather=`,
// labelled as such.
const viewerOf = (state: AreaState): Parameters<WeatherFeed["setViewer"]>[0] =>
  state.area === "FR" || state.position === null
    ? null
    : { region: state.area, position: state.position };
const weatherFeed: WeatherFeed | null =
  weatherOverride === undefined
    ? startWeatherFeed(
        clock,
        (input, init) => fetch(input, init),
        (byRegion, state) => {
          weatherState = state;
          snowShown = anySnow(sceneWeather(byRegion, clock.now()));
          renderWeatherNote();
          scene?.setWeather(byRegion);
        },
      )
    : null;
if (weatherOverride !== undefined) {
  renderWeatherNote();
  scene?.setWeather(overrideWeather(weatherOverride, clock.now()), true);
}

let shownArea = areaState.area;
mountAreaPicker(areaState, () => {
  renderArea(false);
  // The position comes with the area it was found in, and goes when an area is
  // picked by hand: the viewer's region takes its weather there, or at its prefecture.
  weatherFeed?.setViewer(viewerOf(areaState));
  // The picker also calls back for a new note ("looking for your position…"): the
  // camera flies only when the area changes.
  if (areaState.area === shownArea) return;
  shownArea = areaState.area;
  // An area found from the position may land after a tour started: the tour goes on.
  scene?.showArea(areaState.area, areaState.position !== null);
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

if (seasonOverride !== undefined) scene?.setSeason(seasonOverride);
// `?screensaver` opens the page in screensaver mode, the survey playing; without
// full screen, which only a press can ask for (F, or the button, then).
if (screensaverFromQuery(location.search)) screensaver.enter(false);
