import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCATE_TIMEOUT_MS, locate, noteForLookup } from "../src/ui/area-picker";

/** A fake Geolocation answering with `outcome` when `answer()` is called. */
function fakeGeolocation(outcome: { latitude: number; longitude: number } | "denied") {
  let pending: (() => void) | undefined;
  let asked = 0;
  const geolocation = {
    getCurrentPosition(ok: PositionCallback, fail?: PositionErrorCallback | null): void {
      asked++;
      pending = () => {
        if (outcome === "denied") {
          fail?.({ code: 1, message: "denied" } as GeolocationPositionError);
        } else {
          ok({ coords: outcome, timestamp: 0 } as unknown as GeolocationPosition);
        }
      };
    },
  } as unknown as Geolocation;
  return {
    geolocation,
    answer: () => pending?.(),
    asked: () => asked,
  };
}

describe("locate", () => {
  it("turns a position into its region and keeps it only rounded to 0.1°", async () => {
    // Rouen cathedral, a landmark.
    const fake = fakeGeolocation({ latitude: 49.4402, longitude: 1.0948 });
    const pending = locate(fake.geolocation, () => true);
    fake.answer();
    const result = await pending;
    expect(result?.area).toBe("28");
    expect(result?.note).toBe("locationFound");
    expect(result?.position).toEqual({ latitude: 49.4, longitude: 1.1 });
    expect(result?.save).toBe(true);
    expect(fake.asked()).toBe(1);
  });

  it("keeps the current area on refusal", async () => {
    const fake = fakeGeolocation("denied");
    const pending = locate(fake.geolocation, () => true);
    fake.answer();
    expect(await pending).toEqual({
      area: null,
      position: null,
      note: "locationRefused",
      save: false,
    });
  });

  it("shows France abroad or in Corsica, without forgetting the remembered region", async () => {
    for (const [outcome, note] of [
      [{ latitude: 51.51, longitude: -0.13 }, "locationAbroad"],
      [{ latitude: 42.15, longitude: 9.1 }, "locationCorsica"],
    ] as const) {
      const fake = fakeGeolocation(outcome);
      const pending = locate(fake.geolocation, () => true);
      fake.answer();
      expect(await pending).toEqual({ area: "FR", position: null, note, save: false });
    }
  });

  it("drops a late answer when the viewer picked an area meanwhile", async () => {
    for (const outcome of [{ latitude: 49.44, longitude: 1.09 }, "denied"] as const) {
      const fake = fakeGeolocation(outcome);
      let current = true;
      const pending = locate(fake.geolocation, () => current);
      current = false;
      fake.answer();
      expect(await pending).toBeNull();
    }
  });

  it("works without the Geolocation API", async () => {
    expect(await locate(undefined, () => true)).toEqual({
      area: null,
      position: null,
      note: "locationUnavailable",
      save: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives up when the prompt is never answered", async () => {
    vi.useFakeTimers();
    const fake = fakeGeolocation({ latitude: 49.44, longitude: 1.09 });
    const pending = locate(fake.geolocation, () => true);
    await vi.advanceTimersByTimeAsync(LOCATE_TIMEOUT_MS);
    expect(await pending).toEqual({
      area: null,
      position: null,
      note: "locationUnavailable",
      save: false,
    });
    // A very late answer changes nothing.
    fake.answer();
  });
});

describe("noteForLookup", () => {
  it("has a message for every outcome", () => {
    expect(noteForLookup("region")).toBe("locationFound");
    expect(noteForLookup("abroad")).toBe("locationAbroad");
    expect(noteForLookup("corsica")).toBe("locationCorsica");
    expect(noteForLookup("invalid")).toBe("locationUnavailable");
  });
});
