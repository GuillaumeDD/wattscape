import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH } from "../e2e/reference-frames";
import { REGION_CODES } from "../src/data/eco2mix";
import { FINE_COLUMNS, FINE_ROWS, FOREIGN, kmOf, SEA } from "../src/map/grid";
import { coarseLayer, fineLayer, greatRivers, type TerrainLayer } from "../src/map/layers";
import { FINE_ELEVATION_RLE } from "../src/map/relief";
import { LESSER_RIVERS_PACKED } from "../src/map/rivers-fine";
import {
  GREAT_RIVER_REACH,
  packRiver,
  type River,
  RIVER_UNITS_PER_KM,
  riverCells,
  unpackRiver,
  walkLine,
} from "../src/map/river-lines";
import { GREAT_RIVERS_PACKED } from "../src/map/rivers";
import { PALETTE } from "../src/render/palette";
import { drawPixelScene } from "../src/render/pixel-theme";
import { createSurface } from "../src/render/surface";
import { type Scene } from "../src/scene/scene";
import { lightAt } from "../src/sky/light";
import {
  footprint,
  isCanal,
  joinStretches,
  MIN_RIVER_REACH,
  type Point,
  riverName,
  thin,
  TOLERANCE_KM,
} from "../tools/bake-rivers-rules";
import { mulberry32 } from "./random";

const riverOf = (lines: number[][], name = "la Test", reach = 120): River => ({
  name,
  reach,
  lines: lines.map((l) => Int32Array.from(l)),
});

describe("the packed rivers (src/map/river-lines.ts)", () => {
  it("packs a river as its name, its reach and its lines, steps after the first point", () => {
    const river = riverOf([
      [5961, 2573, 5964, 2571, 5964, 2580],
      [10, 20, 0, 25],
    ]);
    expect(packRiver(river)).toBe("la Test|120|5961 2573 3 -2 0 9;10 20 -10 5");
  });

  it("unpacks what it packed (randomized)", () => {
    const random = mulberry32(23);
    for (let n = 0; n < 200; n++) {
      const lines = Array.from({ length: 1 + Math.floor(random() * 4) }, () =>
        Array.from({ length: 2 * (2 + Math.floor(random() * 30)) }, () =>
          Math.floor(random() * 12000 - 500),
        ),
      );
      const river = riverOf(lines, `la Rivière ${String(n)}`, Math.floor(random() * 1100));
      const back = unpackRiver(packRiver(river));
      expect(back.name).toBe(river.name);
      expect(back.reach).toBe(river.reach);
      expect(back.lines.map((l) => [...l])).toEqual(lines);
    }
  });

  it("refuses a name that would break the packing, and a malformed entry", () => {
    expect(() => packRiver(riverOf([[0, 0, 1, 1]], "a|b"))).toThrow();
    expect(() => packRiver(riverOf([[0, 0, 1, 1]], "a;b"))).toThrow();
    for (const bad of [
      "",
      "la Test",
      "la Test|120",
      "la Test|12.5|0 0 1 1",
      "la Test|120|0 0 1",
      "la Test|120|0 0",
      "la Test|120|0 0 1 x",
      "la Test|120|0 0 1 1;",
      "la Test|120|0 0 1 1|more",
    ])
      expect(() => unpackRiver(bad), bad).toThrow();
  });
});

