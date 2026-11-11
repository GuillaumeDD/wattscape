/**
 * The fixed palette of the scene (ARCHITECTURE § Art direction, proposed until the
 * mockups of B-010 are validated): 24 colours, and for each the palette colour it
 * becomes one step darker, so that light changes stay in palette. Pure data.
 */

export type Rgb = readonly [number, number, number];

/** Every colour of the palette, by name. The order is the palette's index order. */
export const COLOUR_NAMES = [
  // Sea, deep to light.
  "seaDeep",
  "sea",
  "seaShallow",
  "foam",
  // Land, muted: the energy stands out against it.
  "forest",
  "grass",
  "meadow",
  "field",
  "sand",
  "soil",
  "rock",
  "snow",
  "roof",
  // Sky, night to day.
  "skyNight",
  "skyBlueHour",
  "skyGolden",
  "skyDay",
  // One signature colour per source, also used in the legend.
  "nuclear",
  "hydro",
  "wind",
  "solar",
  "thermal",
  "bioenergy",
  // Lit windows, beacons: drawn at night, untinted.
  "lamp",
] as const;

export type ColourName = (typeof COLOUR_NAMES)[number];

export const PALETTE: Readonly<Record<ColourName, Rgb>> = {
  seaDeep: [0x1b, 0x2a, 0x4a],
  sea: [0x24, 0x40, 0x6a],
  seaShallow: [0x2f, 0x5d, 0x8a],
  foam: [0x9f, 0xc0, 0xd2],
  forest: [0x2f, 0x4a, 0x35],
  grass: [0x55, 0x75, 0x45],
  meadow: [0x86, 0x98, 0x5c],
  field: [0xb8, 0xa2, 0x63],
  sand: [0xdc, 0xca, 0x9c],
  soil: [0x6e, 0x52, 0x3a],
  rock: [0x8b, 0x86, 0x80],
  snow: [0xee, 0xf0, 0xee],
  roof: [0xa4, 0x4f, 0x3d],
  skyNight: [0x0e, 0x11, 0x22],
  skyBlueHour: [0x33, 0x34, 0x66],
  skyGolden: [0xe3, 0x9a, 0x6a],
  skyDay: [0x9c, 0xc6, 0xe2],
  nuclear: [0xf2, 0xc1, 0x4e],
  hydro: [0x3f, 0x8f, 0xd8],
  wind: [0x82, 0xd8, 0xc6],
  solar: [0xf0, 0x86, 0x22],
  thermal: [0x8c, 0x76, 0x66],
  bioenergy: [0x6f, 0xb0, 0x4a],
  lamp: [0xff, 0xdc, 0x73],
};

/**
 * The colour one step darker, in palette. Land darkens towards the sea's blues, as
 * under moonlight; no land colour darkens into a source's signature colour, so that
 * colour keeps its meaning at night. Chains end on `skyNight`, the darkest colour,
 * which stays itself: the night tint walks a colour down its chain.
 */
export const DARKER: Readonly<Record<ColourName, ColourName>> = {
  seaDeep: "skyNight",
  sea: "seaDeep",
  seaShallow: "sea",
  foam: "seaShallow",
  forest: "seaDeep",
  grass: "forest",
  meadow: "grass",
  field: "soil",
  sand: "field",
  soil: "seaDeep",
  rock: "sea",
  snow: "foam",
  roof: "soil",
  skyNight: "skyNight",
  skyBlueHour: "skyNight",
  skyGolden: "roof",
  skyDay: "seaShallow",
  nuclear: "field",
  hydro: "seaShallow",
  wind: "foam",
  solar: "roof",
  thermal: "soil",
  bioenergy: "grass",
  lamp: "field",
};

/** The colour `steps` steps darker (0 is the colour itself). */
export function darken(colour: ColourName, steps: number): ColourName {
  let c = colour;
  for (let i = 0; i < steps; i++) c = DARKER[c];
  return c;
}

/** Luma: Rec. 709 weights on the gamma-encoded values, 0–255 (for ordering shades). */
export function luma([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
