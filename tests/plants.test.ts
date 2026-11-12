import { describe, expect, it } from "vitest";
import { recordedPlants } from "../e2e/reference-frames";
import {
  type Eco2mixReading,
  REGION_CODES,
  type RegionalReadings,
  SOURCES,
  STALE_AFTER_MS,
} from "../src/data/eco2mix";
import { FINE_ROWS_RLE } from "../src/map/france";
import { decodeRuns, FINE_COLUMNS, kindOfRegion, kmOf, SEA } from "../src/map/grid";
import { PLANT_SITES, type PlantSite } from "../src/map/plants";
import {
  drawBody,
  drawMotion,
  hasMotion,
  type Pen,
  SPRITES,
  spriteOf,
  turbineCount,
} from "../src/render/art/plants";
import { type ColourName } from "../src/render/palette";
import { activityOf, scenePlants } from "../src/scene/scene";
import { COOLING_TOWERS, MAX_SITES, MIN_MW } from "../tools/bake-plants-rules";

const site = (source: PlantSite["source"], extra: Partial<PlantSite> = {}): PlantSite => ({
  source,
  region: "28",
  x: 500,
  y: 200,
  mw: 100,
  towers: source === "nuclear",
  commune: "Test",
  exact: true,
  offshore: false,
  ...extra,
});

