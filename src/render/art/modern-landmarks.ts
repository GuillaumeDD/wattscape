/**
 * The landmarks of the modern theme (B-027, D-057): the landmarks of ./landmarks.ts,
 * each within the box of its pixel-art sprite, drawn as shapes with smooth edges.
 * Each is GO in docs/POI.md, and the same limits hold: a natural site, a generic
 * scene or a work in the public domain, drawn from its silhouette, never traced; the
 * Eiffel Tower lit plainly, with no beam and no sparkle (P-008, P-009); the
 * lighthouses generic (P-005, P-024). Still, except for their lights, lit at night.
 *
 * A landmark with no drawing here yet keeps its pixel-art sprite, smoothed by the
 * theme. Original drawings, in code; no asset.
 */
import { type Landmark, type LandmarkSprite } from "../../map/landmarks.ts";
import { PALETTE, type Rgb } from "../palette.ts";
import {
  box,
  type Brush,
  clamp,
  DARK,
  disc,
  type Ink,
  inside,
  lamp,
  line,
  polygon,
  shadow,
} from "./shapes.ts";

const CHALK: Rgb = [244, 242, 232];
const STONE: Rgb = [228, 221, 203];
const OCHRE: Rgb = [206, 190, 158];
const GRANITE: Rgb = [152, 146, 134];
const QUAY: Rgb = [156, 156, 150];
const SLATE: Rgb = [74, 88, 108];
const IRON: Rgb = [70, 64, 62];
const GLASS: Rgb = [168, 196, 212];
const GOLD = PALETTE.nuclear;
const FOAM = PALETTE.foam;
const RED = PALETTE.roof;
const BRICK: Rgb = [170, 96, 74];
const PINK: Rgb = [206, 150, 136];
const SANDSTONE: Rgb = [182, 104, 84];
const TILE: Rgb = [128, 62, 52];
const COPPER: Rgb = [96, 144, 122];
const SPOIL: Rgb = [92, 84, 78];
const CLAY: Rgb = [128, 132, 112];
const BRINE: Rgb = [164, 188, 196];
const BRINE_SALT: Rgb = [226, 222, 214];
const BRINE_PINK: Rgb = [214, 192, 190];

/** Six points on a circle of radius 1, every sixth of a turn: a table, not a sine. */
const PETALS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.5, 0.866],
  [-0.5, 0.866],
  [-1, 0],
  [-0.5, -0.866],
  [0.5, -0.866],
];

/** A drawing: the landmark's box starts at `left`, and it stands on `foot`. */
type Drawing = (brush: Brush, left: number, foot: number) => void;
type Distance = (x: number, y: number) => number;
type Corners = readonly (readonly [number, number])[];

/**
 * The light on a wall `half` wide around `cx`, from `top` down to `foot`: from the
 * west, so dimmer to the east by `dim`, and a little dimmer towards the ground.
 */
const lit =
  (cx: number, half: number, top: number, foot: number, dim = 0.2, low = 0.1) =>
  (x: number, y: number): number =>
    (1 - dim * clamp((x - cx) / half / 2 + 0.5, 0, 1)) *
    (1 - low * clamp((y - top) / (foot - top || 1), 0, 1));

/** A shape given by its distance, within the box of its corners. */
function shape(
  brush: Brush,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  distance: Distance,
  colour: Rgb,
  ink?: Ink,
): void {
  brush.fill(x0 - 1, y0 - 1, x1 + 1, y1 + 1, distance, colour, ink);
}

/**
 * A doorway with a round or raised head: `half` wide, down to `sill`, springing at
 * `spring`, `rise` high above.
 */
const doorway =
  (cx: number, half: number, spring: number, rise: number, sill: number): Distance =>
  (x, y) => {
    const ex = x - cx;
    if (y > spring) return Math.max(Math.abs(ex) - half, y - sill);
    const dx = ex / half;
    const dy = (y - spring) / rise;
    return (Math.sqrt(dx * dx + dy * dy) - 1) * Math.min(half, rise);
  };

/** A mound: the upper half of an ellipse standing on `foot`. */
const mound =
  (cx: number, foot: number, rx: number, ry: number): Distance =>
  (x, y) => {
    const dx = (x - cx) / rx;
    const dy = (y - foot) / ry;
    return Math.max((Math.sqrt(dx * dx + dy * dy) - 1) * Math.min(rx, ry), y - foot);
  };

/** Foam along a waterline from x0 to x1: a wash, and a brighter line at the foot. */
function foam(brush: Brush, x0: number, x1: number, foot: number): void {
  brush.spot((x0 + x1) / 2, foot, (x1 - x0) / 2 + 1, 0.9, FOAM, 0.6);
  brush.spot((x0 + x1) / 2, foot + 0.1, (x1 - x0) / 2 + 0.3, 0.35, CHALK, 0.55);
}

/** A roof with two slopes: its ridge from x0 to x1 at `ridge`, its eaves `over` wider at `eaves`. */
function roof(
  brush: Brush,
  x0: number,
  x1: number,
  ridge: number,
  eaves: number,
  over: number,
  colour: Rgb,
  ink?: Ink,
): void {
  polygon(
    brush,
    [
      [x0, ridge],
      [x1, ridge],
      [x1 + over, eaves],
      [x0 - over, eaves],
    ],
    colour,
    ink,
  );
}

/** A spire or a pinnacle: a point at (x, top) over a base `half` wide at `base`. */
function spire(
  brush: Brush,
  x: number,
  top: number,
  base: number,
  half: number,
  colour: Rgb,
  ink?: Ink,
): void {
  polygon(
    brush,
    [
      [x, top],
      [x + half, base],
      [x - half, base],
    ],
    colour,
    ink,
  );
}

/**
 * A generic lighthouse, its axis at `x`: a white tower narrowing to a gallery, a
 * glazed lantern (lit at night) under a red cap; with a dark band or not.
 */
function lighthouse(brush: Brush, x: number, base: number, top: number, band: boolean): void {
  const gallery = top + 1.9;
  const tower: Corners = [
    [x - 0.42, gallery],
    [x + 0.42, gallery],
    [x + 0.72, base],
    [x - 0.72, base],
  ];
  const shade = lit(x, 0.6, gallery, base, 0.3, 0.06);
  polygon(brush, tower, CHALK, { shade });
  if (band) {
    const y = gallery + (base - gallery) * 0.45;
    const walls = inside(tower);
    shape(
      brush,
      x - 0.8,
      y - 0.5,
      x + 0.8,
      y + 0.5,
      (px, py) => Math.max(walls(px, py), Math.abs(py - y) - 0.5),
      PALETTE.seaDeep,
      { shade },
    );
  }
  // A door at the foot, a window half-way up.
  box(brush, x - 0.14, base - 0.55, x + 0.14, base, DARK, { alpha: 0.7 });
  if (!band) box(brush, x - 0.1, gallery + 1, x + 0.1, gallery + 1.3, DARK, { alpha: 0.6 });
  // The gallery and its rail, the lantern, the cap and its point.
  box(brush, x - 0.78, gallery - 0.16, x + 0.78, gallery + 0.06, DARK);
  if (brush.emissive) lamp(brush, x, gallery - 0.62, 0.38);
  else box(brush, x - 0.36, gallery - 1.05, x + 0.36, gallery - 0.16, GLASS);
  shape(brush, x - 0.6, top + 0.25, x + 0.6, gallery - 1, mound(x, gallery - 1, 0.56, 0.62), RED);
  line(brush, x, top + 0.4, x, top + 0.05, 0.07, 0.05, DARK);
}

/**
 * A ship-to-shore crane, its landward leg at `x`, standing on `quay`: a portal on two
 * legs, the boom out over the ship, hung from the top of the frame; the machinery
 * house, the trolley and its spreader.
 */
