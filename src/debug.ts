/**
 * The debug page (B-007): every live figure with its field, source and time, for the
 * area the main page shows. It reads the weather and the sky at the region's
 * reference point, never at the viewer's position, which is not kept between pages.
 */
import { systemClock } from "./clock/clock";
import { fetchEco2mix, isEco2mixArea, type Eco2mixArea } from "./data/eco2mix";
import { fetchOpenMeteo, roundPosition, type RoundedPosition } from "./data/open-meteo";
import { referencePoint } from "./geo/regions";
import { detectLocale, translate, type Locale, type MessageKey } from "./i18n";
import { renderAreaOptions } from "./ui/area-picker";
import { liveFigures, type FigureSection, type LiveInputs } from "./ui/live-figures";
import { browserStorage, initialArea, savedLocale, saveLocale } from "./ui/settings";

const storage = browserStorage();
let locale: Locale = savedLocale(storage) ?? detectLocale(navigator.languages);
let area: Eco2mixArea = initialArea(location.search, storage);
let eco2mix: LiveInputs["eco2mix"] = "loading";
let weather: LiveInputs["weather"] = "loading";
/** The load in flight; an answer from an older one is dropped. */
let current: AbortController | null = null;

const fetchFn: typeof fetch = (input, init) => fetch(input, init);
const t = (key: MessageKey): string => translate(locale, key);

function pointOf(a: Eco2mixArea): RoundedPosition | null {
  const p = referencePoint(a);
  return p === null ? null : roundPosition(p.latitude, p.longitude);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className !== undefined) el.className = className;
  return el;
}

function renderSection(section: FigureSection): HTMLElement {
  const box = document.createElement("section");
  box.append(element("h2", t(section.title)));
  box.append(element("p", `${t("debugSource")} ${section.source}`, "source"));
  let when = section.time === null ? "" : `${t("debugTime")} ${section.time}`;
  if (section.ageMinutes !== null)
    when += ` (${t("debugAge").replace("{minutes}", String(section.ageMinutes))})`;
  const status =
    section.detail === null ? t(section.status) : `${t(section.status)}: ${section.detail}`;
  box.append(element("p", when === "" ? status : `${when}, ${status}`, `status ${section.status}`));
  if (section.rows.length > 0) {
    const table = document.createElement("table");
    for (const row of section.rows) {
      const tr = document.createElement("tr");
      tr.append(element("th", row.field), element("td", row.value));
      table.append(tr);
    }
    box.append(table);
  }
  return box;
}

function render(): void {
  document.documentElement.lang = locale;
  document.title = `Wattscape · ${t("debugTitle")}`;
  const set = (id: string, text: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("title", t("debugTitle"));
  set("intro", t("debugIntro"));
  set("refresh", t("debugRefresh"));
  set("language", t("switchLanguage"));
  set("back", t("debugBack"));
  document.getElementById("language")?.setAttribute("aria-label", t("switchLanguageLabel"));
  document.getElementById("area")?.setAttribute("aria-label", t("areaLabel"));
  const sections = liveFigures({
    area,
    point: pointOf(area),
    eco2mix,
    weather,
    nowMs: systemClock.now(),
    locale,
  });
  document.getElementById("sections")?.replaceChildren(...sections.map(renderSection));
}

/** Fetches both sources for the current area; a newer load cancels this one. */
function load(): void {
  current?.abort();
  const controller = new AbortController();
  current = controller;
  const point = pointOf(area);
  eco2mix = "loading";
  weather = point === null ? "none" : "loading";
  render();
  void fetchEco2mix(area, fetchFn, controller.signal).then((result) => {
    if (current !== controller) return;
    eco2mix = result;
    render();
  });
  if (point !== null) {
    void fetchOpenMeteo(point, fetchFn, controller.signal).then((result) => {
      if (current !== controller) return;
      weather = result;
      render();
    });
  }
}

function renderOptions(): void {
  const select = document.getElementById("area");
  if (select instanceof HTMLSelectElement) renderAreaOptions(select, t, area);
}

document.getElementById("area")?.addEventListener("change", (event) => {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : "FR";
  // Only for this page: the area the main page remembers is left alone.
  area = isEco2mixArea(value) ? value : "FR";
  load();
});
document.getElementById("refresh")?.addEventListener("click", load);
document.getElementById("language")?.addEventListener("click", () => {
  locale = locale === "fr" ? "en" : "fr";
  saveLocale(storage, locale);
  renderOptions();
  render();
});

/** Data is fetched again this often while the page is visible. */
const RELOAD_MS = 15 * 60_000;
let timers: ReturnType<typeof setInterval>[] = [];

/** Runs while the page is visible; a hidden page fetches nothing and redraws nothing. */
function start(): void {
  load();
  timers = [
    setInterval(load, RELOAD_MS),
    // Ages and the sun move on their own: redraw every minute, without fetching.
    setInterval(render, 60_000),
  ];
}

function stop(): void {
  for (const timer of timers) clearInterval(timer);
  timers = [];
  current?.abort();
  current = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
  else if (timers.length === 0) start();
});

renderOptions();
if (document.hidden) render();
else start();
