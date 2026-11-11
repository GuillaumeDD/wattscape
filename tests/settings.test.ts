import { describe, expect, it } from "vitest";
import {
  areaFromQuery,
  initialArea,
  saveArea,
  savedArea,
  savedLocale,
  saveLocale,
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

describe("initialArea", () => {
  it("prefers the URL, then the saved choice, then France", () => {
    const storage = memoryStorage({ "wattscape.area": "53" });
    expect(initialArea("?area=28", storage)).toBe("28");
    expect(initialArea("?area=bad", storage)).toBe("53");
    expect(initialArea("", memoryStorage())).toBe("FR");
    expect(initialArea("", throwing)).toBe("FR");
  });
});
