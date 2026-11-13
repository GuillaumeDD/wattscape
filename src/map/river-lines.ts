/**
 * The rivers of the baked map (B-023): how `src/map/rivers.ts` packs their lines, and
 * how a layer turns them into cells. Pure, and integers only from the packed file to
 * the cells, so every JS engine marks the same cells (AGENTS.md § Determinism).
 */

/** Packed positions are tenths of a map kilometre (src/map/grid.ts). */
export const RIVER_UNITS_PER_KM = 10;

/**
 * The reach from which a river is a great river: baked in `src/map/rivers.ts`, loaded
 * with the page and shown on the 4 km layer too. The others wait in
 * `src/map/rivers-fine.ts`, loaded with the 1 km relief (D-039).
 */
export const GREAT_RIVER_REACH = 300;

/** A river: its name, its reach and its lines (the main course and its arms). */
export interface River {
  /** IGN's name, as BD TOPO writes it (« la Loire »). */
  readonly name: string;
  /**
   * How many 1 km cells of the map it crosses: close to its length in kilometres (a
   * diagonal step counts once; an arm more than a cell away from the main course
   * counts too).
   */
  readonly reach: number;
  /** Each line as x0, y0, x1, y1, … in tenths of a map kilometre. */
  readonly lines: readonly Int32Array[];
}

/**
 * Packs a river as `name|reach|line;line`, a line being its first point then the
 * steps from each point to the next, as integers: « la Seine|690|5961 2573 3 -2 … ».
 */
export function packRiver(river: River): string {
  if (/[|;]/.test(river.name)) throw new Error(`river name: ${river.name}`);
  const lines = river.lines.map((line) => {
    const out: number[] = [];
    for (let k = 0; k < line.length; k++)
      out.push(k < 2 ? (line[k] ?? 0) : (line[k] ?? 0) - (line[k - 2] ?? 0));
    return out.join(" ");
  });
  return `${river.name}|${String(river.reach)}|${lines.join(";")}`;
}

/**
 * Unpacks a river. Throws on a malformed entry: the file is ours and committed, so
 * this is a build error, caught by the tests, never a runtime state.
 */
export function unpackRiver(packed: string): River {
  const [name, reach, lines, ...rest] = packed.split("|");
  if (name === undefined || reach === undefined || lines === undefined || rest.length > 0)
    throw new Error("river: malformed entry");
  if (!/^\d+$/.test(reach)) throw new Error(`river ${name}: bad reach`);
  return {
    name,
    reach: Number(reach),
    lines: lines.split(";").map((text) => {
      if (!/^-?\d+( -?\d+)*$/.test(text)) throw new Error(`river ${name}: bad line`);
      const steps = text.split(" ").map(Number);
      if (steps.length < 4 || steps.length % 2 !== 0) throw new Error(`river ${name}: bad line`);
      const line = new Int32Array(steps.length);
      for (let k = 0; k < steps.length; k++)
        line[k] = k < 2 ? (steps[k] ?? 0) : (line[k - 2] ?? 0) + (steps[k] ?? 0);
      return line;
    }),
  };
}

/**
 * Walks the cells of `km` kilometres that a line crosses, calling `visit` with each
 * column and row, on the grid or off it. Each segment is a straight walk between the
 * cells of its two ends (Bresenham's line: integers only), so the line is an
 * unbroken, 8-connected chain; a cell may be visited more than once.
 */
export function walkLine(
  line: Int32Array,
  km: number,
  visit: (column: number, row: number) => void,
): void {
  const unit = km * RIVER_UNITS_PER_KM;
  let c0 = Math.floor((line[0] ?? 0) / unit);
  let r0 = Math.floor((line[1] ?? 0) / unit);
  visit(c0, r0);
  for (let k = 2; k + 1 < line.length; k += 2) {
    const c1 = Math.floor((line[k] ?? 0) / unit);
    const r1 = Math.floor((line[k + 1] ?? 0) / unit);
    const dc = Math.abs(c1 - c0);
    const dr = Math.abs(r1 - r0);
    const sc = c0 < c1 ? 1 : -1;
    const sr = r0 < r1 ? 1 : -1;
    let error = dc - dr;
    while (c0 !== c1 || r0 !== r1) {
      const twice = 2 * error;
      if (twice > -dr) {
        error -= dr;
        c0 += sc;
      }
      if (twice < dc) {
        error += dc;
        r0 += sr;
      }
      visit(c0, r0);
    }
  }
}

/**
 * The cells of a grid that the rivers cross, one byte per cell (1: a river). Cells
 * off the grid are skipped.
 */
export function riverCells(
  rivers: readonly River[],
  km: number,
  columns: number,
  rows: number,
): Uint8Array {
  const cells = new Uint8Array(columns * rows);
  const mark = (c: number, r: number): void => {
    if (c >= 0 && c < columns && r >= 0 && r < rows) cells[r * columns + c] = 1;
  };
  for (const river of rivers) for (const line of river.lines) walkLine(line, km, mark);
  return cells;
}
