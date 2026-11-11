import en from "./en.json";
import fr from "./fr.json";

export type Locale = "fr" | "en";
export type MessageKey = keyof typeof fr;

/** Supported locales, the default first (PRD § Localization). */
export const LOCALES: readonly Locale[] = ["fr", "en"];

// `satisfies` makes the build fail if English misses a key that French has.
const catalogs = { fr, en: en satisfies Record<MessageKey, string> } as const;

export function translate(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}

export function catalog(locale: Locale): Readonly<Record<MessageKey, string>> {
  return catalogs[locale];
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l === value);
}

/** Picks the first supported locale from the browser's preferences, else French. */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "fr";
}