function crane(brush: Brush, x: number, quay: number): void {
  const boom = quay - 3.7;
  const land = x + 0.6;
  const sea = x + 3.9;
  const apex = quay - 5.45;
  // The stays, behind: from the top down to both ends of the boom.
  line(brush, sea, apex, x + 5.85, boom, 0.07, 0.07, RED);
  line(brush, sea, apex, x + 0.2, boom, 0.07, 0.07, RED);
  // The portal: two legs, a beam, a brace.
  line(brush, land, quay, land, boom, 0.17, 0.15, RED);
  line(brush, sea, quay, sea, apex, 0.17, 0.12, RED);
  line(brush, land, quay - 1.7, sea, quay - 1.7, 0.1, 0.1, RED);
  line(brush, land, quay - 1.7, sea, boom, 0.08, 0.08, RED);
  // The boom, the machinery house on it, the trolley and its spreader.
  box(brush, x + 0.1, boom - 0.2, x + 5.9, boom + 0.2, RED);
  box(brush, x + 1.2, boom - 0.85, x + 2.7, boom - 0.2, CHALK, {
    shade: lit(x + 1.95, 0.75, boom - 0.85, boom - 0.2),
  });
  line(brush, x + 4.95, boom, x + 4.95, quay - 2.45, 0.05, 0.05, DARK);
  box(brush, x + 4.55, quay - 2.5, x + 5.35, quay - 2.3, DARK);
  if (brush.emissive) lamp(brush, sea, apex - 0.2, 0.3);
}

/** The colours of the containers, as the pixel art's. */
const CONTAINERS: readonly Rgb[] = [
  PALETTE.solar,
  PALETTE.hydro,
  PALETTE.thermal,
  PALETTE.nuclear,
  PALETTE.roof,
];
/** How many containers are stacked at each place along the quay. */
const STACKS = [1, 2, 2, 1, 2, 1, 1, 2, 2, 1, 2, 2, 1, 1, 2] as const;

/** The Eiffel Tower's height in scene pixels, and its half-width at a height above the ground. */
const EIFFEL = 12.6;
function eiffelHalf(up: number): number {
  // A curve that flares to the ground, as the legs do.
  const t = 1 - clamp(up / EIFFEL, 0, 1);
  return 0.1 + 3.3 * t * t * t;
}

