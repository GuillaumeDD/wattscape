import { describe, expect, it } from "vitest";
import { fixedClock } from "../src/clock/clock";
import {
  areaFromQuery,
  driftFromQuery,
  initialDriftOn,
  initialWeatherOn,
  saveDriftOn,
  savedDriftOn,
  savedWeatherOn,
  saveWeatherOn,
  weatherFromQuery,
  weatherSwitchFromQuery,
  atFromQuery,
  initialArea,
  initialLegendFolded,
  initialPanelFolded,
  initialTheme,
  saveArea,
  savedArea,
  savedLocale,
  savedLegendFolded,
  savedPanelFolded,
  savedTheme,
  saveLocale,
  saveLegendFolded,
  savePanelFolded,
  saveTheme,
  sampleFromQuery,
  screensaverFromQuery,
  seasonFromQuery,
  themeFromQuery,
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

describe("folded legend", () => {
  it("round-trips the choice, apart from the panel's, and ignores anything else", () => {
    const storage = memoryStorage();
    saveLegendFolded(storage, true);
    expect(savedLegendFolded(storage)).toBe(true);
    expect(savedPanelFolded(storage)).toBeUndefined();
    saveLegendFolded(storage, false);
    expect(savedLegendFolded(storage)).toBe(false);
    expect(savedLegendFolded(memoryStorage({ "wattscape.legend": "yes" }))).toBeUndefined();
    expect(savedLegendFolded(throwing)).toBeUndefined();
    expect(() => {
      saveLegendFolded(throwing, true);
    }).not.toThrow();
  });

  it("opens folded on a narrow screen and open elsewhere, unless the viewer chose", () => {
    expect(initialLegendFolded(memoryStorage(), true)).toBe(true);
    expect(initialLegendFolded(memoryStorage(), false)).toBe(false);
    expect(initialLegendFolded(memoryStorage({ "wattscape.legend": "open" }), true)).toBe(false);
    expect(initialLegendFolded(memoryStorage({ "wattscape.legend": "folded" }), false)).toBe(true);
    // The panel's choice is its own.
    expect(initialLegendFolded(memoryStorage({ "wattscape.panel": "folded" }), false)).toBe(false);
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

describe("screensaverFromQuery (?screensaver, B-021)", () => {
  it("opens the screensaver mode with ?screensaver or ?screensaver=1, once", () => {
    expect(screensaverFromQuery("?screensaver")).toBe(true);
    expect(screensaverFromQuery("?area=28&screensaver=1")).toBe(true);
    for (const bad of [
      "",
      "?screensaver=0",
      "?screensaver=yes",
      "?screensaver&screensaver",
      "?Screensaver",
      `?screensaver&x=${"a".repeat(3000)}`,
    ])
      expect(screensaverFromQuery(bad), bad).toBe(false);
  });
});

describe("seasonFromQuery (?season=, B-021)", () => {
  it("accepts one of the four seasons, once, and nothing else", () => {
    expect(seasonFromQuery("?season=winter")).toBe("winter");
    expect(seasonFromQuery("?area=84&season=autumn")).toBe("autumn");
    for (const bad of [
      "",
      "?season=",
      "?season=Winter",
      "?season=hiver",
      "?season=winter&season=winter",
      "?season=__proto__",
      `?season=summer&x=${"a".repeat(3000)}`,
    ])
      expect(seasonFromQuery(bad), bad).toBeUndefined();
  });
});

describe("theme (?theme=, G-011)", () => {
  it("reads a known theme, once, and nothing else", () => {
    expect(themeFromQuery("?theme=modern")).toBe("modern");
    expect(themeFromQuery("?area=28&theme=pixel")).toBe("pixel");
    for (const bad of [
      "",
      "?theme=",
      "?theme=Modern",
      "?theme=modern%20",
      "?theme=modern&theme=modern",
      "?theme=<script>",
      "?theme=__proto__",
      `?theme=modern&x=${"a".repeat(3000)}`,
    ])
      expect(themeFromQuery(bad), bad).toBeUndefined();
  });

  it("remembers a known theme only, and survives a blocked storage", () => {
    const storage = memoryStorage();
    expect(savedTheme(storage)).toBeUndefined();
    saveTheme(storage, "modern");
    expect(savedTheme(storage)).toBe("modern");
    expect(savedTheme(memoryStorage({ "wattscape.theme": "neon" }))).toBeUndefined();
    expect(savedTheme(throwing)).toBeUndefined();
    expect(savedTheme(undefined)).toBeUndefined();
    expect(() => {
      saveTheme(throwing, "modern");
    }).not.toThrow();
  });

  it("opens with the URL's theme, then the remembered one, then the modern theme", () => {
    const remembered = memoryStorage({ "wattscape.theme": "modern" });
    expect(initialTheme("?theme=pixel", remembered)).toBe("pixel");
    expect(initialTheme("", remembered)).toBe("modern");
    expect(initialTheme("?theme=neon", remembered)).toBe("modern");
    expect(initialTheme("", memoryStorage())).toBe("modern");
    expect(initialTheme("", throwing)).toBe("modern");
    expect(initialTheme("?theme=neon", memoryStorage())).toBe("modern");
  });

  it("keeps a stored pixel-art choice over the modern default (D-079)", () => {
    const pixel = memoryStorage({ "wattscape.theme": "pixel" });
    expect(initialTheme("", pixel)).toBe("pixel");
    expect(initialTheme("?theme=neon", pixel)).toBe("pixel");
    expect(initialTheme("?theme=modern", pixel)).toBe("modern");
  });
});

describe("weather switch (?weather=off, B-030)", () => {
  it("reads on and off, and leaves a weather group to the override", () => {
    expect(weatherSwitchFromQuery("?weather=off")).toBe(false);
    expect(weatherSwitchFromQuery("?weather=on")).toBe(true);
    expect(weatherSwitchFromQuery("?weather=rain")).toBeUndefined();
    // "off" is not a group: it imposes no weather.
    expect(weatherFromQuery("?weather=off")).toBeUndefined();
  });

  it("ignores anything else", () => {
    for (const search of [
      "",
      "?weather=",
      "?weather=OFF",
      "?weather=false",
      "?weather=off&weather=off",
      `?weather=off&pad=${"x".repeat(3000)}`,
    ])
      expect(weatherSwitchFromQuery(search), search).toBeUndefined();
  });

  it("round-trips the choice and stores nothing else", () => {
    const storage = memoryStorage();
    saveWeatherOn(storage, false);
    expect(savedWeatherOn(storage)).toBe(false);
    saveWeatherOn(storage, true);
    expect(savedWeatherOn(storage)).toBe(true);
    expect(storage.length).toBe(1);
  });

  it("ignores a stored value that is not on or off, and blocked storage", () => {
    expect(savedWeatherOn(memoryStorage({ "wattscape.weather": "maybe" }))).toBeUndefined();
    expect(savedWeatherOn(throwing)).toBeUndefined();
    expect(() => {
      saveWeatherOn(throwing, false);
    }).not.toThrow();
  });

  it("opens with the URL, then the remembered choice, then on; an override shows", () => {
    const off = memoryStorage({ "wattscape.weather": "off" });
    expect(initialWeatherOn("", undefined)).toBe(true);
    expect(initialWeatherOn("", off)).toBe(false);
    expect(initialWeatherOn("?weather=on", off)).toBe(true);
    expect(initialWeatherOn("?weather=off", memoryStorage())).toBe(false);
    // The weather imposed for a demo is asked for: it shows over a remembered "off".
    expect(initialWeatherOn("?weather=snow", off)).toBe(true);
  });
});

describe("drift switch (?drift=off, B-036)", () => {
  it("reads on and off, and ignores anything else", () => {
    expect(driftFromQuery("?drift=off")).toBe(false);
    expect(driftFromQuery("?drift=on&area=28")).toBe(true);
    for (const search of ["", "?drift=", "?drift=0", "?drift=off&drift=on"])
      expect(driftFromQuery(search), search).toBeUndefined();
  });

  it("round-trips the choice, and survives blocked storage", () => {
    const storage = memoryStorage();
    saveDriftOn(storage, false);
    expect(savedDriftOn(storage)).toBe(false);
    expect(storage.length).toBe(1);
    expect(savedDriftOn(memoryStorage({ "wattscape.drift": "yes" }))).toBeUndefined();
    expect(savedDriftOn(throwing)).toBeUndefined();
    expect(() => {
      saveDriftOn(throwing, true);
    }).not.toThrow();
  });

  it("opens with the URL, then the remembered choice, then on", () => {
    const off = memoryStorage({ "wattscape.drift": "off" });
    expect(initialDriftOn("", undefined)).toBe(true);
    expect(initialDriftOn("", off)).toBe(false);
    expect(initialDriftOn("?drift=on", off)).toBe(true);
    expect(initialDriftOn("?drift=off", undefined)).toBe(false);
  });
});
