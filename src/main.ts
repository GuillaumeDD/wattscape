import { detectLocale, isLocale, translate, type Locale, type MessageKey } from "./i18n";

const LOCALE_KEY = "wattscape.locale";

/** The saved language, if storage works and holds a known value (storage is untrusted). */
function savedLocale(): Locale | undefined {
  try {
    const value = localStorage.getItem(LOCALE_KEY);
    return isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Storage can be blocked (private mode, settings): the choice then lasts the visit.
  }
}

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
  document.getElementById("language")?.setAttribute("aria-label", t("switchLanguageLabel"));
}

let locale: Locale = savedLocale() ?? detectLocale(navigator.languages);
render(locale);

document.getElementById("language")?.addEventListener("click", () => {
  locale = locale === "fr" ? "en" : "fr";
  saveLocale(locale);
  render(locale);
});