const DRAWINGS: Readonly<Partial<Record<LandmarkSprite, Drawing>>> = {
  // The needle (west) and the arch (the Porte d'Aval, a buttress that steps out of
  // the cliff into the sea): white chalk in beds, under the grass, in the foam.
  etretat(brush, left, foot) {
    foam(brush, left + 0.6, left + 3.4, foot);
    foam(brush, left + 5, left + 13, foot);
    const beds = (within: Distance, top: number): void => {
      for (const up of [1.3, 2.5, 3.7])
        if (foot - up > top)
          shape(
            brush,
            left,
            foot - up - 0.1,
            left + 13,
            foot - up + 0.1,
            (x, y) => Math.max(within(x, y) + 0.1, Math.abs(y - (foot - up)) - 0.07),
            GRANITE,
            { alpha: 0.4 },
          );
    };
    const needle = inside([
      [left + 2.2, foot - 5],
      [left + 2.55, foot - 4.85],
      [left + 3.25, foot],
      [left + 0.95, foot],
    ]);
    shape(brush, left + 1, foot - 5, left + 3.3, foot, needle, CHALK, {
      shade: lit(left + 2.1, 1.1, foot - 5, foot, 0.28, 0.08),
    });
    beds(needle, foot - 4);
    // The cliff, its top sloping down to the arch's leg in the sea.
    const cliff = inside([
      [left + 5.15, foot],
      [left + 5.45, foot - 4],
      [left + 6.5, foot - 5.1],
      [left + 9.4, foot - 6],
      [left + 13, foot - 6],
      [left + 13, foot],
    ]);
    const opening = doorway(left + 7.7, 1.3, foot - 2.2, 2.4, foot + 1);
    const arch: Distance = (x, y) => Math.max(cliff(x, y), -opening(x, y));
    shape(brush, left + 5, foot - 6, left + 13, foot, arch, CHALK, {
      shade: (x, y) =>
        (1 - 0.2 * clamp((x - left - 5) / 8, 0, 1)) * (1 - 0.1 * clamp((foot - y) / -6 + 1, 0, 1)),
    });
    beds(arch, foot - 5);
    // The grass on top, a thin coat that follows the slope.
    shape(
      brush,
      left + 5,
      foot - 6,
      left + 13,
      foot - 4,
      (x, y) => Math.max(arch(x, y), -cliff(x, y) - 0.4, left + 8.6 - x, y - (foot - 5)),
      PALETTE.meadow,
    );
  },
  // Two ship-to-shore cranes over the stacks of containers; a light on each top at
  // night.
  portCranes(brush, left, foot) {
    shadow(brush, left + 7.5, foot, 15);
    const quay = foot - 0.9;
    box(brush, left, quay, left + 15, foot, QUAY, {
      shade: (_, y) => (y < quay + 0.22 ? 1.12 : 0.9),
    });
    for (const [k, stack] of STACKS.entries())
      for (let tier = 0; tier < stack; tier++) {
        const colour = CONTAINERS[(k * 3 + tier * 2) % CONTAINERS.length] ?? RED;
        box(
          brush,
          left + k + 0.07,
          quay - 0.5 * (tier + 1) + 0.04,
          left + k + 0.93,
          quay - 0.5 * tier,
          colour,
          { shade: (_, y) => (y < quay - 0.5 * (tier + 1) + 0.18 ? 1.1 : 0.95) },
        );
      }
    crane(brush, left, quay);
    crane(brush, left + 8, quay);
  },
  // A lighthouse on the round head of a jetty.
  harbourLight(brush, left, foot) {
    foam(brush, left, left + 7, foot);
    box(brush, left + 0.3, foot - 0.85, left + 7, foot, GRANITE, {
      shade: (_, y) => (y < foot - 0.62 ? 1.2 : 0.95),
    });
    shape(
      brush,
      left,
      foot - 1.6,
      left + 3,
      foot,
      (x, y) => Math.max(Math.abs(x - (left + 1.5)) - 1.4, foot - 1.55 - y, y - foot) - 0.05,
      GRANITE,
      { shade: lit(left + 1.5, 1.4, foot - 1.6, foot, 0.25, 0.15) },
    );
    box(brush, left + 0.05, foot - 1.72, left + 2.95, foot - 1.5, STONE);
    lighthouse(brush, left + 1.5, foot - 1.7, foot - 6, false);
  },
  // The abbey on its rock: the ramparts and the village's roofs at the foot, trees
  // on the slopes, the abbey's great walls, the church, its spire and its gilded
  // archangel; the sands around.
  montSaintMichel(brush, left, foot) {
    const cx = left + 5.5;
    brush.spot(cx, foot + 0.1, 6.6, 1.1, PALETTE.sand, 0.9);
    // The rock: a mound, lit from the west.
    shape(brush, left, foot - 5, left + 11, foot, mound(cx, foot, 5.2, 4.4), GRANITE, {
      shade: lit(cx, 5.2, foot - 4.4, foot, 0.3, 0.1),
    });
    // Trees on the slopes.
    for (const [dx, up, r] of [
      [-3.5, 2.2, 0.62],
      [-2.7, 2.9, 0.5],
      [3.3, 2.4, 0.66],
      [2.5, 3.1, 0.48],
      [-4.1, 1.5, 0.45],
      [4.1, 1.6, 0.5],
    ] as const)
      disc(brush, cx + dx, foot - up, r, PALETTE.forest, { shade: lit(cx + dx, r, 0, 1, 0.3, 0) });
    // The ramparts and two of their towers.
    box(brush, left + 0.7, foot - 0.6, left + 10.3, foot, OCHRE, {
      shade: lit(cx, 4.8, foot - 0.6, foot, 0.25, 0.2),
    });
    for (const x of [left + 1.5, left + 4.6, left + 8.6]) {
      box(brush, x - 0.34, foot - 0.95, x + 0.34, foot, OCHRE);
      spire(brush, x, foot - 1.4, foot - 0.95, 0.42, SLATE);
    }
    // The village: houses in two rows, their roofs red or slate.
    for (const [dx, up, red] of [
      [-3.6, 0.7, true],
      [-2.6, 0.75, false],
      [-1.5, 0.7, true],
      [1.6, 0.75, true],
      [2.7, 0.7, false],
      [3.8, 0.7, true],
      [-2.9, 1.45, false],
      [-1.9, 1.55, true],
      [1.4, 1.5, false],
      [2.4, 1.45, true],
      [-0.5, 1.5, true],
      [0.5, 1.6, false],
    ] as const) {
      const x = cx + dx;
      box(brush, x - 0.4, foot - up - 0.42, x + 0.4, foot - up, STONE, {
        shade: lit(x, 0.4, 0, 1, 0.2, 0),
      });
      roof(brush, x - 0.2, x + 0.2, foot - up - 0.85, foot - up - 0.42, 0.3, red ? RED : SLATE);
    }
    // The abbey: the great walls on their buttresses, a row of windows.
    box(brush, left + 2.7, foot - 5, left + 8.3, foot - 2.5, STONE, {
      shade: lit(cx, 2.8, foot - 5, foot - 2.5, 0.22, 0.12),
    });
    for (let k = 0; k < 7; k++) {
      const x = left + 3.1 + k * 0.8;
      box(brush, x - 0.09, foot - 4.6, x + 0.09, foot - 2.5, GRANITE, { alpha: 0.45 });
      if (k < 6) box(brush, x + 0.3, foot - 4.35, x + 0.5, foot - 3.85, DARK, { alpha: 0.55 });
    }
    roof(brush, left + 3, left + 8, foot - 5.4, foot - 5, 0.3, SLATE);
    // The church, its tower, the spire and the archangel.
    box(brush, left + 3.9, foot - 6.3, left + 7.1, foot - 5.3, STONE, {
      shade: lit(cx, 1.6, foot - 6.3, foot - 5.3, 0.22, 0.1),
    });
    roof(brush, left + 4.2, left + 6.8, foot - 6.75, foot - 6.3, 0.3, SLATE);
    box(brush, cx - 0.5, foot - 7.3, cx + 0.5, foot - 6.3, STONE, {
      shade: lit(cx, 0.5, foot - 7.3, foot - 6.3, 0.25, 0),
    });
    spire(brush, cx, foot - 8.75, foot - 7.3, 0.5, SLATE);
    disc(brush, cx, foot - 8.75, 0.2, GOLD);
  },
  // The iron tower: four legs that curve up to one spire, the three platforms, the
  // great arch under the first; lit plainly at night (P-008): its lamps, no beam, no
  // sparkle (P-009).
  eiffelTower(brush, left, foot) {
    const cx = left + 4.5;
    shadow(brush, cx, foot, 7);
    const shade = lit(cx, 2.4, foot - EIFFEL, foot, 0.3, 0);
    const gap = inside([
      [cx, foot - 4.4],
      [cx + 0.62, foot - 2.75],
      [cx - 0.62, foot - 2.75],
    ]);
    // The outline, less the arch between the legs and the gap between the pairs.
    shape(
      brush,
      left,
      foot - EIFFEL,
      left + 9,
      foot,
      (x, y) => {
        const up = foot - y;
        const outline = Math.max(Math.abs(x - cx) - eiffelHalf(up), -up, up - EIFFEL);
        const dx = (x - cx) / 2.3;
        const dy = up / 2.05;
        const arch = (Math.sqrt(dx * dx + dy * dy) - 1) * 2.05;
        return Math.max(outline, -arch, -gap(x, y));
      },
      IRON,
      { shade },
    );
    // The platforms, a little wider than the tower there.
    box(brush, cx - 2.2, foot - 2.75, cx + 2.2, foot - 2.3, IRON, { shade });
    box(brush, cx - 1.2, foot - 4.95, cx + 1.2, foot - 4.6, IRON, { shade });
    box(brush, cx - 0.38, foot - 11.1, cx + 0.38, foot - 10.85, IRON, { shade });
    if (!brush.emissive) return;
    for (const [dx, up] of [
      [0, 11.4],
      [0, 8],
      [0, 4.78],
      [-1.35, 2.52],
      [1.35, 2.52],
    ] as const)
      lamp(brush, cx + dx, foot - up, 0.28);
  },
  // Rouen cathedral from the south: a tower of the west front, the nave on its
  // buttresses under the slate roof, the transept, the crossing tower and its
  // cast-iron spire (dark), the apse; west of it the Gros-Horloge (P-042), a
  // pavilion on an arch over the street, its gold dial.
  rouenCathedral(brush, left, foot) {
    shadow(brush, left + 6.5, foot, 11);
    // The Gros-Horloge.
    const gate = left + 1.9;
    const street = doorway(gate, 0.85, foot - 0.9, 0.85, foot + 1);
    shape(
      brush,
      left,
      foot - 3,
      left + 3.8,
      foot,
      (x, y) => Math.max(Math.abs(x - gate) - 1.75, foot - 3 - y, y - foot, -street(x, y)),
      OCHRE,
      { shade: lit(gate, 1.75, foot - 3, foot, 0.22, 0.12) },
    );
    roof(brush, gate - 1.1, gate + 1.1, foot - 3.85, foot - 3, 0.85, SLATE);
    disc(brush, gate, foot - 2.1, 0.62, IRON);
    disc(brush, gate, foot - 2.1, 0.5, GOLD);
    // The crossing tower and its spire, behind the roofs.
    const cross = left + 8.5;
    box(brush, cross - 0.75, foot - 5.4, cross + 0.75, foot - 3, STONE, {
      shade: lit(cross, 0.75, foot - 5.4, foot - 3, 0.25, 0),
    });
    for (const dx of [-0.3, 0.3])
      box(brush, cross + dx - 0.1, foot - 5, cross + dx + 0.1, foot - 4.2, DARK, { alpha: 0.5 });
    spire(brush, cross, foot - 10, foot - 5.4, 0.6, IRON, { shade: lit(cross, 0.5, 0, 1, 0.3, 0) });
    for (const dx of [-0.72, 0.72]) spire(brush, cross + dx, foot - 6.3, foot - 5.4, 0.2, IRON);
    // The nave: its wall, the buttresses and the windows between them, the roof.
    box(brush, left + 5.4, foot - 2.2, left + 11.5, foot, STONE, {
      shade: lit(left + 8.5, 3, foot - 2.2, foot, 0.16, 0.14),
    });
    roof(brush, left + 5.4, left + 11.3, foot - 3.3, foot - 2.2, 0.2, SLATE);
    for (let k = 0; k < 7; k++) {
      const x = left + 5.95 + k * 0.88;
      if (k === 3) continue;
      shape(
        brush,
        x - 0.15,
        foot - 1.75,
        x + 0.15,
        foot - 0.7,
        doorway(x, 0.14, foot - 1.45, 0.3, foot - 0.7),
        DARK,
        { alpha: 0.6 },
      );
      box(brush, x + 0.36, foot - 2.2, x + 0.52, foot, GRANITE, { alpha: 0.4 });
    }
    // The apse, lower, at the east end.
    shape(
      brush,
      left + 11,
      foot - 1.9,
      left + 12,
      foot,
      mound(left + 11.3, foot, 0.7, 2.6),
      STONE,
      {
        shade: lit(left + 11.3, 0.7, foot - 2, foot, 0.3, 0.1),
      },
    );
    // The transept: a gable, its rose window, its door.
    box(brush, cross - 0.85, foot - 3.2, cross + 0.85, foot, STONE, {
      shade: lit(cross, 0.85, foot - 3.2, foot, 0.2, 0.1),
    });
    spire(brush, cross, foot - 4.2, foot - 3.2, 0.85, STONE);
    disc(brush, cross, foot - 2.5, 0.36, SLATE);
    shape(
      brush,
      cross - 0.3,
      foot - 1.2,
      cross + 0.3,
      foot,
      doorway(cross, 0.26, foot - 0.7, 0.45, foot),
      DARK,
      {
        alpha: 0.65,
      },
    );
    // The tower of the west front, its crown and pinnacles.
    const tower = left + 4.75;
    box(brush, tower - 0.85, foot - 5, tower + 0.85, foot, STONE, {
      shade: lit(tower, 0.85, foot - 5, foot, 0.25, 0.1),
    });
    box(brush, tower - 0.6, foot - 5.8, tower + 0.6, foot - 5, STONE, {
      shade: lit(tower, 0.6, foot - 5.8, foot - 5, 0.25, 0),
    });
    for (const dx of [-0.75, -0.25, 0.25, 0.75])
      spire(
        brush,
        tower + dx,
        foot - (Math.abs(dx) < 0.5 ? 6.5 : 5.7),
        foot - (Math.abs(dx) < 0.5 ? 5.8 : 5),
        0.16,
        STONE,
      );
    for (const dx of [-0.35, 0.35]) {
      const lancet = doorway(tower + dx, 0.13, foot - 4, 0.3, foot - 3);
      shape(brush, tower + dx - 0.2, foot - 4.4, tower + dx + 0.2, foot - 2.9, lancet, DARK, {
        alpha: 0.55,
      });
    }
    shape(
      brush,
      tower - 0.3,
      foot - 1.3,
      tower + 0.3,
      foot,
      doorway(tower, 0.28, foot - 0.75, 0.5, foot),
      DARK,
      {
        alpha: 0.65,
      },
    );
  },
  // A generic lighthouse on a rock at sea: white with a dark band, its light at night.
  seaLighthouse(brush, left, foot) {
    const cx = left + 1.5;
    foam(brush, left - 0.3, left + 3.3, foot);
    shape(brush, left, foot - 1.6, left + 3, foot, mound(cx, foot, 1.65, 1.5), GRANITE, {
      shade: lit(cx, 1.65, foot - 1.5, foot, 0.35, 0.1),
    });
    lighthouse(brush, cx, foot - 1.15, foot - 8, true);
  },
  // The second lot (B-027). The twin heaps of the 11/19 pit: dark spoil in steep
  // cones, rain-worn, grass creeping up their feet.
  slagHeaps(brush, left, foot) {
    shadow(brush, left + 5.5, foot, 11);
    for (const [cx, top] of [
      [left + 2.5, foot - 4],
      [left + 8.5, foot - 3.85],
    ] as const) {
      const cone: Corners = [
        [cx - 0.3, top],
        [cx + 0.3, top],
        [cx + 2.75, foot],
        [cx - 2.75, foot],
      ];
      polygon(brush, cone, SPOIL, { shade: lit(cx, 2.4, top, foot, 0.4, 0) });
      // The gullies the rain cuts down their sides.
      const walls = inside(cone);
      for (const dx of [-1.4, -0.6, 0.5, 1.3]) {
        const x0 = cx + dx * 0.25;
        const x1 = cx + dx;
        shape(
          brush,
          Math.min(x0, x1) - 0.2,
          top,
          Math.max(x0, x1) + 0.2,
          foot,
          (x, y) => {
            const t = clamp((y - top) / (foot - top), 0, 1);
            return Math.max(walls(x, y) + 0.15, Math.abs(x - (x0 + (x1 - x0) * t)) - 0.06);
          },
          DARK,
          { alpha: 0.35 },
        );
      }
      shape(
        brush,
        cx - 3,
        foot - 1,
        cx + 3,
        foot,
        (x, y) => Math.max(walls(x, y), foot - 0.55 - y + 0.25 * Math.abs(((x - cx) * 1.7) % 1)),
        PALETTE.grass,
        { alpha: 0.8 },
      );
    }
  },
  // Lille's belfry: the tall brick shaft with its stone quoins over the town hall,
  // the clock, the crowned top with its corner pinnacles, the lantern and the
  // spire.
  lilleBelfry(brush, left, foot) {
    const cx = left + 2.5;
    shadow(brush, cx, foot, 5);
    // The town hall at its foot.
    box(brush, left + 0.1, foot - 1.15, left + 4.9, foot, STONE, {
      shade: lit(cx, 2.4, foot - 1.15, foot, 0.2, 0.1),
    });
    for (let k = 0; k < 5; k++) {
      const x = left + 0.55 + k * 0.97;
      box(brush, x - 0.12, foot - 0.85, x + 0.12, foot - 0.35, DARK, { alpha: 0.55 });
    }
    // The shaft, narrowing a little, brick between stone quoins.
    const shaft: Corners = [
      [cx - 0.95, foot - 6.7],
      [cx + 0.95, foot - 6.7],
      [cx + 1.1, foot - 1.15],
      [cx - 1.1, foot - 1.15],
    ];
    const shade = lit(cx, 1.1, foot - 6.7, foot, 0.28, 0.08);
    polygon(brush, shaft, BRICK, { shade });
    const walls = inside(shaft);
    for (const side of [-1, 1])
      shape(
        brush,
        cx - 1.2,
        foot - 6.8,
        cx + 1.2,
        foot - 1.1,
        (x, y) => Math.max(walls(x, y), -(side * (x - cx)) + 0.78),
        STONE,
        { shade },
      );
    // Slits up the shaft, and the clock.
    for (const up of [2, 3, 4]) {
      const y = foot - up;
      shape(brush, cx - 0.2, y - 0.6, cx + 0.2, y, doorway(cx, 0.1, y - 0.3, 0.2, y), DARK, {
        alpha: 0.6,
      });
    }
    disc(brush, cx, foot - 5.6, 0.48, STONE);
    disc(brush, cx, foot - 5.6, 0.32, CHALK);
    line(brush, cx, foot - 5.6, cx, foot - 5.82, 0.04, 0.04, DARK);
    line(brush, cx, foot - 5.6, cx + 0.15, foot - 5.55, 0.04, 0.04, DARK);
    // The top: a stone stage with its arches, pinnacles at the corners.
    box(brush, cx - 1.05, foot - 7.5, cx + 1.05, foot - 6.65, STONE, {
      shade: lit(cx, 1.05, 0, 1, 0.25, 0),
    });
    for (const dx of [-0.45, 0.45])
      shape(
        brush,
        cx + dx - 0.2,
        foot - 7.35,
        cx + dx + 0.2,
        foot - 6.75,
        doorway(cx + dx, 0.15, foot - 7.1, 0.2, foot - 6.8),
        DARK,
        { alpha: 0.7 },
      );
    for (const dx of [-1, 1]) spire(brush, cx + dx, foot - 8.35, foot - 7.5, 0.2, STONE);
    // The lantern and the spire, dark, a golden point.
    box(brush, cx - 0.52, foot - 8.45, cx + 0.52, foot - 7.5, SLATE, {
      shade: lit(cx, 0.52, 0, 1, 0.3, 0),
    });
    box(brush, cx - 0.2, foot - 8.25, cx + 0.2, foot - 7.75, DARK, { alpha: 0.6 });
    spire(brush, cx, foot - 9.85, foot - 8.45, 0.55, SLATE, { shade: lit(cx, 0.5, 0, 1, 0.3, 0) });
    disc(brush, cx, foot - 9.85, 0.12, GOLD);
  },
  // Amiens cathedral from the south: the west front and its two short towers, its
  // rose window, the long nave on its buttresses under the slate roof, the thin
  // spire over the crossing, the apse.
  amiensCathedral(brush, left, foot) {
    shadow(brush, left + 6, foot, 12);
    // The spire, behind the roof: a drum, the needle, golden at its tip.
    const cross = left + 8.5;
    box(brush, cross - 0.6, foot - 4.1, cross + 0.6, foot - 3, SLATE, {
      shade: lit(cross, 0.6, 0, 1, 0.3, 0),
    });
    spire(brush, cross, foot - 7, foot - 4.1, 0.4, SLATE, { shade: lit(cross, 0.4, 0, 1, 0.3, 0) });
    disc(brush, cross, foot - 7, 0.1, GOLD);
    // The nave: wall, roof, buttresses and windows; the apse at the east end.
    box(brush, left + 3, foot - 2.2, left + 11.4, foot, STONE, {
      shade: lit(left + 7, 4, foot - 2.2, foot, 0.14, 0.14),
    });
    roof(brush, left + 3, left + 11.2, foot - 3.15, foot - 2.2, 0.15, SLATE);
    for (let k = 0; k < 9; k++) {
      const x = left + 3.45 + k * 0.9;
      shape(
        brush,
        x - 0.14,
        foot - 1.9,
        x + 0.14,
        foot - 0.55,
        doorway(x, 0.13, foot - 1.6, 0.28, foot - 0.6),
        DARK,
        { alpha: 0.55 },
      );
      line(brush, x + 0.45, foot - 2.25, x + 0.45, foot, 0.08, 0.1, GRANITE, { alpha: 0.5 });
    }
    shape(brush, left + 11, foot - 2, left + 12, foot, mound(left + 11.2, foot, 0.8, 2.1), STONE, {
      shade: lit(left + 11.2, 0.8, foot - 2, foot, 0.3, 0.1),
    });
    // The west front: two towers, the south one a little higher, the gallery
    // between them, the rose, three portals.
    const front = left + 1.5;
    box(brush, left + 0.05, foot - 4.4, left + 2.95, foot, STONE, {
      shade: lit(front, 1.45, foot - 4.4, foot, 0.22, 0.1),
    });
    for (const [x0, top] of [
      [left + 0.05, foot - 5.5],
      [left + 2, foot - 5.25],
    ] as const) {
      box(brush, x0, top, x0 + 0.95, foot - 4.3, STONE, {
        shade: lit(x0 + 0.47, 0.5, 0, 1, 0.22, 0),
      });
      shape(
        brush,
        x0 + 0.3,
        top + 0.15,
        x0 + 0.65,
        foot - 4.4,
        doorway(x0 + 0.47, 0.13, top + 0.45, 0.25, foot - 4.55),
        DARK,
        { alpha: 0.6 },
      );
    }
    box(brush, left + 0.05, foot - 4.5, left + 2.95, foot - 4.3, GRANITE, { alpha: 0.6 });
    disc(brush, front, foot - 3.35, 0.58, GRANITE);
    disc(brush, front, foot - 3.35, 0.44, SLATE);
    for (const [x, half] of [
      [front - 0.95, 0.24],
      [front, 0.32],
      [front + 0.95, 0.24],
    ] as const)
      shape(
        brush,
        x - half - 0.05,
        foot - 2.2,
        x + half + 0.05,
        foot,
        doorway(x, half, foot - 1.3 + half, 0.55, foot),
        DARK,
        { alpha: 0.65 },
      );
  },
  // Strasbourg cathedral: pink sandstone, the west front's lacework, the octagon
  // and its single spire over the north tower; the nave under its slate roof.
  strasbourgCathedral(brush, left, foot) {
    shadow(brush, left + 4, foot, 8);
    // The nave.
    box(brush, left + 3, foot - 2, left + 8, foot, PINK, {
      shade: lit(left + 5.5, 2.5, foot - 2, foot, 0.16, 0.14),
    });
    roof(brush, left + 3, left + 7.85, foot - 3.05, foot - 2, 0.15, SLATE);
    for (let k = 0; k < 5; k++) {
      const x = left + 3.55 + k * 0.92;
      shape(
        brush,
        x - 0.14,
        foot - 1.7,
        x + 0.14,
        foot - 0.5,
        doorway(x, 0.13, foot - 1.4, 0.26, foot - 0.55),
        DARK,
        { alpha: 0.55 },
      );
    }
    // The west front, up to its platform, laced with tall thin lines.
    const front = left + 1.6;
    const shade = lit(front, 1.6, foot - 4.4, foot, 0.25, 0.1);
    box(brush, left + 0.05, foot - 4.4, left + 3.15, foot, PINK, { shade });
    for (let k = 0; k < 7; k++) {
      const x = left + 0.35 + k * 0.42;
      line(brush, x, foot - 4.25, x, foot - 1.6, 0.035, 0.035, DARK, { alpha: 0.35 });
    }
    disc(brush, front, foot - 3.05, 0.62, DARK, { alpha: 0.5 });
    disc(brush, front, foot - 3.05, 0.45, PINK, { shade });
    for (let k = 0; k < 6; k++) {
      // The rose's petals: dark dots in a ring, by a table of angles.
      const [dx, dy] = PETALS[k] ?? [0, 0];
      disc(brush, front + dx * 0.28, foot - 3.05 + dy * 0.28, 0.07, DARK, { alpha: 0.6 });
    }
    for (const [x, half] of [
      [front - 1, 0.26],
      [front, 0.36],
      [front + 1, 0.26],
    ] as const)
      shape(
        brush,
        x - half - 0.05,
        foot - 1.7,
        x + half + 0.05,
        foot,
        doorway(x, half, foot - 1.05 + half, 0.6, foot),
        DARK,
        { alpha: 0.65 },
      );
    // The platform, and the stub of the south tower that was never raised.
    box(brush, left + 0.05, foot - 4.55, left + 3.15, foot - 4.3, PINK, { shade });
    box(brush, left + 2.3, foot - 4.95, left + 3.15, foot - 4.4, PINK, { shade });
    // The north tower's octagon, its four stair turrets, and the spire.
    const tower = left + 1.5;
    box(brush, tower - 0.85, foot - 6.25, tower + 0.85, foot - 4.4, PINK, {
      shade: lit(tower, 0.85, foot - 6.25, foot - 4.4, 0.3, 0),
    });
    for (const dx of [-0.32, 0.32])
      shape(
        brush,
        tower + dx - 0.16,
        foot - 6.05,
        tower + dx + 0.16,
        foot - 4.6,
        doorway(tower + dx, 0.12, foot - 5.75, 0.25, foot - 4.65),
        DARK,
        { alpha: 0.6 },
      );
    for (const dx of [-0.9, 0.9])
      line(brush, tower + dx, foot - 4.4, tower + dx, foot - 6.55, 0.13, 0.08, PINK, { shade });
    const needle: Corners = [
      [tower, foot - 9],
      [tower + 0.8, foot - 6.25],
      [tower - 0.8, foot - 6.25],
    ];
    polygon(brush, needle, PINK, { shade: lit(tower, 0.8, 0, 1, 0.3, 0) });
    // Its tiers of open work.
    const point = inside(needle);
    for (const up of [6.7, 7.25, 7.8, 8.3])
      shape(
        brush,
        tower - 0.8,
        foot - up - 0.08,
        tower + 0.8,
        foot - up + 0.08,
        (x, y) => Math.max(point(x, y) + 0.12, Math.abs(y - (foot - up)) - 0.05),
        DARK,
        { alpha: 0.45 },
      );
  },
  // Haut-Kœnigsbourg: red sandstone walls on the top of its wooded hill, the halls
  // under steep roofs, the square keep in the middle.
  hautKoenigsbourg(brush, left, foot) {
    const cx = left + 5.5;
    // The hill and its trees.
    shape(
      brush,
      left - 0.3,
      foot - 1.6,
      left + 11.3,
      foot,
      mound(cx, foot, 5.8, 1.5),
      PALETTE.forest,
      {
        shade: lit(cx, 5.8, foot - 1.5, foot, 0.3, 0),
      },
    );
    for (let k = 0; k < 9; k++) {
      const x = left + 0.9 + k * 1.15;
      const up = 0.55 + 0.35 * (1 - Math.abs(x - cx) / 5.5);
      disc(brush, x, foot - up, 0.42, PALETTE.forest, { shade: lit(x, 0.42, 0, 1, 0.35, 0) });
    }
    const shade = lit(cx, 4.5, foot - 3.2, foot - 1, 0.25, 0.12);
    // The outer walls along the crest, and their round tower to the east.
    box(brush, left + 1, foot - 2.15, left + 10, foot - 1.05, SANDSTONE, { shade });
    shape(
      brush,
      left + 8.7,
      foot - 3.1,
      left + 10.1,
      foot - 1,
      (x, y) => Math.max(Math.abs(x - (left + 9.4)) - 0.6, foot - 3 - y, y - (foot - 1.05)),
      SANDSTONE,
      { shade },
    );
    spire(brush, left + 9.4, foot - 3.75, foot - 3, 0.72, TILE);
    // The halls, their steep roofs.
    box(brush, left + 2, foot - 3.05, left + 8.7, foot - 2.1, SANDSTONE, { shade });
    roof(brush, left + 2.5, left + 3.5, foot - 4.1, foot - 3.05, 0.5, TILE);
    roof(brush, left + 6.9, left + 7.9, foot - 3.95, foot - 3.05, 0.5, TILE);
    for (let k = 0; k < 7; k++) {
      const x = left + 2.4 + k * 0.95;
      if (k === 2 || k === 3) continue;
      box(brush, x - 0.1, foot - 2.75, x + 0.1, foot - 2.4, DARK, { alpha: 0.6 });
    }
    // The keep: square, taller, its roof and a little spire.
    box(brush, left + 4.15, foot - 5.1, left + 5.85, foot - 2.1, SANDSTONE, {
      shade: lit(left + 5, 0.85, foot - 5.1, foot - 2.1, 0.3, 0.1),
    });
    for (const up of [3, 4.2])
      box(brush, left + 4.85, foot - up - 0.35, left + 5.15, foot - up, DARK, { alpha: 0.6 });
    roof(brush, left + 4.85, left + 5.15, foot - 5.95, foot - 5.1, 0.95, TILE);
  },
  // Chartres cathedral from the south: the plain old spire, nearer, and behind it
  // the taller lacy one; the nave under its green copper roof, its buttresses.
  chartresCathedral(brush, left, foot) {
    shadow(brush, left + 6, foot, 12);
    // The north tower, behind: pale, its flamboyant spire with pinnacles.
    const north = left + 2.6;
    box(brush, north - 0.95, foot - 4.4, north + 0.95, foot, STONE, {
      shade: lit(north, 0.95, foot - 4.4, foot, 0.22, 0.1),
    });
    const lace: Corners = [
      [north, foot - 7],
      [north + 0.75, foot - 4.4],
      [north - 0.75, foot - 4.4],
    ];
    polygon(brush, lace, STONE, { shade: lit(north, 0.7, 0, 1, 0.3, 0) });
    for (const [dx, up] of [
      [-0.8, 5.2],
      [0.8, 5.2],
      [-0.55, 5.9],
      [0.55, 5.9],
    ] as const)
      spire(brush, north + dx, foot - up - 0.75, foot - up + 0.75, 0.13, STONE);
    const point = inside(lace);
    for (const up of [5, 5.6, 6.2])
      shape(
        brush,
        north - 0.8,
        foot - up - 0.08,
        north + 0.8,
        foot - up + 0.08,
        (x, y) => Math.max(point(x, y) + 0.1, Math.abs(y - (foot - up)) - 0.045),
        DARK,
        { alpha: 0.4 },
      );
    // The south tower, nearer: plain, its octagonal spire grey with age.
    const south = left + 1;
    box(brush, south - 0.95, foot - 4.2, south + 0.95, foot, STONE, {
      shade: lit(south, 0.95, foot - 4.2, foot, 0.25, 0.1),
    });
    for (const up of [1.6, 3.2])
      shape(
        brush,
        south - 0.2,
        foot - up - 0.75,
        south + 0.2,
        foot - up,
        doorway(south, 0.14, foot - up - 0.45, 0.25, foot - up),
        DARK,
        { alpha: 0.6 },
      );
    spire(brush, south, foot - 6.4, foot - 4.2, 0.9, GRANITE, {
      shade: lit(south, 0.9, 0, 1, 0.3, 0),
    });
    line(brush, south, foot - 6.4, south, foot - 4.2, 0.03, 0.05, DARK, { alpha: 0.3 });
    // The nave: wall, buttresses, windows, the copper roof; the apse.
    box(brush, left + 3.55, foot - 2.2, left + 11.4, foot, STONE, {
      shade: lit(left + 7.5, 4, foot - 2.2, foot, 0.14, 0.14),
    });
    roof(brush, left + 3.55, left + 11.2, foot - 3.25, foot - 2.2, 0.15, COPPER, {
      shade: (_, y) => (y < foot - 2.9 ? 1.08 : 0.95),
    });
    for (let k = 0; k < 8; k++) {
      const x = left + 4 + k * 0.92;
      shape(
        brush,
        x - 0.14,
        foot - 1.9,
        x + 0.14,
        foot - 0.55,
        doorway(x, 0.13, foot - 1.6, 0.28, foot - 0.6),
        DARK,
        { alpha: 0.55 },
      );
      line(brush, x + 0.46, foot - 2.3, x + 0.46, foot, 0.08, 0.11, GRANITE, { alpha: 0.5 });
    }
    shape(brush, left + 11, foot - 2, left + 12, foot, mound(left + 11.2, foot, 0.8, 2.1), STONE, {
      shade: lit(left + 11.2, 0.8, foot - 2, foot, 0.3, 0.1),
    });
  },
  // Chambord: the white walls and their rows of windows under a forest of slate
  // roofs, turrets and chimneys, the lantern of the great stair in the middle.
  chambord(brush, left, foot) {
    shadow(brush, left + 7.5, foot, 15);
    const shade = lit(left + 7.5, 7.5, foot - 2.2, foot, 0.2, 0.1);
    box(brush, left + 0.05, foot - 2.15, left + 14.95, foot, STONE, { shade });
    // The round towers at the corners, a little proud of the walls.
    for (const x of [left + 0.75, left + 14.25])
      box(brush, x - 0.7, foot - 2.3, x + 0.7, foot, STONE, {
        shade: lit(x, 0.7, foot - 2.3, foot, 0.35, 0.1),
      });
    for (const row of [0.6, 1.45])
      for (let k = 0; k < 14; k++) {
        const x = left + 0.75 + k * 1.03;
        box(brush, x - 0.14, foot - row - 0.42, x + 0.14, foot - row, DARK, { alpha: 0.5 });
      }
    box(brush, left + 0.05, foot - 1.1, left + 14.95, foot - 0.98, GRANITE, { alpha: 0.5 });
    // The terrace and its roofs.
    box(brush, left, foot - 2.45, left + 15, foot - 2.15, SLATE);
    for (const cx of [left + 1.5, left + 5.5, left + 9.5, left + 13.5]) {
      polygon(
        brush,
        [
          [cx - 0.35, foot - 4.15],
          [cx + 0.35, foot - 4.15],
          [cx + 1.45, foot - 2.45],
          [cx - 1.45, foot - 2.45],
        ],
        SLATE,
        { shade: lit(cx, 1.4, 0, 1, 0.35, 0) },
      );
      // Dormers in the roof, a turret on its top with its little cone.
      for (const dx of [-0.65, 0.65])
        box(brush, cx + dx - 0.16, foot - 3.1, cx + dx + 0.16, foot - 2.55, CHALK, { alpha: 0.85 });
      box(brush, cx - 0.17, foot - 5.15, cx + 0.17, foot - 4.1, STONE, {
        shade: lit(cx, 0.17, 0, 1, 0.3, 0),
      });
      spire(brush, cx, foot - 5.95, foot - 5.15, 0.27, SLATE);
    }
    // Chimneys between the roofs.
    for (const x of [left + 3.5, left + 4.3, left + 10.7, left + 11.5])
      box(brush, x - 0.13, foot - 4, x + 0.13, foot - 2.45, STONE, {
        shade: lit(x, 0.13, 0, 1, 0.3, 0),
      });
    // The lantern of the great stair: white, open, crowned.
    const cx = left + 7.5;
    box(brush, cx - 0.55, foot - 3.9, cx + 0.55, foot - 2.45, STONE, {
      shade: lit(cx, 0.55, 0, 1, 0.3, 0),
    });
    for (const dx of [-0.25, 0.25])
      box(brush, dx + cx - 0.08, foot - 3.65, dx + cx + 0.08, foot - 2.75, DARK, { alpha: 0.55 });
    box(brush, cx - 0.32, foot - 5.05, cx + 0.32, foot - 3.9, STONE, {
      shade: lit(cx, 0.32, 0, 1, 0.3, 0),
    });
    shape(
      brush,
      cx - 0.4,
      foot - 5.6,
      cx + 0.4,
      foot - 5.05,
      mound(cx, foot - 5.05, 0.38, 0.45),
      SLATE,
    );
    line(brush, cx, foot - 5.5, cx, foot - 6, 0.06, 0.04, STONE);
  },
  // The third lot (B-027), the west and the south-west. The castle of the dukes of
  // Brittany: the granite curtain wall over its moat, two round towers under slate
  // cones, the white Grand Logis behind with its dormers.
  nantesCastle(brush, left, foot) {
    const cx = left + 5.5;
    shadow(brush, cx, foot, 11);
    box(brush, left + 0.3, foot - 0.3, left + 10.7, foot, PALETTE.sea, { alpha: 0.85 });
    // The Grand Logis, behind: white tuffeau, a tall slate roof, its dormers.
    box(brush, left + 3.4, foot - 3.55, left + 7.6, foot - 2.4, CHALK, {
      shade: lit(cx, 2.1, foot - 3.55, foot - 2.4, 0.2, 0),
    });
    roof(brush, left + 3.9, left + 7.1, foot - 4.7, foot - 3.55, 0.35, SLATE, {
      shade: lit(cx, 1.9, 0, 1, 0.25, 0),
    });
    for (const x of [left + 4.4, left + 5.5, left + 6.6]) {
      box(brush, x - 0.2, foot - 4.15, x + 0.2, foot - 3.55, CHALK);
      spire(brush, x, foot - 4.55, foot - 4.1, 0.27, CHALK);
      box(brush, x - 0.08, foot - 4.0, x + 0.08, foot - 3.7, DARK, { alpha: 0.6 });
    }
    // The curtain wall, its walk on corbels, the gate.
    const shade = lit(cx, 5, foot - 2.6, foot, 0.22, 0.12);
    box(brush, left + 1.5, foot - 2.45, left + 9.5, foot - 0.3, GRANITE, { shade });
    box(brush, left + 1.5, foot - 2.6, left + 9.5, foot - 2.3, GRANITE, { shade });
    box(brush, left + 1.5, foot - 2.3, left + 9.5, foot - 2.18, DARK, { alpha: 0.4 });
    shape(
      brush,
      cx - 0.45,
      foot - 1.6,
      cx + 0.45,
      foot - 0.3,
      doorway(cx, 0.36, foot - 1.1, 0.4, foot - 0.3),
      DARK,
      { alpha: 0.7 },
    );
    // The towers: round, a machicolated crown, slits, the cones.
    for (const x of [left + 1.4, left + 9.6]) {
      const drum = lit(x, 1.15, foot - 3.5, foot, 0.4, 0.1);
      box(brush, x - 1.15, foot - 3.3, x + 1.15, foot - 0.3, GRANITE, { shade: drum });
      box(brush, x - 1.25, foot - 3.55, x + 1.25, foot - 3.2, GRANITE, { shade: drum });
      for (let k = 0; k < 5; k++)
        box(brush, x - 1 + k * 0.5 - 0.07, foot - 3.2, x - 1 + k * 0.5 + 0.07, foot - 3.05, DARK, {
          alpha: 0.5,
        });
      for (const up of [1.3, 2.3])
        box(brush, x - 0.07, foot - up - 0.4, x + 0.07, foot - up, DARK, { alpha: 0.6 });
      spire(brush, x, foot - 5, foot - 3.55, 1.2, SLATE, { shade: lit(x, 1.2, 0, 1, 0.35, 0) });
    }
  },
  // Carnac: rows of standing stones of granite, running east, each its own rough
  // block, the far rows smaller, lichen on their west faces.
  carnacStones(brush, left, foot) {
    for (const [row, base, scale, start] of [
      [0, foot - 2.55, 0.55, 1.1],
      [1, foot - 1.35, 0.75, 0.6],
      [2, foot - 0.1, 1, 0.5],
    ] as const) {
      shadow(brush, left + 6.5, base + 0.05, 12.5);
      for (let k = 0; k < 7; k++) {
        const x = left + start + 0.25 * row + k * (1.6 + 0.3 * scale);
        // Each stone's height, width and lean from tables, not by chance.
        const pick = k + 3 * row;
        const tall = (MENHIRS[pick % MENHIRS.length] ?? 1) * scale;
        const half = (0.38 + 0.07 * (pick % 3)) * scale;
        const lean = (LEANS[pick % LEANS.length] ?? 0) * scale;
        const top = base - tall;
        const stone: Corners = [
          [x - half, base],
          [x - half * 0.95 + lean * 0.4, top + tall * 0.3],
          [x - half * 0.45 + lean, top],
          [x + half * 0.35 + lean, top + tall * 0.08],
          [x + half * 0.9 + lean * 0.5, top + tall * 0.4],
          [x + half, base],
        ];
        polygon(brush, stone, GRANITE, { shade: lit(x, half, top, base, 0.42, 0.18) });
        const block = inside(stone);
        shape(
          brush,
          x - half,
          top,
          x,
          base,
          (px, py) => Math.max(block(px, py) + 0.05, px - x + half * 0.3, top + tall * 0.3 - py),
          PALETTE.meadow,
          { alpha: 0.4 },
        );
      }
    }
  },
  // Guérande's salt marshes: shallow pans of brine between low clay banks, seen
  // from above, the far ones smaller; the salt drying white or pink in some, and
  // two heaps of it raked up on the banks.
  saltMarshes(brush, left, foot) {
    polygon(
      brush,
      [
        [left + 0.9, foot - 5],
        [left + 12.1, foot - 5],
        [left + 12.9, foot],
        [left + 0.1, foot],
      ],
      CLAY,
      { shade: (_, y) => 0.92 + 0.1 * clamp((foot - y) / 5, 0, 1) },
    );
    for (const [row, top, bottom] of [
      [0, foot - 4.75, foot - 3.7],
      [1, foot - 3.45, foot - 2.05],
      [2, foot - 1.8, foot - 0.2],
    ] as const) {
      // Each row's pans, by the cuts between them: from tables, not by chance, the
      // banks running a little aslant.
      const cuts = PANS[row];
      const slant = 0.12 * (row + 1);
      const from = left + 0.95 - 0.4 * row;
      const to = left + 12.05 + 0.4 * row;
      for (let k = 0; k + 1 < cuts.length; k++) {
        const a = from + (to - from) * (cuts[k] ?? 0) + 0.12;
        const b = from + (to - from) * (cuts[k + 1] ?? 1) - 0.12;
        const tilt = (k % 2 === 0 ? 1 : -1) * slant * (k === 0 || k + 2 === cuts.length ? 0 : 1);
        // What each pan holds, by a rule: brine mostly, salt drying in some.
        const kind = (k + 2 * row) % 5;
        const colour = kind === 0 ? BRINE_SALT : kind === 3 ? BRINE_PINK : BRINE;
        polygon(
          brush,
          [
            [a + tilt, top],
            [b + tilt, top],
            [b, bottom],
            [a, bottom],
          ],
          colour,
          { shade: (_, y) => 1.05 - 0.1 * clamp((y - top) / (bottom - top), 0, 1) },
        );
      }
    }
    for (const [cx, up] of [
      [left + 2.4, 4.9],
      [left + 8.6, 4.9],
    ] as const) {
      const base = foot - up;
      shadow(brush, cx + 0.3, base, 2.4);
      polygon(
        brush,
        [
          [cx - 0.12, base - 1.9],
          [cx + 0.12, base - 1.9],
          [cx + 1.05, base],
          [cx - 1.05, base],
        ],
        CHALK,
        { shade: lit(cx, 1, base - 1.9, base, 0.32, 0.05) },
      );
    }
  },
  // The Dune du Pilat: a long slope of sand up from the ocean's foam, rippled by the
  // wind, and a steeper face down into the pines.
  pilatDune(brush, left, foot) {
    const crest = left + 8;
    const high = 3.7;
    const west = left + 0.2;
    const east = left + 11.4;
    const height = (x: number): number => {
      if (x <= west || x >= east) return 0;
      if (x <= crest) {
        const t = (x - west) / (crest - west);
        return high * t * t * (3 - 2 * t);
      }
      const s = (x - crest) / (east - crest);
      return high * (1 - s * s);
    };
    foam(brush, left - 0.2, left + 2.2, foot);
    // The pines, behind the dune's foot, then the dune, then the nearer pines.
    for (const [x, up, r] of PINES_BEHIND)
      disc(brush, left + x, foot - up, r, PALETTE.forest, {
        shade: lit(left + x, r, 0, 1, 0.35, 0),
      });
    shape(
      brush,
      west,
      foot - high,
      east,
      foot,
      (x, y) => Math.max(foot - height(x) - y, y - foot),
      PALETTE.sand,
      {
        shade: (x) =>
          x <= crest
            ? 1.05 - 0.08 * ((crest - x) / (crest - west))
            : 0.86 - 0.1 * clamp((x - crest) / (east - crest), 0, 1),
      },
    );
    // The ripples on the windward side, and the crest's sharp line.
    for (const k of [0, 1, 2, 3, 4]) {
      const x0 = left + 2.4 + k * 1.05;
      const y0 = foot - height(x0) + 0.3;
      line(brush, x0, y0 + 0.25, x0 + 0.75, y0 - 0.15, 0.06, 0.06, PALETTE.field, { alpha: 0.55 });
    }
    for (const [x, up, r] of PINES_FRONT)
      disc(brush, left + x, foot - up, r, PALETTE.forest, {
        shade: lit(left + x, r, 0, 1, 0.35, 0),
      });
  },
  // Fort Boyard: the long oval of pale stone in the sea, its two rows of gun ports,
  // the parapet, the watch turret; the foam at its foot.
  fortBoyard(brush, left, foot) {
    const cx = left + 4.5;
    foam(brush, left - 0.2, left + 9.2, foot);
    box(brush, left + 0.2, foot - 0.6, left + 8.8, foot - 0.05, GRANITE, {
      shade: lit(cx, 4.3, 0, 1, 0.3, 0),
    });
    const shade = (x: number, y: number): number => {
      // A long drum, lit from the west: darker towards its curved ends.
      const u = (x - cx) / 4.2;
      return (
        (0.78 + 0.26 * Math.sqrt(clamp(1 - u * u, 0, 1)) - 0.06 * u) * (y > foot - 1 ? 0.95 : 1)
      );
    };
    box(brush, left + 0.3, foot - 3.15, left + 8.7, foot - 0.55, OCHRE, { shade });
    box(brush, left + 0.45, foot - 3.4, left + 8.55, foot - 3.1, OCHRE, { shade });
    for (const [up, step] of [
      [1.25, 0.82],
      [2.35, 0.82],
    ] as const)
      for (let k = 0; k < 10; k++) {
        const x = left + 0.82 + k * step;
        shape(
          brush,
          x - 0.15,
          foot - up - 0.45,
          x + 0.15,
          foot - up,
          doorway(x, 0.11, foot - up - 0.25, 0.15, foot - up),
          DARK,
          { alpha: 0.55 },
        );
      }
    box(brush, left + 0.3, foot - 1.75, left + 8.7, foot - 1.65, DARK, { alpha: 0.25 });
    // The watch turret on the parapet.
    box(brush, left + 6.35, foot - 4, left + 7.05, foot - 3.35, OCHRE, {
      shade: lit(left + 6.7, 0.35, 0, 1, 0.3, 0),
    });
    box(brush, left + 6.25, foot - 4.1, left + 7.15, foot - 3.95, GRANITE);
  },
  // The Place de la Bourse: the long front of pale stone, its two pavilions with
  // their pediments and tall roofs, the arcades, the slate roofs and dormers; the
  // quay at its foot. The water mirror is not drawn (P-028).
  placeDeLaBourse(brush, left, foot) {
    shadow(brush, left + 6.5, foot - 0.6, 13);
    box(brush, left - 0.1, foot - 0.65, left + 13.1, foot, QUAY, {
      shade: (_, y) => (y > foot - 0.2 ? 0.85 : 1),
    });
    const shade = lit(left + 6.5, 6.5, foot - 3.5, foot - 0.6, 0.16, 0.1);
    // The long roof and its dormers.
    roof(brush, left + 0.4, left + 12.6, foot - 4.15, foot - 3.35, 0.3, SLATE);
    for (let k = 0; k < 12; k++) {
      const x = left + 0.75 + k * 1.05;
      box(brush, x - 0.13, foot - 3.85, x + 0.13, foot - 3.4, STONE, { alpha: 0.9 });
    }
    box(brush, left + 0.05, foot - 3.4, left + 12.95, foot - 0.6, STONE, { shade });
    box(brush, left + 0.05, foot - 3.5, left + 12.95, foot - 3.3, CHALK, { shade });
    // The pavilions: a little proud, their roofs higher, their pediments.
    for (const cx of [left + 3, left + 10]) {
      roof(brush, cx - 0.9, cx + 0.9, foot - 5, foot - 3.9, 0.55, SLATE, {
        shade: lit(cx, 1.4, 0, 1, 0.3, 0),
      });
      box(brush, cx - 1.45, foot - 3.9, cx + 1.45, foot - 0.6, STONE, {
        shade: lit(cx, 1.45, foot - 3.9, foot - 0.6, 0.18, 0.1),
      });
      polygon(
        brush,
        [
          [cx, foot - 4.45],
          [cx + 1.5, foot - 3.85],
          [cx - 1.5, foot - 3.85],
        ],
        CHALK,
        { shade: lit(cx, 1.5, 0, 1, 0.15, 0) },
      );
      for (const dx of [-1.05, 1.05])
        box(brush, cx + dx - 0.1, foot - 3.75, cx + dx + 0.1, foot - 0.6, CHALK, { alpha: 0.7 });
    }
    // The arcades of the ground floor, the windows above.
    for (let k = 0; k < 13; k++) {
      const x = left + 0.5 + k * 1;
      shape(
        brush,
        x - 0.28,
        foot - 1.75,
        x + 0.28,
        foot - 0.6,
        doorway(x, 0.24, foot - 1.4, 0.24, foot - 0.6),
        DARK,
        { alpha: 0.55 },
      );
      box(brush, x - 0.15, foot - 3.05, x + 0.15, foot - 2.25, DARK, { alpha: 0.5 });
    }
    box(brush, left + 0.05, foot - 2.05, left + 12.95, foot - 1.95, GRANITE, { alpha: 0.45 });
  },
  // The Cité de Carcassonne: the outer ring of walls, low, its small towers; behind
  // it the inner ring, higher, its tall towers; ochre stone, battlements, the
  // pointed slate roofs of the restoration.
  carcassonne(brush, left, foot) {
    shadow(brush, left + 7.5, foot, 15);
    const shade = lit(left + 7.5, 7.5, foot - 4.2, foot, 0.2, 0.12);
    // The inner ring, behind.
    box(brush, left + 0.6, foot - 4.1, left + 14.4, foot - 2, OCHRE, { shade });
    merlons(brush, left + 0.6, left + 14.4, foot - 4.1, OCHRE);
    for (const x of [left + 1.5, left + 5.5, left + 9.5, left + 13.5]) {
      const drum = lit(x, 0.85, 0, 1, 0.4, 0);
      box(brush, x - 0.85, foot - 5.35, x + 0.85, foot - 2, OCHRE, { shade: drum });
      box(brush, x - 0.07, foot - 4.6, x + 0.07, foot - 4.1, DARK, { alpha: 0.6 });
      spire(brush, x, foot - 6.95, foot - 5.35, 1, SLATE, { shade: lit(x, 1, 0, 1, 0.35, 0) });
    }
    // The lists between the rings, then the outer ring and its towers.
    box(brush, left + 0.2, foot - 2.05, left + 14.8, foot - 1.85, PALETTE.meadow, { alpha: 0.7 });
    box(brush, left + 0.1, foot - 1.9, left + 14.9, foot, OCHRE, {
      shade: lit(left + 7.5, 7.5, foot - 1.9, foot, 0.22, 0.14),
    });
    merlons(brush, left + 0.1, left + 14.9, foot - 1.9, OCHRE);
    for (let k = 0; k < 8; k++) {
      const x = left + 0.5 + k * 2;
      box(brush, x - 0.48, foot - 2.6, x + 0.48, foot, OCHRE, {
        shade: lit(x, 0.48, 0, 1, 0.4, 0),
      });
      box(brush, x - 0.05, foot - 1.6, x + 0.05, foot - 1.2, DARK, { alpha: 0.55 });
      spire(brush, x, foot - 3.45, foot - 2.6, 0.6, SLATE, { shade: lit(x, 0.6, 0, 1, 0.35, 0) });
    }
    // The Porte Narbonnaise's way in, between two towers of the outer ring.
    shape(
      brush,
      left + 7.1,
      foot - 1.2,
      left + 7.9,
      foot,
      doorway(left + 7.5, 0.3, foot - 0.75, 0.35, foot),
      DARK,
      { alpha: 0.7 },
    );
  },
};

