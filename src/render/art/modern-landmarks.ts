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
  inside,
  lamp,
  line,
  polygon,
  round,
  shadow,
} from "./shapes.ts";

const CHALK: Rgb = [242, 240, 230];
const STONE: Rgb = [226, 220, 204];
const GRANITE: Rgb = [150, 146, 136];
const QUAY: Rgb = [150, 150, 146];
const SLATE: Rgb = [70, 84, 104];
const IRON: Rgb = [62, 68, 76];
const FOAM = PALETTE.foam;
const RED = PALETTE.roof;

/** A drawing: the landmark's box starts at `left`, and it stands on `foot`. */
type Drawing = (brush: Brush, left: number, foot: number) => void;

/** Foam along a waterline from x0 to x1. */
function foam(brush: Brush, x0: number, x1: number, foot: number): void {
  brush.spot((x0 + x1) / 2, foot, (x1 - x0) / 2 + 0.8, 0.8, FOAM, 0.75);
}

/**
 * A generic lighthouse, its axis at `x`: a white tower narrowing to a gallery, a
 * lantern (lit at night) under a red cap; with a dark band or not.
 */
function lighthouse(brush: Brush, x: number, base: number, top: number, band: boolean): void {
  const lantern = top + 1.5;
  line(brush, x, base, x, lantern + 0.3, 0.68, 0.46, CHALK, { shade: round(x, 0.6, 0.25) });
  if (band) {
    const y = (base + lantern) / 2;
    box(brush, x - 0.56, y - 0.45, x + 0.56, y + 0.45, PALETTE.seaDeep);
  }
  box(brush, x - 0.7, lantern, x + 0.7, lantern + 0.25, DARK);
  if (brush.emissive) lamp(brush, x, lantern - 0.4, 0.4);
  else box(brush, x - 0.4, lantern - 0.8, x + 0.4, lantern, DARK);
  polygon(
    brush,
    [
      [x, top],
      [x + 0.65, lantern - 0.8],
      [x - 0.65, lantern - 0.8],
    ],
    RED,
  );
}

/** A ship-to-shore crane, its landward leg at `x`: two legs, a boom out over the ship. */
function crane(brush: Brush, x: number, foot: number): void {
  const boom = foot - 4.6;
  line(brush, x + 0.5, foot, x + 0.5, boom, 0.3, 0.3, RED);
  line(brush, x + 4.5, foot, x + 4.5, boom, 0.3, 0.3, RED);
  line(brush, x + 0.5, foot - 2.2, x + 4.5, foot - 2.2, 0.16, 0.16, RED);
  line(brush, x + 0.2, boom, x + 5.8, boom, 0.34, 0.3, RED);
  // The apex, and the stays down to the boom.
  line(brush, x + 0.5, boom, x + 0.5, boom - 1.1, 0.24, 0.2, RED);
  line(brush, x + 0.5, boom - 1.1, x + 5.6, boom - 0.2, 0.12, 0.12, RED);
  if (brush.emissive) lamp(brush, x + 0.5, boom - 1.25, 0.32);
}

/** The colours of a row of containers, as the pixel art's. */
const CONTAINERS: readonly Rgb[] = [
  PALETTE.solar,
  PALETTE.hydro,
  PALETTE.thermal,
  PALETTE.nuclear,
  PALETTE.roof,
  PALETTE.solar,
  PALETTE.hydro,
  PALETTE.roof,
  PALETTE.thermal,
  PALETTE.nuclear,
  PALETTE.hydro,
  PALETTE.solar,
  PALETTE.roof,
  PALETTE.solar,
  PALETTE.thermal,
];

/** The half-width of the Eiffel Tower's outline at a height above the ground. */
function eiffelHalf(up: number): number {
  // Four straight runs between the ground, the two platforms and the top.
  if (up < 2.6) return 4 - (up / 2.6) * 1.3;
  if (up < 6) return 2.7 - ((up - 2.6) / 3.4) * 1.55;
  return 1.15 - ((clamp(up, 6, 12) - 6) / 6) * 1.03;
}

