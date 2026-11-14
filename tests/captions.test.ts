import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH, recordedPlants } from "../e2e/reference-frames";
import { REGION_CODES } from "../src/data/eco2mix";
import { LOCALES } from "../src/i18n";
import { kmOf } from "../src/map/grid";
import { LANDMARK_CAPTIONS } from "../src/map/landmark-captions";
import { LANDMARKS } from "../src/map/landmarks";
import { PLANT_SITES } from "../src/map/plants";
import { coarseLayer, fineLayer } from "../src/map/layers";
import { FINE_ELEVATION_RLE } from "../src/map/relief";
import { LESSER_RIVERS_PACKED } from "../src/map/rivers-fine";
import { landmarkBox, LANDMARK_SPRITES } from "../src/render/art/landmarks";
import { drawPixelScene, plantMarkId, SPRITES_FROM_SCALE } from "../src/render/pixel-theme";
import { createSurface } from "../src/render/surface";
import { type Mark } from "../src/render/theme";
import { type Camera } from "../src/scene/camera";
import { type Scene, type ScenePlant } from "../src/scene/scene";
import { lightAt } from "../src/sky/light";
import { captionPosition, captionText, markAt } from "../src/ui/captions";
import { mulberry32 } from "./random";

/** The `S-` ids docs/SOURCES.md logs, each once, in bold. */
function loggedSources(): Set<string> {
  const text = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
  return new Set([...text.matchAll(/\*\*(S-\d{3})\*\*/g)].map((m) => m[1] ?? ""));
}

describe("the landmarks' captions (src/map/landmark-captions.ts)", () => {
  it("cover every landmark drawn, and only those", () => {
    expect(Object.keys(LANDMARK_CAPTIONS).sort()).toEqual(LANDMARKS.map((l) => l.id).sort());
  });

  it("have a name and a short line in every language, as plain text", () => {
    for (const [id, c] of Object.entries(LANDMARK_CAPTIONS)) {
      expect(c.name.trim(), id).not.toBe("");
      for (const locale of LOCALES) {
        const line = c[locale];
        expect(line.trim(), `${id} ${locale}`).not.toBe("");
        // Two lines of the caption's box at most.
        expect(line.length, `${id} ${locale}`).toBeLessThanOrEqual(110);
        expect(line, `${id} ${locale}`).not.toMatch(/[<>]/);
      }
    }
  });

  it("cite sources that docs/SOURCES.md logs", () => {
    const logged = loggedSources();
    for (const [id, c] of Object.entries(LANDMARK_CAPTIONS)) {
      expect(c.sources.length, id).toBeGreaterThan(0);
      for (const s of c.sources) expect(logged.has(s), `${id} ${s}`).toBe(true);
    }
  });

  it("are provisional only where the PR says so", () => {
    // AGENTS.md § 5: a fact without a source is marked, and listed for Guillaume.
    const provisional = Object.entries(LANDMARK_CAPTIONS)
      .filter(([, c]) => c.provisional === true)
      .map(([id]) => id);
    expect(provisional).toEqual(["P-012"]);
  });

  it("are read by mark, in the viewer's language", () => {
    expect(captionText({ kind: "landmark", id: "P-008" }, "fr", String)?.name).toBe("Tour Eiffel");
    expect(captionText({ kind: "landmark", id: "P-008" }, "en", String)?.line).toContain("1889");
    expect(captionText({ kind: "landmark", id: "P-999" }, "fr", String)).toBeNull();
  });
});