describe("the cells a river crosses (riverCells)", () => {
  const cellsOf = (cells: Uint8Array, columns: number): [number, number][] =>
    [...cells].flatMap((v, i): [number, number][] =>
      v === 1 ? [[i % columns, Math.floor(i / columns)]] : [],
    );

  it("marks the cells of both ends and an unbroken chain between them (randomized)", () => {
    const random = mulberry32(5);
    const columns = 60;
    const rows = 50;
    for (let n = 0; n < 300; n++) {
      const km = random() < 0.5 ? 1 : 4;
      const unit = km * RIVER_UNITS_PER_KM;
      const point = (): number[] => [
        Math.floor(random() * columns * unit),
        Math.floor(random() * rows * unit),
      ];
      const [a, b] = [point(), point()];
      const [ax = 0, ay = 0] = a;
      const [bx = 0, by = 0] = b;
      const cells = riverCells([riverOf([[ax, ay, bx, by]])], km, columns, rows);
      const marked = cellsOf(cells, columns);
      const start: [number, number] = [Math.floor(ax / unit), Math.floor(ay / unit)];
      const end: [number, number] = [Math.floor(bx / unit), Math.floor(by / unit)];
      expect(cells[start[1] * columns + start[0]]).toBe(1);
      expect(cells[end[1] * columns + end[0]]).toBe(1);
      // As many cells as the longer side of the walk, plus one: no gap, no blot.
      expect(marked).toHaveLength(
        Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1])) + 1,
      );
      // A naive reference: every cell lies within a cell of the straight line between
      // the two end cells' centres.
      for (const [c, r] of marked) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const length2 = dx * dx + dy * dy;
        const t = length2 === 0 ? 0 : ((c - start[0]) * dx + (r - start[1]) * dy) / length2;
        const off = Math.hypot(c - (start[0] + t * dx), r - (start[1] + t * dy));
        expect(off).toBeLessThanOrEqual(1);
      }
    }
  });

  it("skips what falls off the grid, and marks nothing for no river", () => {
    expect(riverCells([], 1, 8, 8).some((v) => v !== 0)).toBe(false);
    const cells = riverCells([riverOf([[-50, 35, 130, 35]])], 1, 8, 8);
    expect(cellsOf(cells, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c, 3]));
  });
});

