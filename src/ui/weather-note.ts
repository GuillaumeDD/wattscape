/**
 * The panel's weather note: where the weather comes from, and its time, or that it
 * is imposed by `?weather=`; turned off, that it is hidden. While the scene lays
 * snow on the ground, the open panel adds that the snow is inferred; the folded
 * panel keeps to the sources and their time (B-039). Text only, never HTML.
 */
import { type WeatherGroup } from "../data/open-meteo";
import { type MessageKey } from "../i18n";
import { type WeatherState } from "./weather-feed";

const WEATHER_NAMES = {
  clear: "weatherClear",
  cloudy: "weatherCloudy",
  fog: "weatherFog",
  drizzle: "weatherDrizzle",
  rain: "weatherRain",
  snow: "weatherSnow",
  storm: "weatherStorm",
} as const satisfies Record<WeatherGroup, MessageKey>;

export interface WeatherNoteInput {
  readonly weatherOn: boolean;
  /** Whether the scene lays snow on the ground. */
  readonly snowShown: boolean;
  /** Whether the panel is folded to its title and the figures' notes. */
  readonly folded: boolean;
  /** The weather `?weather=` imposes, if any. */
  readonly override: WeatherGroup | undefined;
  readonly state: WeatherState;
}

/**
 * The note's text. `time` formats a reading's time, with its date when `dated`
 * (a reading that is not live).
 */
export function weatherNoteText(
  input: WeatherNoteInput,
  t: (key: MessageKey) => string,
  time: (ms: number, dated: boolean) => string,
): string {
  const source = weatherSource(input, t, time);
  if (input.weatherOn) return source;
  const hidden = t(input.snowShown ? "weatherHiddenSnow" : "weatherHidden");
  return input.snowShown ? `${hidden} ${source}` : hidden;
}

function weatherSource(
  input: WeatherNoteInput,
  t: (key: MessageKey) => string,
  time: (ms: number, dated: boolean) => string,
): string {
  const { state } = input;
  if (input.override !== undefined)
    return t("weatherOverride").replace("{group}", t(WEATHER_NAMES[input.override]));
  if (state.kind === "loading" || state.kind === "unavailable")
    return t(state.kind === "loading" ? "weatherLoading" : "weatherUnavailable");
  const keys = {
    live: "weatherLive",
    stale: "weatherStale",
    ahead: "weatherAhead",
  } as const satisfies Record<typeof state.kind, MessageKey>;
  const shown = t(keys[state.kind]).replace("{time}", time(state.timeMs, state.kind !== "live"));
  const inferred = input.snowShown && !input.folded && state.kind !== "ahead";
  return inferred ? `${shown} ${t("weatherSnowInferred")}` : shown;
}
