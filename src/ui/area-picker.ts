/**
 * The area picker: a region list and a "Use my location" button (PRD § 4.1). The
 * position is asked only on a press, at most once per visit; it is turned into an
 * area offline and rounded to 0.1° at once, and the raw value is never kept.
 */
import { isEco2mixArea, REGION_CODES, type Eco2mixArea } from "../data/eco2mix";
import { roundPosition, type RoundedPosition } from "../data/open-meteo";
import { areaOfPosition, REGION_NAMES } from "../geo/regions";
import { type MessageKey } from "../i18n";
import { browserStorage, saveArea } from "./settings";

export interface AreaState {
  area: Eco2mixArea;
  /** The viewer's position rounded to 0.1°, for the weather; null until located. */
  position: RoundedPosition | null;
  /** Why the last location attempt ended as it did, shown under the picker. */
  note: MessageKey;
}

type Translate = (key: MessageKey) => string;

/** Fills the region list; region names are official French names in every locale. */
export function renderAreaOptions(
  select: HTMLSelectElement,
  t: Translate,
  area: Eco2mixArea,
): void {
  select.replaceChildren();
  const france = document.createElement("option");
  france.value = "FR";
  france.textContent = t("areaFrance");
  select.append(france);
  const sorted = [...REGION_CODES].sort((a, b) =>
    REGION_NAMES[a].localeCompare(REGION_NAMES[b], "fr"),
  );
  for (const code of sorted) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = REGION_NAMES[code];
    select.append(option);
  }
  select.value = area;
}

/** The note to show for a lookup outcome. */
export function noteForLookup(reason: "region" | "abroad" | "corsica" | "invalid"): MessageKey {
  switch (reason) {
    case "region":
      return "locationFound";
    case "abroad":
      return "locationAbroad";
    case "corsica":
      return "locationCorsica";
    case "invalid":
      return "locationUnavailable";
  }
}

/** What a location attempt gives; `area: null` keeps the current area (refusal). */
export interface LocateResult {
  area: Eco2mixArea | null;
  position: RoundedPosition | null;
  note: MessageKey;
  /** Whether the area should be remembered for the next visit. */
  save: boolean;
}

/** Longest wait for an answer, prompt included, before giving up. */
export const LOCATE_TIMEOUT_MS = 60_000;

/**
 * Asks the browser for the position once and resolves the new state, or `null` when
 * the viewer picked an area meanwhile (`isCurrent` turned false): a late answer must
 * not override a choice made after the request.
 */
export function locate(
  geolocation: Geolocation | undefined,
  isCurrent: () => boolean,
): Promise<LocateResult | null> {
  return new Promise((resolve) => {
    if (geolocation === undefined) {
      resolve({ area: null, position: null, note: "locationUnavailable", save: false });
      return;
    }
    let settled = false;
    const settle = (result: LocateResult | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(isCurrent() ? result : null);
    };
    // The API's own timeout does not run while the permission prompt is open, and
    // some browsers never call back when the prompt is dismissed: give up anyway.
    const timer = setTimeout(() => {
      settle({ area: null, position: null, note: "locationUnavailable", save: false });
    }, LOCATE_TIMEOUT_MS);
    geolocation.getCurrentPosition(
      (answer) => {
        const { latitude, longitude } = answer.coords;
        const lookup = areaOfPosition(latitude, longitude);
        settle({
          area: lookup.area,
          position: lookup.reason === "region" ? roundPosition(latitude, longitude) : null,
          note: noteForLookup(lookup.reason),
          // Abroad or in Corsica, show France for this visit but keep the region
          // remembered for the next one.
          save: lookup.reason === "region",
        });
      },
      () => {
        settle({ area: null, position: null, note: "locationRefused", save: false });
      },
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 10 * 60_000 },
    );
  });
}

/** Wires the picker; `onChange` runs after every change of area or note. */
export function mountAreaPicker(state: AreaState, onChange: () => void): void {
  const select = document.getElementById("area");
  const button = document.getElementById("locate");
  if (!(select instanceof HTMLSelectElement) || !(button instanceof HTMLButtonElement)) return;
  let choice = 0;
  select.addEventListener("change", () => {
    choice++;
    const value = select.value;
    const area = isEco2mixArea(value) ? value : "FR";
    state.area = area;
    // A region picked by hand: the position no longer describes it.
    state.position = null;
    state.note = "locationWhy";
    saveArea(browserStorage(), area);
    onChange();
  });
  button.addEventListener("click", () => {
    button.disabled = true;
    state.note = "locationSearching";
    onChange();
    const asked = ++choice;
    void locate(navigator.geolocation, () => asked === choice).then((result) => {
      // The viewer may try again, whatever happened (a refusal fixed in the
      // browser's settings, an answer dropped because they picked an area).
      button.disabled = false;
      if (result === null) return;
      state.note = result.note;
      // On refusal the viewer keeps the area they are on: France on a first visit.
      if (result.area !== null) {
        state.area = result.area;
        state.position = result.position;
        if (result.save) saveArea(browserStorage(), result.area);
      }
      onChange();
    });
  });
}