describe("the bake's rules (tools/bake-rivers-rules.ts)", () => {
  it("tells a canal or an aqueduct by its name", () => {
    for (const name of [
      "Canal du Midi",
      "canal latéral à la Loire",
      "Rigole de la Plaine",
      "Ancien Canal du Verdon",
      "Grand Canal d'Alsace",
      "le Canal de Briare",
      "Aqueduc de la Vanne",
      "Dérivation de la Dhuis",
    ])
      expect(isCanal(name), name).toBe(true);
    for (const name of ["la Loire", "le Canalet", "la Somme Canalisée", "l'Ancienne Seine"])
      expect(isCanal(name), name).toBe(false);
  });

  it("names a river without the kind written around it", () => {
    expect(riverName("Fleuve la Loire")).toBe("la Loire");
    expect(riverName("Rivière l'Allier")).toBe("l'Allier");
    expect(riverName("la Moselle Canalisée")).toBe("la Moselle");
    expect(riverName("la Somme Rivière")).toBe("la Somme");
    expect(riverName("Rivière le Rhins")).toBe("le Rhins");
    // The kind is the name itself: kept.
    expect(riverName("Rivière Langouette")).toBe("Rivière Langouette");
    expect(riverName("Rivière Aa")).toBe("Rivière Aa");
    expect(riverName("la Rivière Morte")).toBe("la Rivière Morte");
    expect(riverName("Gave de Pau")).toBe("Gave de Pau");
  });

  const line = (...numbers: number[]): Int32Array => Int32Array.from(numbers);

  it("joins the stretches of one river that touch, and no others", () => {
    const joined = joinStretches([
      { name: "la Loire", lines: [line(0, 5, 300, 5)] },
      { name: "la Seille", lines: [line(0, 905, 200, 905)] },
      // Follows the first Loire from the next cell; overlaps nothing.
      { name: "Fleuve la Loire", lines: [line(305, 15, 600, 15)] },
      // The same name, 50 km away: another river.
      { name: "la Seille", lines: [line(0, 1405, 200, 1405)] },
      // Touches the Loire, under another name.
      { name: "l'Allier", lines: [line(100, 5, 100, 400)] },
      // Joins the chain by its far end only.
      { name: "la Loire", lines: [line(605, 25, 900, 25), line(700, 25, 700, 90)] },
    ]);
    expect(joined.map((r) => [r.name, r.lines.length])).toEqual([
      ["la Loire", 4],
      ["la Seille", 1],
      ["la Seille", 1],
      ["l'Allier", 1],
    ]);
    expect(joinStretches([])).toEqual([]);
  });

  it("keeps of a river the lines that cross a cell of their own, longest first", () => {
    const main = line(5, 5, 505, 5);
    const arm = line(100, 8, 200, 8); // within the main course's cells
    const fork = line(300, 5, 300, 95); // leaves it: 9 cells of its own
    const twin = line(5, 5, 505, 5);
    const { lines, reach } = footprint([arm, fork, main, twin]);
    expect(lines).toEqual([main, fork]);
    expect(reach).toBe(51 + 9);
    expect(footprint([])).toEqual({ lines: [], reach: 0 });
  });

  it("counts as reach the distinct cells of the kept lines (randomized)", () => {
    const random = mulberry32(31);
    for (let n = 0; n < 100; n++) {
      const all = Array.from({ length: 1 + Math.floor(random() * 8) }, () =>
        Int32Array.from({ length: 2 * (2 + Math.floor(random() * 6)) }, () =>
          Math.floor(random() * 300 - 20),
        ),
      );
      const cellsOf = (list: readonly Int32Array[]): Set<string> => {
        const cells = new Set<string>();
        for (const l of list) walkLine(l, 1, (c, r) => cells.add(`${String(c)},${String(r)}`));
        return cells;
      };
      const { lines, reach } = footprint(all);
      // Dropping lines loses no cell, and the result does not depend on the order.
      expect(cellsOf(lines)).toEqual(cellsOf(all));
      expect(reach).toBe(cellsOf(all).size);
      expect(footprint([...all].reverse())).toEqual({ lines, reach });
      // Every kept line is needed: a longer line never makes an earlier one useless.
      lines.forEach((_, k) => {
        expect(cellsOf(lines.slice(0, k + 1)).size).toBeGreaterThan(
          cellsOf(lines.slice(0, k)).size,
        );
      });
    }
  });

  it("thins a line without straying past the tolerance, keeping its ends (randomized)", () => {
    const random = mulberry32(11);
    for (let n = 0; n < 60; n++) {
      // A wandering line: steps of about 100 m.
      const line: Point[] = [{ x: 100, y: 100 }];
      let heading = random() * 6.28;
      for (let k = 0; k < 400; k++) {
        heading += (random() - 0.5) * 0.8;
        const last = line[line.length - 1] ?? { x: 0, y: 0 };
        line.push({ x: last.x + 0.1 * Math.cos(heading), y: last.y + 0.1 * Math.sin(heading) });
      }
      const thinned = thin(line, TOLERANCE_KM);
      expect(thinned[0]).toBe(line[0]);
      expect(thinned[thinned.length - 1]).toBe(line[line.length - 1]);
      expect(thinned.length).toBeLessThan(line.length);
      // A naive reference: each original point is within the tolerance of some
      // segment of the thinned line.
      for (const p of line) {
        let best = Number.POSITIVE_INFINITY;
        for (let k = 0; k + 1 < thinned.length; k++) {
          const a = thinned[k] ?? p;
          const b = thinned[k + 1] ?? p;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length2 = dx * dx + dy * dy;
          const t =
            length2 === 0
              ? 0
              : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
          best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
        }
        expect(best).toBeLessThanOrEqual(TOLERANCE_KM + 1e-9);
      }
    }
    // A straight line keeps its two ends only; two points stay two points.
    const straight = Array.from({ length: 50 }, (_, k) => ({ x: k, y: 2 * k }));
    expect(thin(straight, TOLERANCE_KM)).toHaveLength(2);
    expect(thin(straight.slice(0, 2), TOLERANCE_KM)).toHaveLength(2);
  });
});

