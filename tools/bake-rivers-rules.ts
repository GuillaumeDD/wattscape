/**
 * Which rivers tools/bake-rivers.ts keeps, and how it thins their lines (B-023): kept
 * apart from the bake itself, which reads the network, so that the tests can check
 * the baked file against them.
 */
import { walkLine } from "../src/map/river-lines.ts";

/**
 * The shortest river kept: the 1 km cells of the map it crosses (`footprint`), close
 * to its length in kilometres.
 */
export const MIN_RIVER_REACH = 100;

/**
 * The server-side filter that spares the download: a river's lines summed, in
 * degrees (BD TOPO's geometry is in longitude and latitude). 0.5° is 40 to 55 km in
 * France, well under MIN_RIVER_REACH.
 */
export const MIN_DEGREES = 0.5;

/** How far a thinned line may stray from the surveyed one, km. */
export const TOLERANCE_KM = 0.3;

/**
 * A canal or an aqueduct, not a river: BD TOPO's `cours_d_eau` holds them too, and
 * names them as such (« Canal du Midi », « Ancien Canal du Verdon », « Grand Canal
 * d'Alsace », « Aqueduc de la Vanne »), with or without an article. A canalised river (« la Somme Canalisée ») is its river: `riverName`.
 */
export function isCanal(name: string): boolean {
  return /^((le|la|les|grande?|petite?|ancien(ne)?) |l')*(canal|rigole|dérivation|aqueduc)(?![\p{L}])/iu.test(
    name,
  );
}

/**
 * A river's name without what BD TOPO sometimes writes around it: « Fleuve la
 * Loire », « Rivière l'Allier », « la Moselle Canalisée » and « la Somme Rivière » are
 * stretches of « la Loire », « l'Allier », « la Moselle » and « la Somme ». A kind
 * that is the name itself stays (« Rivière Aa », « Rivière Langouette »).
 */
export function riverName(name: string): string {
  return name
    .replace(/^(fleuve|rivière) (?=l[ae] |l'|les )/i, "")
    .replace(/ (canalisée?|rivière)$/i, "");
}

/** A point in map kilometres. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The distance from a point to the segment a–b, km. */
function distance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Thins a line (Douglas–Peucker): keeps its ends, and every point without which the
 * line would stray more than `tolerance` from the original. Iterative, so a line of
 * 20 000 points does not exhaust the stack.
 */
export function thin(line: readonly Point[], tolerance: number): Point[] {
  if (line.length <= 2) return [...line];
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  for (let span = stack.pop(); span !== undefined; span = stack.pop()) {
    const [first, last] = span;
    const a = line[first];
    const b = line[last];
    if (a === undefined || b === undefined) continue;
    let worst = -1;
    let far = tolerance;
    for (let k = first + 1; k < last; k++) {
      const p = line[k];
      if (p === undefined) continue;
      const d = distance(p, a, b);
      if (d > far) {
        far = d;
        worst = k;
      }
    }
    if (worst === -1) continue;
    keep[worst] = 1;
    stack.push([first, worst], [worst, last]);
  }
  return line.filter((_, k) => keep[k] === 1);
}

/** The 1 km cells a set of lines crosses, each as `column + row * CELL_KEY`. */
const CELL_KEY = 65536;
function cellsOf(lines: readonly Int32Array[]): Set<number> {
  const cells = new Set<number>();
  // Offset, so that a cell left of or above the map keeps a key of its own.
  for (const line of lines)
    walkLine(line, 1, (c, r) => cells.add(c + 4096 + (r + 4096) * CELL_KEY));
  return cells;
}

/** A watercourse as BD TOPO gives it: one name, its lines. */
export interface Stretch {
  readonly name: string;
  readonly lines: readonly Int32Array[];
}

/**
 * Joins the stretches of one river: BD TOPO gives a long river as several
 * watercourses of the same name (« la Loire » three times), which overlap or follow
 * one another. Two stretches are one river when they bear the same name
 * (`riverName`) and touch: a cell of one is a cell of the other or its neighbour.
 * Two rivers that share a name far apart (« la Seille ») stay two. The order of the
 * result follows the first stretch of each river.
 */
export function joinStretches(stretches: readonly Stretch[]): Stretch[] {
  const cells = stretches.map((s) => cellsOf(s.lines));
  const names = stretches.map((s) => riverName(s.name));
  const root = stretches.map((_, k) => k);
  const find = (k: number): number => {
    let at = k;
    while (root[at] !== at) at = root[at] ?? at;
    return at;
  };
  const touch = (a: Set<number>, b: Set<number>): boolean => {
    for (const cell of a)
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) if (b.has(cell + dc + dr * CELL_KEY)) return true;
    return false;
  };
  for (let a = 0; a < stretches.length; a++)
    for (let b = a + 1; b < stretches.length; b++) {
      if (names[a] !== names[b] || find(a) === find(b)) continue;
      const ca = cells[a];
      const cb = cells[b];
      // The larger root index joins the smaller, so a river keeps its first stretch's place.
      if (ca !== undefined && cb !== undefined && touch(ca, cb))
        root[Math.max(find(a), find(b))] = Math.min(find(a), find(b));
    }
  const joined = new Map<number, { name: string; lines: Int32Array[] }>();
  stretches.forEach((s, k) => {
    const at = find(k);
    const river = joined.get(at) ?? { name: names[at] ?? s.name, lines: [] };
    river.lines.push(...s.lines);
    joined.set(at, river);
  });
  return [...joined.values()];
}

/** A river's lines without its redundant arms, and the cells they cross. */
export interface Footprint {
  /** The lines kept, longest first. */
  readonly lines: Int32Array[];
  /** How many 1 km cells they cross (`River.reach`). */
  readonly reach: number;
}

/** Orders two lines by their numbers, so that equal-length lines sort the same everywhere. */
function compareLines(a: Int32Array, b: Int32Array): number {
  for (let k = 0; k < a.length && k < b.length; k++) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

/**
 * The footprint of a river on the 1 km grid. Its lines are taken longest first (by
 * the cells each crosses), and a line is kept only when it crosses a cell that no
 * longer line crosses: a side arm that runs within the main course's cells would not
 * change a pixel of the map. Integers only, like the layers that draw the result.
 */
export function footprint(lines: readonly Int32Array[]): Footprint {
  const ranked = lines
    .map((line) => ({ line, cells: [...cellsOf([line])] }))
    .sort((a, b) => b.cells.length - a.cells.length || compareLines(a.line, b.line));
  const crossed = new Set<number>();
  const kept: Int32Array[] = [];
  for (const { line, cells } of ranked) {
    const before = crossed.size;
    for (const cell of cells) crossed.add(cell);
    if (crossed.size > before) kept.push(line);
  }
  return { lines: kept, reach: crossed.size };
}