const DRAWINGS: Readonly<Partial<Record<LandmarkSprite, Drawing>>> = {
  // The needle (west) and the arch, white chalk under the grass, in the foam.
  etretat(brush, left, foot) {
    foam(brush, left, left + 13, foot);
    polygon(
      brush,
      [
        [left + 2.3, foot - 5],
        [left + 3.1, foot],
        [left + 0.9, foot],
      ],
      CHALK,
      { shade: round(left + 2, 1.1, 0.25) },
    );
    const cliff = inside([
      [left + 5.2, foot],
      [left + 5.5, foot - 4.8],
      [left + 6.6, foot - 6],
      [left + 12.2, foot - 6],
      [left + 13, foot - 5],
      [left + 13, foot],
    ]);
    // The arch: a doorway with a round head, cut through the cliff.
    const door = (x: number, y: number): number => {
      const dx = Math.abs(x - (left + 9)) - 1.6;
      const head = foot - 3;
      if (y > head) return dx;
      const ex = x - (left + 9);
      return Math.sqrt(ex * ex + (y - head) * (y - head)) - 1.6;
    };
    const arch = (x: number, y: number): number => Math.max(cliff(x, y), -door(x, y));
    brush.fill(left + 4, foot - 7, left + 14, foot + 1, arch, CHALK, {
      shade: (x) => 1 - 0.22 * clamp((x - left - 5) / 8, 0, 1),
    });
    brush.fill(
      left + 4,
      foot - 7,
      left + 14,
      foot - 5,
      (x, y) => Math.max(arch(x, y), y - (foot - 5.5)),
      PALETTE.meadow,
    );
  },
  // Two ship-to-shore cranes over a row of containers; a light on each top at night.
  portCranes(brush, left, foot) {
    shadow(brush, left + 7.5, foot, 15);
    box(brush, left, foot - 1, left + 15, foot, QUAY);
    for (const [k, colour] of CONTAINERS.entries())
      box(brush, left + k + 0.08, foot - 1.9, left + k + 0.92, foot - 1, colour);
    crane(brush, left, foot - 1);
    crane(brush, left + 8, foot - 1);
  },
  // A lighthouse at the end of a jetty.
  harbourLight(brush, left, foot) {
    foam(brush, left, left + 7, foot);
    box(brush, left, foot - 1, left + 7, foot, GRANITE);
    box(brush, left + 0.2, foot - 1.9, left + 2.8, foot - 1, GRANITE, {
      shade: round(left + 1.5, 1.3),
    });
    lighthouse(brush, left + 1.5, foot - 1.7, foot - 6, false);
  },
  // The abbey on its rock: the spire and its gilded archangel, the village's roofs
  // at the foot, the sands around.
  montSaintMichel(brush, left, foot) {
    const cx = left + 5.5;
    brush.spot(cx, foot, 6.5, 1, PALETTE.sand, 0.9);
    // The rock: a mound, lit from the west.
    brush.fill(
      left,
      foot - 5,
      left + 11,
      foot + 1,
      (x, y) => {
        const dx = (x - cx) / 4.7;
        const dy = (y - foot) / 4.2;
        return Math.max((Math.sqrt(dx * dx + dy * dy) - 1) * 4.2, y - foot);
      },
      GRANITE,
      { shade: round(cx, 4.7, 0.3) },
    );
    box(brush, left + 1.3, foot - 1.7, left + 3.2, foot - 0.9, RED);
    box(brush, left + 7.9, foot - 1.7, left + 9.6, foot - 0.9, RED);
    box(brush, left + 2.6, foot - 5, left + 8.4, foot - 2.6, STONE, { shade: round(cx, 2.9) });
    box(brush, left + 4, foot - 6, left + 7, foot - 5, STONE, { shade: round(cx, 1.5) });
    box(brush, left + 4, foot - 6, left + 7, foot - 5.7, SLATE);
    polygon(
      brush,
      [
        [cx, foot - 8.5],
        [cx + 0.5, foot - 6],
        [cx - 0.5, foot - 6],
      ],
      GRANITE,
    );
    disc(brush, cx, foot - 8.65, 0.3, PALETTE.nuclear);
  },
  // The iron tower, a dark silhouette, lit plainly at night (P-008): its lamps, no
  // beam, no sparkle (P-009).
  eiffelTower(brush, left, foot) {
    const cx = left + 4.5;
    shadow(brush, cx, foot, 8);
    const iron = PALETTE.seaDeep;
    // The outline, less the opening between the legs under the first platform.
    brush.fill(
      left,
      foot - 12.5,
      left + 9,
      foot + 1,
      (x, y) => {
        const up = foot - y;
        const outline = Math.max(Math.abs(x - cx) - eiffelHalf(up), -up, up - 12);
        const dx = (x - cx) / 2.9;
        const dy = up / 2.1;
        const opening = (Math.sqrt(dx * dx + dy * dy) - 1) * 2.1;
        return Math.max(outline, -opening);
      },
      iron,
    );
    // The platforms, a little wider than the tower there.
    box(brush, cx - 3, foot - 2.9, cx + 3, foot - 2.45, iron);
    box(brush, cx - 1.5, foot - 6.2, cx + 1.5, foot - 5.85, iron);
    box(brush, cx - 0.5, foot - 10.9, cx + 0.5, foot - 10.6, iron);
    if (!brush.emissive) return;
    for (const [dx, up] of [
      [0, 11.5],
      [0, 8.5],
      [0, 5.5],
      [-1.2, 2.7],
      [1.2, 2.7],
    ] as const)
      lamp(brush, cx + dx, foot - up, 0.3);
  },
  // Rouen cathedral: pale stone, the cast-iron spire (dark), and west of it the
  // Gros-Horloge (P-042), an arch over the street, its gold dial.
  rouenCathedral(brush, left, foot) {
    shadow(brush, left + 6.5, foot, 12);
    // The Gros-Horloge: a pavilion on an arch.
    brush.fill(
      left,
      foot - 4,
      left + 4.5,
      foot + 1,
      (x, y) => {
        const cx = left + 2;
        const pavilion = Math.max(Math.abs(x - cx) - 1.8, foot - 3 - y, y - foot);
        const ex = x - cx;
        const street =
          y > foot - 1
            ? Math.abs(ex) - 0.9
            : Math.sqrt(ex * ex + (y - (foot - 1)) * (y - (foot - 1))) - 0.9;
        return Math.max(pavilion, -street);
      },
      GRANITE,
      { shade: round(left + 2, 1.8) },
    );
    disc(brush, left + 2, foot - 2.35, 0.5, PALETTE.nuclear);
    // The cathedral: the west front's tower, the nave under its slate roof, the
    // crossing tower and its spire.
    box(brush, left + 4.2, foot - 4.3, left + 6, foot, STONE, { shade: round(left + 5.1, 0.9) });
    polygon(
      brush,
      [
        [left + 5.1, foot - 5.2],
        [left + 6, foot - 4.3],
        [left + 4.2, foot - 4.3],
      ],
      STONE,
    );
    box(brush, left + 6, foot - 2.4, left + 12, foot, STONE, { shade: round(left + 9, 3, 0.12) });
    polygon(
      brush,
      [
        [left + 6.4, foot - 3.3],
        [left + 11.6, foot - 3.3],
        [left + 12, foot - 2.4],
        [left + 6, foot - 2.4],
      ],
      SLATE,
    );
    box(brush, left + 7.5, foot - 5, left + 9.5, foot - 2.4, STONE, {
      shade: round(left + 8.5, 1),
    });
    polygon(
      brush,
      [
        [left + 8.5, foot - 10],
        [left + 9.4, foot - 5],
        [left + 7.6, foot - 5],
      ],
      IRON,
    );
  },
  // A generic lighthouse on a rock at sea: white with a dark band, its light at night.
  seaLighthouse(brush, left, foot) {
    const cx = left + 1.5;
    foam(brush, left - 0.5, left + 3.5, foot);
    brush.fill(
      left - 1,
      foot - 2.5,
      left + 4,
      foot + 1,
      (x, y) => {
        const dx = (x - cx) / 1.7;
        const dy = (y - foot) / 1.5;
        return Math.max((Math.sqrt(dx * dx + dy * dy) - 1) * 1.5, y - foot);
      },
      GRANITE,
      { shade: round(cx, 1.7, 0.3) },
    );
    lighthouse(brush, cx, foot - 1.2, foot - 8, true);
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