describe("the baked rivers (DS-13, src/map/rivers.ts and rivers-fine.ts)", () => {
  const great = greatRivers();
  const lesser = LESSER_RIVERS_PACKED.map(unpackRiver);
  const rivers = [...great, ...lesser];

  it("unpack, longest first, the great ones apart, with no canal and no useless line", () => {
    expect(great).toHaveLength(GREAT_RIVERS_PACKED.length);
    expect(great.length).toBeGreaterThan(10);
    expect(lesser.length).toBeGreaterThan(50);
    rivers.forEach((r, k) => {
      expect(r.reach, r.name).toBeGreaterThanOrEqual(MIN_RIVER_REACH);
      expect(great.includes(r), r.name).toBe(r.reach >= GREAT_RIVER_REACH);
      expect(isCanal(r.name), r.name).toBe(false);
      expect(riverName(r.name)).toBe(r.name);
      expect(r.reach).toBeLessThanOrEqual(rivers[k - 1]?.reach ?? Number.POSITIVE_INFINITY);
      // The bake's own rule, applied again: nothing left to drop, the same reach.
      const again = footprint([...r.lines]);
      expect(again.reach, r.name).toBe(r.reach);
      expect(again.lines.map((l) => [...l])).toEqual(r.lines.map((l) => [...l]));
    });
  });

  it("hold the great rivers once each, the Loire the longest", () => {
    expect(rivers[0]?.name).toBe("la Loire");
    for (const name of ["la Loire", "la Seine", "le Rhône", "la Garonne", "la Dordogne"])
      expect(
        great.filter((r) => r.name === name),
        name,
      ).toHaveLength(1);
    // Joined and without its side arms, the Seine is a single river of 710 cells
    // (measured by the bake of 2026-11-13).
    const seine = great.find((r) => r.name === "la Seine")?.reach ?? 0;
    expect(seine).toBeGreaterThan(650);
    expect(seine).toBeLessThan(800);
  });

  it("keep their points on the map, but for a river that crosses a border", () => {
    let off = 0;
    let all = 0;
    for (const r of rivers)
      for (const line of r.lines)
        for (let k = 0; k < line.length; k += 2) {
          all++;
          const x = (line[k] ?? 0) / RIVER_UNITS_PER_KM;
          const y = (line[k + 1] ?? 0) / RIVER_UNITS_PER_KM;
          if (x < 0 || y < 0 || x >= FINE_COLUMNS || y >= FINE_ROWS) off++;
        }
    expect(off / all).toBeLessThan(0.01);
  });
});

describe("the rivers of the layers", () => {
  const coarse = coarseLayer();
  const fine = fineLayer(FINE_ELEVATION_RLE, LESSER_RIVERS_PACKED);
  const count = (layer: TerrainLayer): number => layer.rivers.reduce((t, v) => t + v, 0);
  /** Whether a river cell lies within `reach` cells of a place. */
  const near = (layer: TerrainLayer, latitude: number, longitude: number, reach: number) => {
    const { x, y } = kmOf(latitude, longitude);
    const c0 = Math.floor(x / layer.km);
    const r0 = Math.floor(y / layer.km);
    for (let r = r0 - reach; r <= r0 + reach; r++)
      for (let c = c0 - reach; c <= c0 + reach; c++)
        if (layer.rivers[r * layer.columns + c] === 1) return true;
    return false;
  };

  it("run on French land only", () => {
    for (const layer of [coarse, fine])
      layer.rivers.forEach((v, i) => {
        if (v === 1) {
          expect(layer.kinds[i]).not.toBe(SEA);
          expect(layer.kinds[i]).not.toBe(FOREIGN);
        }
      });
  });

  it("pass where the towns on their banks stand", () => {
    // The Loire at Orléans, the Seine at Rouen, the Rhône at Avignon, the Garonne at
    // Toulouse: town-hall positions (IGN, S-013), each within 2 km of its river.
    const places: [number, number][] = [
      [47.9025, 1.909],
      [49.4431, 1.0993],
      [43.9493, 4.8055],
      [43.6045, 1.444],
    ];
    for (const [latitude, longitude] of places) {
      expect(near(fine, latitude, longitude, 2), `${String(latitude)} fine`).toBe(true);
      expect(near(coarse, latitude, longitude, 1), `${String(latitude)} coarse`).toBe(true);
    }
  });

  it("show the great rivers alone on the 4 km layer, every baked river on the 1 km one", () => {
    // The Vilaine (a reach under GREAT_RIVER_REACH) at Redon: on the 1 km layer only.
    expect(near(fine, 47.651, -2.084, 2)).toBe(true);
    expect(near(coarse, 47.651, -2.084, 1)).toBe(false);
    expect(count(coarse)).toBeGreaterThan(1000);
    expect(count(fine)).toBeGreaterThan(4 * count(coarse));
    // Thin lines: well under a fiftieth of the map's cells.
    expect(count(fine)).toBeLessThan(fine.rivers.length / 50);
  });
});

