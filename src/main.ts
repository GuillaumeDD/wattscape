import { detectLocale, translate, type Locale, type MessageKey } from "./i18n";
import { MAP_BAKED_ON } from "./map/france";
import { fixedClock, systemClock } from "./clock/clock";
import { mountAreaPicker, renderAreaOptions, type AreaState } from "./ui/area-picker";
import { mountSceneView, type SceneView } from "./ui/scene-view";
import { atFromQuery, browserStorage, initialArea, savedLocale, saveLocale } from "./ui/settings";

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
  document.getElementById("language")?.setAttribute("aria-label", t("switchLanguageLabel"));
  setText("area-label", t("areaLabel"));
  setText("locate", t("useMyLocation"));
  setText("debug-link", t("debugTitle"));
  document.getElementById("scene")?.setAttribute("aria-label", t("sceneLabel"));
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
render(locale);
renderArea(true);

// `?at=` fixes the time of day the scene shows (demos, screenshots).
const at = atFromQuery(location.search);
const canvas = document.getElementById("scene");
const scene: SceneView | null =
  canvas instanceof HTMLCanvasElement
    ? mountSceneView(canvas, at === undefined ? systemClock : fixedClock(at), areaState.area)
    : null;

let shownArea = areaState.area;
mountAreaPicker(areaState, () => {
  renderArea(false);
  // The picker also calls back for a new note ("looking for your position…"): the
  // camera flies only when the area changes.
  if (areaState.area === shownArea) return;
  shownArea = areaState.area;
  scene?.showArea(areaState.area);
});

document.getElementById("language")?.addEventListener("click", () => {
  locale = locale === "fr" ? "en" : "fr";
  saveLocale(storage, locale);
  render(locale);
  renderArea(true);
});
