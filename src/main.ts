import { detectLocale, translate, type Locale, type MessageKey } from "./i18n";
import { mountAreaPicker, renderAreaOptions, type AreaState } from "./ui/area-picker";
import { browserStorage, initialArea, savedLocale, saveLocale } from "./ui/settings";

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
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
  document.getElementById("language")?.setAttribute("aria-label", t("switchLanguageLabel"));
  setText("area-label", t("areaLabel"));
  setText("locate", t("useMyLocation"));
  setText("debug-link", t("debugTitle"));
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
mountAreaPicker(areaState, () => {
  renderArea(false);
});

document.getElementById("language")?.addEventListener("click", () => {
  locale = locale === "fr" ? "en" : "fr";
  saveLocale(storage, locale);
  render(locale);
  renderArea(true);
});