describe("the rivers in a frame", () => {
  const coarse = coarseLayer();
  const fine = fineLayer(FINE_ELEVATION_RLE, LESSER_RIVERS_PACKED);
  const dry = (layer: TerrainLayer): TerrainLayer => ({
    ...layer,
    rivers: new Uint8Array(layer.rivers.length),
  });
  const sceneOf = (rivers: boolean, sun: number, focus: Scene["focus"]): Scene => ({
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    // The Loire between Orléans and Blois, far from any sea.
    camera: { ...kmOf(47.75, 1.6), scale: 2 },
    light: lightAt(sun),
    focus,
    coarse: rivers ? coarse : dry(coarse),
    fine: rivers ? fine : dry(fine),
    detail: 16,
    towns: [],
    plants: [],
    townLights: Object.fromEntries(REGION_CODES.map((r) => [r, 0.5])),
    landmarks: [],
  });
  const pixels = (scene: Scene): Uint8ClampedArray => {
    const out = createSurface(scene.width, scene.height);
    drawPixelScene(scene, out);
    return out.data;
  };
  const countOf = (data: Uint8ClampedArray, [r, g, b]: readonly number[]): number => {
    let n = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i] === r && data[i + 1] === g && data[i + 2] === b) n++;
    return n;
  };

  it("draws a river in the shallow sea's blue by day, where the land was", () => {
    // No region in focus: no land is veiled, so every river is in the plain blue.
    const wet = pixels(sceneOf(true, 35, null));
    const land = pixels(sceneOf(false, 35, null));
    expect(countOf(land, PALETTE.seaShallow)).toBe(0);
    expect(countOf(wet, PALETTE.seaShallow)).toBeGreaterThan(100);
    // Nothing else changes: every other pixel is the land's.
    let changed = 0;
    for (let i = 0; i < wet.length; i += 4)
      if (wet[i] !== land[i] || wet[i + 1] !== land[i + 1] || wet[i + 2] !== land[i + 2]) changed++;
    expect(changed).toBe(countOf(wet, PALETTE.seaShallow));
  });

  it("runs through a town but not over its chef-lieu's cell", () => {
    // Orléans, on the Loire: its town hall's cell keeps its roof, the river's other
    // cells in the town are water.
    const { x, y } = kmOf(47.9025, 1.909);
    const centre = Math.floor(y) * FINE_COLUMNS + Math.floor(x);
    const orleans = { x, y, population: 100_000, areaKm2: 27 };
    const withTown = (rivers: Uint8Array): Uint8ClampedArray =>
      pixels({ ...sceneOf(true, 35, null), fine: { ...fine, rivers }, towns: [orleans] });
    const onCentre = new Uint8Array(fine.rivers.length);
    onCentre[centre] = 1;
    const beside = new Uint8Array(fine.rivers.length);
    beside[centre + 1] = 1;
    const none = withTown(new Uint8Array(fine.rivers.length));
    // A river on the chef-lieu's cell alone changes nothing; beside it, it shows.
    expect(withTown(onCentre)).toEqual(none);
    expect(countOf(withTown(beside), PALETTE.seaShallow)).toBeGreaterThan(0);
    expect(countOf(none, PALETTE.seaShallow)).toBe(0);
  });

  it("lights no lamp at night, and steps back with the land around another region", () => {
    const night = pixels(sceneOf(true, -20, "24"));
    expect(countOf(night, PALETTE.lamp)).toBe(0);
    // Seen from Normandie, Centre-Val de Loire is veiled: its rivers are no longer
    // all in the plain blue.
    const other = pixels(sceneOf(true, 35, "28"));
    const own = pixels(sceneOf(true, 35, "24"));
    expect(countOf(other, PALETTE.seaShallow)).toBeLessThan(countOf(own, PALETTE.seaShallow));
  });
});
