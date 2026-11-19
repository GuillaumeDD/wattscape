/**
 * The weather as each theme draws it (B-018, D-064): what the weather must never
 * hide, the towns' lamps, which show the consumption (ARCHITECTURE § Sky, light and
 * weather).
 */
import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH, referenceScene } from "../e2e/reference-frames";
import { coarseLayer } from "../src/map/layers";
import { drawModernScene } from "../src/render/modern-theme";
import { PALETTE } from "../src/render/palette";
import { drawPixelScene } from "../src/render/pixel-theme";
import { createSurface, type Surface } from "../src/render/surface";
import { areaBox, fitBox } from "../src/scene/camera";
import { type RegionalWeather, overrideWeather } from "../src/scene/weather";

const T = Date.UTC(2026, 10, 12, 1, 0);
const normandie = fitBox(areaBox(coarseLayer(), "28"), FRAME_WIDTH, FRAME_HEIGHT);

function night(weather: RegionalWeather, theme: "pixel" | "modern"): Surface {
  const scene = { ...referenceScene("28", normandie, -20), weather, timeMs: T };
  const density = theme === "pixel" ? 1 : 2;
  const out = createSurface(FRAME_WIDTH * density, FRAME_HEIGHT * density);
  (theme === "pixel" ? drawPixelScene : drawModernScene)(scene, out);
  return out;
}

describe("the weather over the towns' lamps", () => {
  it("leaves every lit window of pixel art lit, under clouds, shadows and fog", () => {
    const [r, g, b] = PALETTE.lamp;
    for (const group of ["storm", "fog"] as const) {
      const clear = night({}, "pixel");
      const under = night(overrideWeather(group, T), "pixel");
      let lamps = 0;
      for (let i = 0; i < clear.data.length; i += 4) {
        if (clear.data[i] !== r || clear.data[i + 1] !== g || clear.data[i + 2] !== b) continue;
        lamps++;
        expect([under.data[i], under.data[i + 1], under.data[i + 2]]).toEqual([r, g, b]);
      }
      expect(lamps).toBeGreaterThan(50);
    }
  });

  it("lets the towns' glow of the modern theme through an overcast storm", () => {
    const clear = night({}, "modern");
    const under = night(overrideWeather("storm", T), "modern");
    // The town glow: the warmest pixels of the clear night (red well over blue).
    let glow = 0;
    let kept = 0;
    for (let i = 0; i < clear.data.length; i += 4) {
      const warm = (clear.data[i] ?? 0) - (clear.data[i + 2] ?? 0);
      if (warm < 60) continue;
      glow += warm;
      kept += Math.max(0, (under.data[i] ?? 0) - (under.data[i + 2] ?? 0));
    }
    expect(glow).toBeGreaterThan(0);
    expect(kept / glow).toBeGreaterThan(0.6);
  });
});