describe("the plants' captions (B-020)", () => {
  const day = recordedPlants(false);
  const paluel = day.find((p) => p.site.commune === "Paluel" && p.site.source === "nuclear");
  if (paluel === undefined) throw new Error("no Paluel");
  const plant = (p: ScenePlant) => ({ kind: "plant" as const, plant: p });
  const time = (ms: number): string => `T${String(ms)}`;

  it("say what and where, the installed capacity, and the region's figure with its time", () => {
    const fr = captionText(plant(paluel), "fr", time);
    expect(fr?.name).toBe("Nucléaire · Paluel");
    expect(fr?.line).toContain(
      `${new Intl.NumberFormat("fr").format(paluel.site.mw)} MW installés`,
    );
    expect(fr?.line).toContain("Normandie : 62 %");
    expect(fr?.line).toContain(`T${String(paluel.figure?.timeMs)}`);
    const en = captionText(plant(paluel), "en", time);
    expect(en?.name).toBe("Nuclear · Paluel");
    expect(en?.line).toContain("Normandie: 62%");
  });

  it("show the figure as éCO2mix gives it, over 100 % too, never the clamped activity", () => {
    const over = { ...paluel, activity: 1, figure: { loadFactorPct: 117.4, timeMs: 0 } };
    expect(captionText(plant(over), "fr", time)?.line).toContain(": 117 %");
  });

  it("say why there is no figure: no reading, or none for this technology", () => {
    const none = { ...paluel, activity: null, figure: null };
    expect(captionText(plant(none), "fr", time)?.line).toContain("Pas de relevé RTE éCO2mix");
    const noLoad = { ...paluel, activity: null, figure: { loadFactorPct: null, timeMs: 0 } };
    expect(captionText(plant(noLoad), "en", time)?.line).toContain("gives no load factor");
  });

  it("give a diffuse site's capacity as its commune's, but not an offshore farm's", () => {
    const solar = day.find((p) => p.site.source === "solar");
    const offshore = day.find((p) => p.site.offshore);
    if (solar === undefined || offshore === undefined) throw new Error("no site");
    expect(captionText(plant(solar), "fr", time)?.line).toContain("installés dans la commune");
    expect(captionText(plant(offshore), "fr", time)?.line).not.toContain("commune");
    expect(captionText(plant(offshore), "fr", time)?.name).toBe(
      `Éolien · ${offshore.site.commune}`,
    );
  });

  it("are tied to marks whose ids are unique among the baked plants", () => {
    const ids = PLANT_SITES.map(plantMarkId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

const box = (id: string, left: number, top: number, right: number, bottom: number): Mark => ({
  kind: "landmark",
  id,
  left,
  top,
  right,
  bottom,
});

describe("markAt", () => {
  const marks = [box("a", 10, 10, 20, 30), box("b", 15, 20, 25, 40)];

  it("finds the mark under a point, the one drawn last where two overlap", () => {
    expect(markAt(marks, 12, 12, 0)?.id).toBe("a");
    expect(markAt(marks, 17, 25, 0)?.id).toBe("b");
    expect(markAt(marks, 22, 35, 0)?.id).toBe("b");
  });

  it("includes the box's left and top edges, not its right and bottom ones", () => {
    expect(markAt(marks, 10, 10, 0)?.id).toBe("a");
    expect(markAt(marks, 25, 39, 0)).toBeNull();
    expect(markAt(marks, 24, 40, 0)).toBeNull();
  });

  it("reaches as far around the box as the slack says, and no farther", () => {
    expect(markAt(marks, 8, 12, 0)).toBeNull();
    expect(markAt(marks, 8, 12, 2)?.id).toBe("a");
    expect(markAt(marks, 7, 12, 2)).toBeNull();
  });

  it("finds nothing at a point that is not a number, or with no marks", () => {
    expect(markAt(marks, Number.NaN, Number.NaN, 4)).toBeNull();
    expect(markAt([], 12, 12, 4)).toBeNull();
  });
});

describe("captionPosition", () => {
  it("centres the caption above its mark when there is room", () => {
    expect(
      captionPosition({ left: 400, top: 300, right: 420, bottom: 330 }, 200, 50, 1280, 720),
    ).toEqual({ left: 310, top: 242 });
  });

  it("puts it below its mark near the top of the window", () => {
    expect(
      captionPosition({ left: 400, top: 30, right: 420, bottom: 60 }, 200, 50, 1280, 720),
    ).toEqual({ left: 310, top: 68 });
  });

  it("keeps it inside the window, by the sides and at the bottom", () => {
    expect(
      captionPosition({ left: 0, top: 30, right: 10, bottom: 60 }, 200, 50, 1280, 720).left,
    ).toBe(8);
    expect(
      captionPosition({ left: 1270, top: 30, right: 1280, bottom: 60 }, 200, 50, 1280, 720).left,
    ).toBe(1072);
    expect(
      captionPosition({ left: 100, top: 20, right: 110, bottom: 700 }, 200, 50, 1280, 720).top,
    ).toBe(662);
  });

  it("stays inside any window it fits in, for random marks (randomized)", () => {
    const random = mulberry32(52);
    for (let i = 0; i < 2000; i++) {
      const ww = 300 + random() * 1600;
      const wh = 300 + random() * 900;
      const w = 50 + random() * (ww - 66);
      const h = 20 + random() * (wh / 2 - 36);
      const left = random() * ww;
      const top = random() * wh;
      const mark = { left, top, right: left + random() * 30, bottom: top + random() * 40 };
      const at = captionPosition(mark, w, h, ww, wh);
      expect(at.left).toBeGreaterThanOrEqual(7.5);
      expect(at.left + w).toBeLessThanOrEqual(ww - 7.5);
      expect(at.top).toBeGreaterThanOrEqual(7.5);
      expect(at.top + h).toBeLessThanOrEqual(wh - 7.5);
    }
  });
});

describe("the marks of a frame (src/render/pixel-theme.ts)", () => {
  const coarse = coarseLayer();
  const fine = fineLayer(FINE_ELEVATION_RLE, LESSER_RIVERS_PACKED);
  const sceneAt = (camera: Camera, detail: number): Scene => ({
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    camera,
    light: lightAt(35),
    focus: "28",
    coarse,
    fine,
    detail,
    towns: [],
    plants: [],
    townLights: Object.fromEntries(REGION_CODES.map((r) => [r, 0.5])),
    landmarks: LANDMARKS,
  });
  const marksOf = (scene: Scene): readonly Mark[] =>
    drawPixelScene(scene, createSurface(scene.width, scene.height)).marks;
  const near = { ...kmOf(49.6, 0.6), scale: 2 };

  it("name the landmarks drawn at a region's scale, with their sprite's box", () => {
    for (const detail of [0, 8, 16]) {
      const marks = marksOf(sceneAt(near, detail));
      const ids = marks.map((m) => m.id);
      // Étretat, Port 2000 and Fécamp stand in this view of the Seine-Maritime coast.
      for (const id of ["P-001", "P-002", "P-005"])
        expect(ids, `${id} ${String(detail)}`).toContain(id);
      for (const m of marks) {
        const l = LANDMARKS.find((x) => x.id === m.id);
        if (l === undefined) throw new Error(m.id);
        const sprite = LANDMARK_SPRITES[l.sprite];
        expect(m.bottom - m.top, m.id).toBe(sprite.length);
        expect(m.right - m.left, m.id).toBe(sprite[0]?.length);
        const anchored = landmarkBox(l, Math.floor((m.left + m.right) / 2), m.bottom - 1);
        expect(anchored.top, m.id).toBe(m.top);
      }
    }
  });

  it("are none on the national view, where no landmark is drawn", () => {
    expect(marksOf(sceneAt({ ...near, scale: SPRITES_FROM_SCALE / 2 }, 0))).toEqual([]);
  });

  it("name the plants drawn, as sprites or as the national view's markers", () => {
    const plants = recordedPlants(false);
    for (const scale of [SPRITES_FROM_SCALE / 2, 2]) {
      const marks = marksOf({ ...sceneAt({ ...near, scale }, 16), plants });
      const shown = marks.filter((m) => m.kind === "plant");
      expect(shown.length, String(scale)).toBeGreaterThan(0);
      for (const m of shown) {
        expect(m.id).toBe(plantMarkId(m.plant.site));
        expect(plants).toContain(m.plant);
      }
      // In front comes last: the marks run down the frame.
      for (let i = 1; i < marks.length; i++)
        expect(marks[i]?.bottom ?? 0).toBeGreaterThanOrEqual(marks[i - 1]?.bottom ?? 0);
    }
  });
});
