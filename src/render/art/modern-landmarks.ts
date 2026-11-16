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
};

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
