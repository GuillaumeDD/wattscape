import { describe, expect, it } from "vitest";
import { LOCALES, translate } from "../src/i18n";
import { surveyBarText } from "../src/ui/survey-bar";

describe("surveyBarText", () => {
  for (const locale of LOCALES) {
    const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

    it(`offers Play, with no area line, when the tour is off (${locale})`, () => {
      const text = surveyBarText({ mode: "off", area: null }, t);
      expect(text.toggle).toBe(t("surveyPlay"));
      expect(text.area).toBe("");
      expect(text.stop).toBe(t("surveyStop"));
    });

    it(`offers Pause and names the region while it plays (${locale})`, () => {
      const text = surveyBarText({ mode: "playing", area: "28" }, t);
      expect(text.toggle).toBe(t("surveyPause"));
      expect(text.area).toBe(t("surveyArea").replace("{area}", "Normandie"));
      expect(text.area).toContain("Normandie");
    });

    it(`offers Resume and says it is paused, over France (${locale})`, () => {
      const text = surveyBarText({ mode: "paused", area: "FR" }, t);
      expect(text.toggle).toBe(t("surveyResume"));
      expect(text.area).toContain(t("areaFrance"));
      expect(text.area).not.toContain("{area}");
    });
  }

  it("names the keys in the labels, in every locale", () => {
    for (const locale of LOCALES) {
      for (const key of ["surveyPlay", "surveyPause", "surveyResume"] as const)
        expect(translate(locale, key)).toContain("(P)");
      expect(translate(locale, "surveyArea")).toContain("{area}");
      expect(translate(locale, "surveyPaused")).toContain("{area}");
    }
  });
});
