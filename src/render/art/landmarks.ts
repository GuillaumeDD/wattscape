/**
 * The landmarks' sprites (B-015, ARCHITECTURE § Art direction): drawn in code from
 * small pixel maps, in the palette, like the plants (./plants.ts). Each is GO in
 * docs/POI.md: a natural site (Étretat's arch and needle, a dune, a summit), a
 * generic scene (a container terminal's cranes, a harbour's jetty and lighthouse) or
 * a work in the public domain (B-016), drawn from its silhouette, never traced.
 * Still, except for their lights, lit at night.
 */
import { type Landmark, type LandmarkSprite } from "../../map/landmarks.ts";
import { type ColourName } from "../palette.ts";
import { type Pen } from "./plants.ts";

/** A pixel map: one character per pixel, `.` transparent; rows top to bottom. */
type PixelMap = readonly string[];

/** What each character draws. `L` is a light, lit at night. */
export const LANDMARK_INK: Readonly<Record<string, ColourName>> = {
  w: "snow",
  g: "rock",
  f: "foam",
  r: "roof",
  n: "nuclear",
  h: "hydro",
  o: "solar",
  t: "thermal",
  s: "sand",
  d: "soil",
  b: "sea",
  e: "forest",
  p: "skyGolden",
  k: "seaDeep",
  L: "rock",
};