/** The heights of Carnac's stones, in scene pixels, along a row: a table, not chance. */
const MENHIRS = [1.7, 1.35, 1.55, 1.15, 1.45, 1.05, 1.25, 0.95] as const;
/** Where the banks cut each row of Guérande's pans, from 0 (west) to 1 (east), far row first. */
const PANS = [
  [0, 0.21, 0.37, 0.62, 0.8, 1],
  [0, 0.15, 0.4, 0.55, 0.77, 1],
  [0, 0.24, 0.42, 0.66, 0.85, 1],
] as const;
/** How far each stone's top leans, east or west. */
const LEANS = [0.08, -0.1, 0.02, 0.12, -0.06, 0.1, -0.12] as const;
/** The pines by the Dune du Pilat: (x from the box's left, height of the centre, radius). */
const PINES_BEHIND = [
  [9.9, 1.1, 0.6],
  [10.9, 1.4, 0.7],
  [12, 1.2, 0.65],
  [12.7, 1.5, 0.5],
] as const;
const PINES_FRONT = [
  [10.6, 0.45, 0.55],
  [11.6, 0.6, 0.6],
  [12.5, 0.45, 0.5],
] as const;

/** Battlements along the top of a wall from x0 to x1 at `top`. */
function merlons(brush: Brush, x0: number, x1: number, top: number, colour: Rgb): void {
  for (let x = x0 + 0.12; x + 0.24 <= x1; x += 0.48)
    box(brush, x, top - 0.18, x + 0.24, top + 0.02, colour, { shade: lit(x, 0.12, 0, 1, 0.2, 0) });
}

/** The sprites that have a drawing of their own here. */
export const MODERN_LANDMARK_SPRITES: readonly LandmarkSprite[] = Object.keys(
  DRAWINGS,
) as LandmarkSprite[];

/**
 * Draws a landmark, the middle of its bottom row at pixel (ax, ay) and the left of
 * its box at `left` (./landmarks.ts's `landmarkBox`). False, and nothing drawn, when
 * it has no drawing here yet.
 */
export function drawModernLandmark(
  brush: Brush,
  landmark: Landmark,
  left: number,
  ay: number,
): boolean {
  const drawing = DRAWINGS[landmark.sprite];
  if (drawing === undefined) return false;
  drawing(brush, left, ay + 1);
  return true;
}
