import { describe, expect, it } from "vitest";
import { fixedClock } from "../src/clock/clock";
import {
  areaFromQuery,
  atFromQuery,
  initialArea,
  initialPanelFolded,
  saveArea,
  savedArea,
  savedLocale,
  savedPanelFolded,
  saveLocale,
  savePanelFolded,
  sampleFromQuery,
} from "../src/ui/settings";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => {
      data.delete(k);
    },
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: (): void => {
    throw new Error("blocked");
  },
};

describe("areaFromQuery", () => {
  it("reads a region code or FR", () => {
    expect(areaFromQuery("?area=28")).toBe("28");
    expect(areaFromQuery("?area=FR&at=x")).toBe("FR");
  });

  it("ignores anything else", () => {
    for (const search of [
      "",
      "?area=",
      "?area=94",
      "?area=fr",
      "?area=28%20",
      "?area=<script>",
      "?area=28&area=53",
      `?area=28&pad=${"x".repeat(3000)}`,
    ]) {
      expect(areaFromQuery(search), search).toBeUndefined();
    }
  });
});

describe("saved area", () => {
  it("round-trips a code and stores nothing else", () => {
    const storage = memoryStorage();
    saveArea(storage, "53");
    expect(savedArea(storage)).toBe("53");
    expect(storage.length).toBe(1);
  });

  it("ignores a stored value that is not an area, and blocked storage", () => {
    expect(savedArea(memoryStorage({ "wattscape.area": "Paris" }))).toBeUndefined();
    expect(savedArea(throwing)).toBeUndefined();
    expect(savedArea(undefined)).toBeUndefined();
    expect(() => {
      saveArea(throwing, "28");
    }).not.toThrow();
  });
});

describe("saved language", () => {
  it("round-trips a locale and ignores anything else or blocked storage", () => {
    const storage = memoryStorage();
    saveLocale(storage, "en");
    expect(savedLocale(storage)).toBe("en");
    expect(savedLocale(memoryStorage({ "wattscape.locale": "de" }))).toBeUndefined();
    expect(savedLocale(throwing)).toBeUndefined();
    expect(savedLocale(undefined)).toBeUndefined();
    expect(() => {
      saveLocale(throwing, "fr");
    }).not.toThrow();
  });
});

describe("folded panel", () => {
  it("round-trips the choice and ignores anything else or blocked storage", () => {
    const storage = memoryStorage();
    savePanelFolded(storage, true);
    expect(savedPanelFolded(storage)).toBe(true);
    savePanelFolded(storage, false);
    expect(savedPanelFolded(storage)).toBe(false);
    expect(savedPanelFolded(memoryStorage({ "wattscape.panel": "yes" }))).toBeUndefined();
    expect(savedPanelFolded(throwing)).toBeUndefined();
    expect(savedPanelFolded(undefined)).toBeUndefined();
    expect(() => {
      savePanelFolded(throwing, true);
    }).not.toThrow();
  });

  it("opens folded on a narrow screen and open elsewhere, unless the viewer chose", () => {
    expect(initialPanelFolded(memoryStorage(), true)).toBe(true);
    expect(initialPanelFolded(memoryStorage(), false)).toBe(false);
    expect(initialPanelFolded(throwing, true)).toBe(true);
    expect(initialPanelFolded(memoryStorage({ "wattscape.panel": "open" }), true)).toBe(false);
    expect(initialPanelFolded(memoryStorage({ "wattscape.panel": "folded" }), false)).toBe(true);
  });
});

describe("initialArea", () => {
  it("prefers the URL, then the saved choice, then France", () => {
    const storage = memoryStorage({ "wattscape.area": "53" });
    expect(initialArea("?area=28", storage)).toBe("28");
    expect(initialArea("?area=bad", storage)).toBe("53");
    expect(initialArea("", memoryStorage())).toBe("FR");
    expect(initialArea("", throwing)).toBe("FR");
  });
});

describe("atFromQuery (?at=, the time the scene shows)", () => {
  it("reads an ISO 8601 instant in UTC or with an offset, to the minute or the second", () => {
    expect(atFromQuery("?at=2026-06-21T21:30Z")).toBe(Date.UTC(2026, 5, 21, 21, 30));
    expect(atFromQuery("?at=2026-06-21T21:30:15Z")).toBe(Date.UTC(2026, 5, 21, 21, 30, 15));
    // %2B is "+" in a URL; a bare "+" would read as a space.
    expect(atFromQuery("?at=2026-06-21T23:30%2B02:00")).toBe(Date.UTC(2026, 5, 21, 21, 30));
    expect(atFromQuery("?at=2026-06-21T18:30-03:00&area=28")).toBe(Date.UTC(2026, 5, 21, 21, 30));
    expect(atFromQuery("?at=2028-02-29T00:00Z")).toBe(Date.UTC(2028, 1, 29));
  });

  it("ignores a missing, repeated, malformed or impossible instant", () => {
    for (const search of [
      "",
      "?area=28",
      "?at=",
      "?at=2026-06-21T21:30Z&at=2026-06-21T21:30Z",
      "?at=2026-06-21",
      "?at=2026-06-21 21:30Z",
      "?at=2026-06-21T21:30", // no zone: the viewer's own would make it ambiguous
      "?at=2026-02-30T10:00Z", // rolled over to March by some engines, rejected by others
      "?at=2027-02-29T10:00Z",
      "?at=2026-13-01T10:00Z",
      "?at=2026-00-10T10:00Z",
      "?at=2026-06-21T24:00Z",
      "?at=2026-06-21T21:60Z",
      "?at=2026-06-21T21:30:60Z",
      "?at=2026-06-21T21:30+15:00",
      "?at=1999-12-31T23:59Z",
      "?at=2100-01-01T00:00Z",
      "?at=now",
      `?at=${"9".repeat(3000)}`,
    ])
      expect(atFromQuery(search), search).toBeUndefined();
  });

  it("gives a clock that stays on that instant", () => {
    const clock = fixedClock(Date.UTC(2026, 5, 21));
    expect(clock.now()).toBe(Date.UTC(2026, 5, 21));
    expect(clock.now()).toBe(clock.now());
  });
});

describe("sampleFromQuery (B-012)", () => {
  it("accepts day or night, once, and nothing else", () => {
    expect(sampleFromQuery("?sample=day")).toBe("day");
    expect(sampleFromQuery("?area=28&sample=night")).toBe("night");
    for (const bad of [
      "",
      "?sample=",
      "?sample=Day",
      "?sample=day&sample=day",
      "?sample=noon",
      `?sample=day&x=${"a".repeat(3000)}`,
    ])
      expect(sampleFromQuery(bad), bad).toBeUndefined();
  });
});