describe("the baked plants (DS-07, src/map/plants.ts)", () => {
  const kinds = decodeRuns(FINE_ROWS_RLE, FINE_COLUMNS);

  it("stand each on a 1 km cell of its own region, or at sea for an offshore farm", () => {
    for (const p of PLANT_SITES) {
      const kind = kinds[Math.floor(p.y) * FINE_COLUMNS + Math.floor(p.x)];
      expect(kind, `${p.commune} ${p.source}`).toBe(p.offshore ? SEA : kindOfRegion(p.region));
    }
  });

  it("place every nuclear site where it stands (BD TOPO, D-032), Paluel on the coast", () => {
    for (const p of PLANT_SITES.filter((s) => s.source === "nuclear"))
      expect(p.exact, p.commune).toBe(true);
    // Paluel's plant stands on the shore (49.858° N, 0.633° E on IGN's map, S-018),
    // 2 to 3 km from its town hall.
    const paluel = PLANT_SITES.find((p) => p.commune === "Paluel" && p.source === "nuclear");
    const shore = kmOf(49.858, 0.633);
    expect(Math.hypot((paluel?.x ?? 0) - shore.x, (paluel?.y ?? 0) - shore.y)).toBeLessThan(1.5);
    // More than half of the sites are placed by BD TOPO.
    expect(PLANT_SITES.filter((p) => p.exact).length).toBeGreaterThan(PLANT_SITES.length / 2);
  });

  it("hold the three offshore wind farms in service, at sea, Fécamp off its cliffs", () => {
    const farms = PLANT_SITES.filter((p) => p.offshore);
    expect(farms.map((p) => [p.region, p.mw]).sort()).toEqual([
      ["28", 497],
      ["52", 480],
      ["53", 496],
    ]);
    for (const p of farms) expect(p).toMatchObject({ source: "wind", exact: true, towers: false });
    // The Fécamp farm stands 13 to 22 km off the coast, north-west of the town.
    const fecamp = farms.find((p) => p.region === "28");
    const town = kmOf(49.757, 0.374);
    const d = Math.hypot((fecamp?.x ?? 0) - town.x, (fecamp?.y ?? 0) - town.y);
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(25);
    expect(fecamp?.y ?? 0).toBeLessThan(town.y); // north of the town
  });

  it("hold every nuclear site in service: 18 sites, 61 370 MW, Paluel and Penly in Normandie", () => {
    const nuclear = PLANT_SITES.filter((p) => p.source === "nuclear");
    expect(nuclear).toHaveLength(18);
    expect(nuclear.reduce((t, p) => t + p.mw, 0)).toBe(61_370);
    const paluel = nuclear.find((p) => p.commune === "Paluel");
    expect(paluel).toMatchObject({ region: "28", mw: 5320, towers: false });
    // Penly stands in Petit-Caux since the communes merged in 2016.
    expect(nuclear.find((p) => p.commune === "Petit-Caux")).toMatchObject({
      region: "28",
      mw: 2660,
    });
    expect(nuclear.find((p) => p.commune === "Cattenom")).toMatchObject({ towers: true });
  });

  it("keep towers for the listed sites only, and for nuclear only", () => {
    for (const p of PLANT_SITES)
      expect(p.towers, p.commune).toBe(
        p.source === "nuclear" && COOLING_TOWERS.includes(p.commune),
      );
    expect(PLANT_SITES.filter((p) => p.towers)).toHaveLength(COOLING_TOWERS.length);
  });

  it("keep at most the largest sites per region and technology, above the minimum", () => {
    for (const region of REGION_CODES)
      for (const source of SOURCES) {
        const list = PLANT_SITES.filter(
          (p) => p.region === region && p.source === source && !p.offshore,
        );
        if (source !== "nuclear") expect(list.length).toBeLessThanOrEqual(MAX_SITES);
        for (const p of list) expect(p.mw).toBeGreaterThanOrEqual(MIN_MW[source]);
      }
  });

  it("hold one site per technology and commune, with sane figures", () => {
    const keys = PLANT_SITES.map((p) => `${p.source}|${p.region}|${p.commune}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of PLANT_SITES) {
      expect(p.mw).toBeGreaterThan(0);
      expect(p.mw).toBeLessThan(6000);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe("activityOf and scenePlants (ARCHITECTURE § Data-to-scene mapping)", () => {
  const reading = (pct: number | null, timeMs = 0): Eco2mixReading =>
    ({
      area: "28",
      timeMs,
      loadFactorPct: {
        nuclear: pct,
        thermal: pct,
        wind: pct,
        solar: pct,
        hydro: pct,
        bioenergy: pct,
      },
    }) as unknown as Eco2mixReading;

  it("is the load factor over 100, clamped to 0–1, or null without a figure", () => {
    expect(activityOf(reading(62), "nuclear")).toBe(0.62);
    expect(activityOf(reading(0), "solar")).toBe(0);
    expect(activityOf(reading(125), "hydro")).toBe(1);
    expect(activityOf(reading(null), "nuclear")).toBeNull();
    expect(activityOf(undefined, "wind")).toBeNull();
    expect(activityOf(reading(Number.NaN), "wind")).toBeNull();
  });

  const readings = (r: Eco2mixReading): RegionalReadings => ({
    timeMs: r.timeMs,
    byRegion: { "28": r },
  });
  const sites = [site("nuclear"), site("wind", { region: "53" })];

  it("drives each plant by its own region, and leaves a region without a reading idle", () => {
    const plants = scenePlants(sites, readings(reading(50, 1000)), 1000);
    expect(plants.map((p) => p.activity)).toEqual([0.5, null]);
  });

  it("shows nothing for a step dated in the future, and still shows a stale one", () => {
    const now = 10 * STALE_AFTER_MS;
    expect(
      scenePlants(sites, readings(reading(50, now + 20 * 60_000)), now)[0]?.activity,
    ).toBeNull();
    expect(
      scenePlants(sites, readings(reading(50, now - 2 * STALE_AFTER_MS)), now)[0]?.activity,
    ).toBe(0.5);
    expect(scenePlants(sites, null, now).every((p) => p.activity === null)).toBe(true);
  });

  it("gives the recorded steps' figures: Normandie's nuclear at 62 %, no sun at night", () => {
    const day = recordedPlants(false);
    expect(day.find((p) => p.site.commune === "Paluel")?.activity).toBe(0.62);
    const night = recordedPlants(true);
    for (const p of night.filter((q) => q.site.source === "solar")) expect(p.activity).toBe(0);
    // Île-de-France has no nuclear figure and no nuclear site; every baked site has a figure.
    for (const p of day) expect(p.activity, p.site.commune).not.toBeNull();
  });
});

/** A pen that records what is drawn, as "x,y" → colour (or "lamp"). */
function recorder(emissive: boolean): Pen & { pixels: Map<string, string> } {
  const pixels = new Map<string, string>();
  return {
    emissive,
    pixels,
    put(x, y, colour: ColourName) {
      pixels.set(`${String(x)},${String(y)}`, colour);
    },
    glow(x, y) {
      pixels.set(`${String(x)},${String(y)}`, "lamp");
    },
  };
}

function motion(
  p: PlantSite,
  activity: number | null,
  seconds: number,
  size: "full" | "marker" = "full",
): Map<string, string> {
  const pen = recorder(false);
  drawMotion(pen, p, activity, 0, 0, size, seconds);
  return pen.pixels;
}

const ALL: PlantSite[] = [
  site("nuclear"),
  site("nuclear", { towers: false }),
  site("thermal"),
  site("wind"),
  site("solar"),
  site("hydro"),
  site("bioenergy"),
];
const TIMES = Array.from({ length: 40 }, (_, k) => k * 0.137);

describe("the source sprites (src/render/art/plants.ts)", () => {
  it("are rectangular pixel maps", () => {
    for (const [name, map] of Object.entries(SPRITES)) {
      expect(map.length, name).toBeGreaterThan(0);
      for (const row of map) expect(row.length, name).toBe(map[0]?.length);
    }
    expect(spriteOf(site("nuclear"))).toBe("nuclearTowers");
    expect(spriteOf(site("nuclear", { towers: false }))).toBe("nuclear");
  });

  it("draw nothing that moves when idle (no figure) or at 0, at any time", () => {
    for (const p of ALL)
      for (const t of TIMES) {
        expect(motion(p, null, t).size, p.source).toBe(0);
        expect(motion(p, 0, t).size, p.source).toBe(0);
      }
  });

  it("move when working: two times give two pictures (not a seaside nuclear plant)", () => {
    for (const p of ALL) {
      const frames = new Set(TIMES.map((t) => JSON.stringify([...motion(p, 0.8, t)])));
      if (p.source === "nuclear" && !p.towers) expect(frames.size).toBe(1);
      else expect(frames.size, p.source).toBeGreaterThan(1);
    }
  });

  it("say which plants move, so that the loop sleeps when none on screen does", () => {
    for (const p of ALL)
      for (const size of ["full", "marker"] as const) {
        const moves = TIMES.some((t) => motion(p, 1, t, size).size > 0);
        expect(hasMotion(p, size), `${p.source} ${String(p.towers)} ${size}`).toBe(moves);
      }
  });

  it("draw the same motion for the same time (pure)", () => {
    for (const p of ALL) expect([...motion(p, 0.5, 3.3)]).toEqual([...motion(p, 0.5, 3.3)]);
  });

  it("raise a taller plume from the cooling towers the harder the plant works", () => {
    const top = (a: number): number =>
      Math.min(
        ...TIMES.flatMap((t) =>
          [...motion(site("nuclear"), a, t).keys()].map((k) => Number(k.split(",")[1])),
        ),
      );
    expect(top(1)).toBeLessThan(top(0.5));
    expect(top(0.5)).toBeLessThan(top(0.1));
  });

  it("glint on more panels the stronger the sun", () => {
    const glints = (a: number): number =>
      TIMES.reduce((n, t) => n + motion(site("solar"), a, t).size, 0);
    expect(glints(0.1)).toBeLessThan(glints(0.5));
    expect(glints(0.5)).toBeLessThan(glints(1));
  });

  it("spill water in up to three streams, by the load factor", () => {
    const streams = (a: number): number =>
      new Set([...motion(site("hydro"), a, 1).keys()].map((k) => k.split(",")[0])).size;
    expect([0.2, 0.5, 1].map(streams)).toEqual([1, 2, 3]);
  });

  it("turn rotors no faster than half a turn a second (blades pass under 2 Hz)", () => {
    // At full load, a rotor shows the same picture again after a third of a turn: 2/3 s.
    const p = site("wind", { mw: 10 });
    const picture = (t: number): string[] => [...motion(p, 1, t).keys()].sort();
    expect(picture(0.2)).toEqual(picture(0.2 + 2 / 3));
    expect(picture(0.2)).not.toEqual(picture(0.3));
  });

  it("stand one, two or three turbines for a wind farm, by its capacity; five at sea", () => {
    expect([10, 29, 30, 59, 60, 300].map((mw) => turbineCount({ mw, offshore: false }))).toEqual([
      1, 1, 2, 2, 3, 3,
    ]);
    expect(turbineCount({ mw: 497, offshore: true })).toBe(5);
    expect(spriteOf(site("wind", { offshore: true }))).toBe("windOffshore");
  });

  it("light windows at night only, one by one with the activity", () => {
    const lamps = (a: number | null, emissive: boolean): number => {
      const pen = recorder(emissive);
      drawBody(pen, site("nuclear", { towers: false }), a, 0, 0, "full");
      return [...pen.pixels.values()].filter((c) => c === "lamp").length;
    };
    expect([null, 0, 0.3, 0.7, 1].map((a) => lamps(a, true))).toEqual([0, 0, 1, 2, 3]);
    expect(lamps(1, false)).toBe(0);
  });

  it("draw a body that does not depend on the time, and markers on the national view", () => {
    for (const p of ALL) {
      const pen = recorder(false);
      drawBody(pen, p, 0.5, 10, 10, "marker");
      expect(pen.pixels.size).toBe(7);
      expect([...pen.pixels.values()]).toContain(p.source);
    }
  });
});
