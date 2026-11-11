/**
 * Settings from the URL and from browser storage. Both are untrusted (ARCHITECTURE §
 * Security): only a known area code is accepted, anything else is ignored.
 */
import { isEco2mixArea, type Eco2mixArea } from "../data/eco2mix";

const AREA_KEY = "wattscape.area";

/** `localStorage`, or `undefined` where merely touching it throws (blocked storage). */
export function browserStorage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

/** `?area=28` or `?area=FR`; `undefined` when absent, repeated or not an area. */
export function areaFromQuery(search: string): Eco2mixArea | undefined {
  if (search.length > 2048) return undefined;
  const values = new URLSearchParams(search).getAll("area");
  if (values.length !== 1) return undefined;
  const value = values[0];
  return isEco2mixArea(value) ? value : undefined;
}

/** The area remembered in this browser, if storage works and holds a known code. */
export function savedArea(storage: Pick<Storage, "getItem"> | undefined): Eco2mixArea | undefined {
  try {
    const value = storage?.getItem(AREA_KEY);
    return isEco2mixArea(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers the area code, and nothing else (never the position). */
export function saveArea(storage: Pick<Storage, "setItem"> | undefined, area: Eco2mixArea): void {
  try {
    storage?.setItem(AREA_KEY, area);
  } catch {
    // Storage can be blocked (private mode, settings): the choice then lasts the visit.
  }
}

/** The area to open on: the URL wins, then the remembered choice, then France. */
export function initialArea(
  search: string,
  storage: Pick<Storage, "getItem"> | undefined,
): Eco2mixArea {
  return areaFromQuery(search) ?? savedArea(storage) ?? "FR";
}
