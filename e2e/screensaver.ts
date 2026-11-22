/**
 * The screensaver mode (B-021) on a page of its own, wired as src/main.ts wires it:
 * the scene view at a fixed time, the survey's controls and the mode, for
 * e2e/screensaver.spec.ts. `?screensaver` opens it, `?season=` imposes a season, and
 * `#survey-area` tells the survey's state. The legend (B-019) shows the recorded
 * sample of `?sample=day`, for Normandie.
 */
import { fixedClock } from "../src/clock/clock";
import { parseEco2mixRegions } from "../src/data/eco2mix";
import { legendFigures, legendText, mountLegend } from "../src/ui/legend";
import sample from "../tests/fixtures/eco2mix/2026-11-12-all-regions.json";
import { translate } from "../src/i18n";
import { type SurveyState } from "../src/scene/survey";
import { mountScreensaver } from "../src/ui/screensaver";
import { mountSceneView } from "../src/ui/scene-view";
import { screensaverFromQuery, seasonFromQuery } from "../src/ui/settings";
import { mountSurveyBar } from "../src/ui/survey-bar";

const canvas = document.getElementById("scene");
if (canvas instanceof HTMLCanvasElement) {
  const t = (key: Parameters<typeof translate>[1]): string => translate("en", key);
  const bar = mountSurveyBar((command) => {
    view.survey(command);
  });
  const view = mountSceneView(
    canvas,
    fixedClock(Date.UTC(2026, 5, 21, 12)),
    "28",
    false,
    () => undefined,
    "pixel",
    (state: SurveyState) => {
      bar.render(state, t);
    },
  );
  bar.render({ mode: "off", area: null }, t);
  const screensaver = mountScreensaver((on) => {
    if (on) view.survey("play");
    bar.stir();
  });
  document.getElementById("screensaver")?.addEventListener("click", (event) => {
    if (event.detail > 0 && event.currentTarget instanceof HTMLElement) event.currentTarget.blur();
    if (screensaver.on) screensaver.exit();
    else screensaver.enter(true);
  });
  const parsed = parseEco2mixRegions(sample);
  const readings = parsed.ok ? parsed.reading : null;
  mountLegend(false, () => undefined).render(
    legendText(
      legendFigures(readings, "28"),
      "28",
      readings === null ? { kind: "unavailable" } : { kind: "sample", timeMs: readings.timeMs },
      "en",
      t,
      (ms) => new Date(ms).toISOString().slice(11, 16),
    ),
    { fold: t("legendFold"), unfold: t("legendUnfold") },
  );
  const season = seasonFromQuery(location.search);
  if (season !== undefined) view.setSeason(season);
  if (screensaverFromQuery(location.search)) screensaver.enter(false);
}
