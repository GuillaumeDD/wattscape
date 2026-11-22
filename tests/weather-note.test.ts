import { describe, expect, it } from "vitest";
import { LOCALES, translate } from "../src/i18n";
import { type WeatherNoteInput, weatherNoteText } from "../src/ui/weather-note";

const LIVE = { kind: "live", timeMs: Date.UTC(2026, 10, 22, 8, 30) } as const;
const time = (ms: number, dated: boolean): string =>
  `${dated ? "date " : ""}${new Date(ms).toISOString()}`;

function input(over: Partial<WeatherNoteInput>): WeatherNoteInput {
  return {
    weatherOn: true,
    snowShown: true,
    folded: false,
    override: undefined,
    state: LIVE,
    ...over,
  };
}

describe("weatherNoteText", () => {
  for (const locale of LOCALES) {
    const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);
    const live = t("weatherLive").replace("{time}", time(LIVE.timeMs, false));
    const inferred = t("weatherSnowInferred");

    it(`says the snow is inferred while the panel is open (${locale})`, () => {
      expect(weatherNoteText(input({}), t, time)).toBe(`${live} ${inferred}`);
    });

    it(`keeps to the source and its time once folded (B-039, ${locale})`, () => {
      expect(weatherNoteText(input({ folded: true }), t, time)).toBe(live);
    });

    it(`says nothing of snow when none lies on the ground (${locale})`, () => {
      expect(weatherNoteText(input({ snowShown: false }), t, time)).toBe(live);
    });

    it(`dates a stale reading, and keeps the snow line open (${locale})`, () => {
      const state = { kind: "stale", timeMs: LIVE.timeMs } as const;
      const stale = t("weatherStale").replace("{time}", time(LIVE.timeMs, true));
      expect(weatherNoteText(input({ state }), t, time)).toBe(`${stale} ${inferred}`);
      expect(weatherNoteText(input({ state, folded: true }), t, time)).toBe(stale);
    });

    it(`adds no snow line to readings all ahead of the clock (${locale})`, () => {
      const state = { kind: "ahead", timeMs: LIVE.timeMs } as const;
      const ahead = t("weatherAhead").replace("{time}", time(LIVE.timeMs, true));
      expect(weatherNoteText(input({ state }), t, time)).toBe(ahead);
    });

    it(`names the weather ?weather= imposes (${locale})`, () => {
      const text = weatherNoteText(input({ override: "rain" }), t, time);
      expect(text).toBe(t("weatherOverride").replace("{group}", t("weatherRain")));
    });

    it(`says loading or unavailable, with no snow line (${locale})`, () => {
      expect(weatherNoteText(input({ state: { kind: "loading" } }), t, time)).toBe(
        t("weatherLoading"),
      );
      expect(weatherNoteText(input({ state: { kind: "unavailable" } }), t, time)).toBe(
        t("weatherUnavailable"),
      );
    });

    it(`turned off, says the weather is hidden and where the snow comes from (${locale})`, () => {
      const off = { weatherOn: false } as const;
      const hiddenSnow = t("weatherHiddenSnow");
      expect(weatherNoteText(input(off), t, time)).toBe(`${hiddenSnow} ${live} ${inferred}`);
      expect(weatherNoteText(input({ ...off, folded: true }), t, time)).toBe(
        `${hiddenSnow} ${live}`,
      );
      expect(weatherNoteText(input({ ...off, snowShown: false }), t, time)).toBe(
        t("weatherHidden"),
      );
    });
  }
});
