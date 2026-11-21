/**
 * The screensaver mode (B-021) on a page of its own, wired as src/main.ts wires it:
 * the scene view at a fixed time, the survey's controls and the mode, for
 * e2e/screensaver.spec.ts. `?screensaver` opens it, `?season=` imposes a season, and
 * `#survey-area` tells the survey's state.
 */
import { fixedClock } from "../src/clock/clock";
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
  });
  document.getElementById("screensaver")?.addEventListener("click", () => {
    if (screensaver.on) screensaver.exit();
    else screensaver.enter(true);
  });
  const season = seasonFromQuery(location.search);
  if (season !== undefined) view.setSeason(season);
  if (screensaverFromQuery(location.search)) screensaver.enter(false);
}