/** The sprites, anchored at the middle of their bottom row. */
export const LANDMARK_SPRITES: Readonly<Record<LandmarkSprite, PixelMap>> = {
  // The needle (west) and the arch, white chalk standing in the foam.
  etretat: [
    "......wwwwww.",
    "..w..wwwwwwwg",
    "..w..ww....wg",
    ".ww..wg....wg",
    ".wg..wg....wg",
    "fwgffwgffffwg",
  ],
  // Two ship-to-shore cranes over a row of containers; a red light on each top.
  portCranes: [
    "L.......L......",
    "rrrrrr..rrrrrr.",
    "r...r...r...r..",
    "r...r...r...r..",
    "r...r...r...r..",
    "ohtnrohrtnhorot",
    "ggggggggggggggg",
  ],
  // A lighthouse at the end of a jetty: white, a red lantern, its light at night.
  harbourLight: [".r.....", ".L.....", ".w.....", ".w.....", "gwg....", "ggggggg"],
  // The abbey on its rock: the spire and its gilded archangel, the village's roofs
  // at the foot, the sands around.
  montSaintMichel: [
    ".....n.....",
    ".....g.....",
    ".....g.....",
    "....ggg....",
    "...wgggw...",
    "..wwwgwww..",
    "..rgwwwgr..",
    ".rrggggrrg.",
    "ssggggggggs",
  ],
  // The iron tower, a dark silhouette over the roofs of Paris, lit plainly at night
  // (P-008): no beam, no sparkle (P-009).
  eiffelTower: [
    "....L....",
    "....k....",
    "....k....",
    "...kLk...",
    "....k....",
    "...k.k...",
    "...kLk...",
    "..k...k..",
    "..k...k..",
    ".kkLkLkk.",
    ".k.....k.",
    "kk.....kk",
  ],
  // The twin heaps of a coal mine, dark cones on the plain.
  slagHeaps: ["..d.....d..", ".ddd...ddd.", "ddddd.ddddd", "ddddddddddd"],
  // Pink sandstone, one spire only, over the west front; the nave's slate roof.
  strasbourgCathedral: [
    ".p......",
    ".p......",
    ".p......",
    "ppp.....",
    "ppp.....",
    "ppppp...",
    "pppbbbbb",
    "pppppppp",
    "pppppppp",
  ],
  // White stone under a forest of slate roofs, turrets and the lantern tower.
  chambord: [
    ".b...b.w.b...b.",
    ".b..bb.w.bb..b.",
    "bbb.bbbwbbb.bbb",
    "bbbbbbbbbbbbbbb",
    "wwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwww",
  ],
  // The glazed roof in lozenges of colour, over the timber gallery.
  beauneHospices: [
    ".g...g...g.",
    "nrnrnrnrnrn",
    "rndnrndnrnd",
    "nrnrnrnrnrn",
    "ttttttttttt",
    "wgwgwgwgwgw",
  ],
  // Granite walls and round towers under slate cones, the white palace inside.
  nantesCastle: [".b.......b.", "bbb.www.bbb", "ggg.www.ggg", "ggggggggggg", "ggggggggggg"],
  // Rows of standing stones.
  carnacStones: ["w.w.w.w.w.w.w", "g.g.g.g.g.g.g", ".w.w.w.w.w.w.", ".g.g.g.g.g.g."],
  // The dune between the ocean (west) and the pine forest (east).
  pilatDune: [".....sss.....", "...sssssss...", ".sssssssssse.", "fssssssssssee"],
  // Three tiers of arches in pale stone, over the river.
  pontDuGard: [
    "sssssssssssssss",
    "s.s.s.s.s.s.s.s",
    ".sssssssssssss.",
    ".s...s...s...s.",
    "...sssssssss...",
    "...s...s...s...",
    "hhhshhhshhhshhh",
  ],
  // The white basilica and its four towers on the hill over Lyon.
  fourviere: ["w.....w", "w.....w", "ww...ww", "wwwwwww", "wwwwwww", "wgwgwgw", "ggggggg"],
  // The second lot (D-048). Rouen cathedral: pale stone, the cast-iron spire (dark),
  // and west of it the Gros-Horloge (P-042), an arch over the street, its gold dial.
  rouenCathedral: [
    "........k...",
    "........k...",
    "........k...",
    ".......kkk..",
    ".......kkk..",
    "......wwkww.",
    "...w.wwwwwww",
    "ggggwwbbbbww",
    "gn.gwwwwwwww",
    "g..gwwwwwwww",
  ],
  // Lille's belfry: a tall pale tower, its dark lantern and spire.
  lilleBelfry: [
    "..k..",
    "..k..",
    ".kkk.",
    ".kpk.",
    ".ppp.",
    ".ppp.",
    ".ppp.",
    ".ppp.",
    ".ppp.",
    "ppppp",
  ],
  // Amiens cathedral: two short towers on the west front, the long nave, the thin spire.
  amiensCathedral: [
    "........k...",
    "........k...",
    "w.w.....k...",
    "www....kkk..",
    "wwwbbbbbbbbb",
    "wwwwwwwwwwww",
    "wwwwwwwwwwww",
  ],
  // Haut-Kœnigsbourg: red sandstone walls and roofs on its wooded hill, the square keep.
  hautKoenigsbourg: [
    "....rr.....",
    "....pp.....",
    "..rrpp.rr..",
    "..pppppppr.",
    ".ppppppppp.",
    "eeeeeeeeeee",
  ],
  // Chartres: two different spires (the plain one south, the lacy one north), the
  // copper roof of the nave, dark green.
  chartresCathedral: [
    "..w.........",
    ".kw.........",
    ".kw.........",
    "kkww........",
    "kkwweeeeeeee",
    "wwwwwwwwwwww",
    "wwwwwwwwwwww",
  ],
  // Besançon's citadel: Vauban's walls along the ridge, two bastions.
  besanconCitadel: [".g.......g.", "ggg.www.ggg", "ggggggggggg", "eeeeeeeeeee"],
  // Fort Boyard: an oval of stone in the sea, the foam at its foot.
  fortBoyard: [".ggggggg.", "gwgwgwgwg", "ggggggggg", "fffffffff"],
  // The Place de la Bourse: the long pale front and its dark roofs, along the river.
  placeDeLaBourse: [
    "..bbb...bbb..",
    "bbwwwbbbwwwbb",
    "wwwwwwwwwwwww",
    "wgwgwgwgwgwgw",
    "hhhhhhhhhhhhh",
  ],
  // The Cité de Carcassonne: two rings of walls and their towers under slate cones.
  carcassonne: [
    ".b...b...b...b.",
    "bbb.bbb.bbb.bbb",
    "ggg.ggg.ggg.ggg",
    "ggggggggggggggg",
    "b.b.b.b.b.b.b.b",
    "ggggggggggggggg",
    "ggggggggggggggg",
  ],
  // The basilica on its rock, the gilded statue on the bell tower.
  notreDameDeLaGarde: [
    "..n....",
    "..n....",
    "..w....",
    "..w....",
    "..w....",
    "..wwww.",
    "..wwwww",
    ".ggwwwg",
    "ggggggg",
  ],
};

/** Draws a landmark, the middle of its bottom row at (ax, ay). */
export function drawLandmark(pen: Pen, landmark: Landmark, ax: number, ay: number): void {
  const map = LANDMARK_SPRITES[landmark.sprite];
  const width = Math.max(...map.map((row) => row.length));
  const left = ax - Math.floor(width / 2);
  const top = ay - map.length + 1;
  for (let r = 0; r < map.length; r++) {
    const row = map[r] ?? "";
    for (let c = 0; c < row.length; c++) {
      const ch = row[c] ?? ".";
      if (ch === ".") continue;
      if (ch === "L" && pen.emissive) pen.glow(left + c, top + r);
      else pen.put(left + c, top + r, LANDMARK_INK[ch] ?? "rock");
    }
  }
}
