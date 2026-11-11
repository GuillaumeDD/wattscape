import { describe, expect, it } from "vitest";
import { catalog, detectLocale, isLocale, LOCALES, translate } from "../src/i18n";

describe("i18n catalogs", () => {
  it("every locale has exactly the same keys as French", () => {
    const frKeys = Object.keys(catalog("fr")).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(catalog(locale)).sort()).toEqual(frKeys);
    }
  });

  it("no translation is empty", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(catalog(locale))) {
        expect(value.trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("keeps the map credit's {date} placeholder in every locale", () => {
    for (const locale of LOCALES) {
      expect(translate(locale, "creditsMapLicence"), locale).toContain("{date}");
    }
  });

  it("translate returns the locale's string", () => {
    expect(translate("fr", "switchLanguage")).toBe("English");
    expect(translate("en", "switchLanguage")).toBe("Français");
  });
});

describe("detectLocale", () => {
  it("picks the first supported language, ignoring region and case", () => {
    expect(detectLocale(["en-GB", "fr-FR"])).toBe("en");
    expect(detectLocale(["FR-ca"])).toBe("fr");
    expect(detectLocale(["de-DE", "en-US"])).toBe("en");
  });

  it("falls back to French", () => {
    expect(detectLocale([])).toBe("fr");
    expect(detectLocale(["de", "ja"])).toBe("fr");
  });
});

describe("isLocale", () => {
  it("accepts only supported locale codes", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
    for (const v of ["FR", "de", "", null, undefined, 1, {}]) expect(isLocale(v)).toBe(false);
  });
});
