/**
 * Settings from the URL and from browser storage. Both are untrusted (ARCHITECTURE §
 * Security): only a known area code is accepted, anything else is ignored.
 */
import { isEco2mixArea, type Eco2mixArea } from "../data/eco2mix";
import { isLocale, type Locale } from "../i18n";

const AREA_KEY = "wattscape.area";
const LOCALE_KEY = "wattscape.locale";

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

/** The language remembered in this browser, if storage works and holds a known one. */
export function savedLocale(storage: Pick<Storage, "getItem"> | undefined): Locale | undefined {
  try {
    const value = storage?.getItem(LOCALE_KEY);
    return isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function saveLocale(storage: Pick<Storage, "setItem"> | undefined, locale: Locale): void {
  try {
    storage?.setItem(LOCALE_KEY, locale);
  } catch {
    // Storage can be blocked (private mode, settings): the choice then lasts the visit.
  }
}

/** The earliest and latest instants `?at=` accepts (UTC). */
const AT_EARLIEST = Date.UTC(2000, 0, 1);
const AT_LATEST = Date.UTC(2100, 0, 1);

/**
 * `?at=2026-06-21T21:30Z` (ISO 8601, minutes or seconds, `Z` or an offset): the
 * instant the scene shows, for demos and screenshots; `undefined` when absent,
 * repeated, malformed or outside 2000–2099.
 */
export function atFromQuery(search: string): number | undefined {
  if (search.length > 2048) return undefined;
  const values = new URLSearchParams(search).getAll("at");
  if (values.length !== 1) return undefined;
  // Read field by field rather than by Date.parse, which rolls 30 February over to
  // March in some engines and rejects it in others.
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(
      values[0] ?? "",
    );
  if (m === null) return undefined;
  const [year, month, day, hour, minute, second, offsetHours, offsetMinutes] = [
    m[1],
    m[2],
    m[3],
    m[4],
    m[5],
    m[6] ?? "0",
    m[8] ?? "0",
    m[9] ?? "0",
  ].map(Number) as [number, number, number, number, number, number, number, number];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return undefined;
  if (hour > 23 || minute > 59 || second > 59 || offsetHours > 14 || offsetMinutes > 59)
    return undefined;
  const offset = (m[7] === "-" ? -1 : 1) * (offsetHours * 60 + offsetMinutes) * 60_000;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second) - offset;
  return ms >= AT_EARLIEST && ms < AT_LATEST ? ms : undefined;
}
