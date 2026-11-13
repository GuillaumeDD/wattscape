/**
 * The landmarks' sprites (B-015, ARCHITECTURE § Art direction): drawn in code from
 * small pixel maps, in the palette, like the plants (./plants.ts). Each is GO in
 * docs/POI.md: a natural site (Étretat's arch and needle) or a generic scene (a
 * container terminal's cranes, a harbour's jetty and lighthouse). Still, except for
 * their lights, lit at night.
 */
import { type Landmark, type LandmarkSprite } from "../../map/landmarks.ts";
import { type ColourName } from "../palette.ts";
import { type Pen } from "./plants.ts";

/** A pixel map: one character per pixel, `.` transparent; rows top to bottom. */
type PixelMap = readonly string[];

/** What each character draws. `L` is a light, lit at night. */
const INK: Readonly<Record<string, ColourName>> = {
  w: "snow",
  g: "rock",
  f: "foam",
  r: "roof",
  n: "nuclear",
  h: "hydro",
  o: "solar",
  t: "thermal",
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
      else pen.put(left + c, top + r, INK[ch] ?? "rock");
    }
  }
}
