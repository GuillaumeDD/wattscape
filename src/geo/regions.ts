/**
 * Regions and prefectures, for the offline position → area lookup (ARCHITECTURE §
 * Geolocation). Pure: no DOM, no network, no clock.
 */
import type { Eco2mixArea, RegionCode } from "../data/eco2mix.ts";

/** Corsica's INSEE code: a region, but absent from the regional éCO2mix data. */
export const CORSICA = "94";

/** Official names of the 12 regions of the regional éCO2mix data (S-003). */
export const REGION_NAMES: Readonly<Record<RegionCode, string>> = {
  "11": "Île-de-France",
  "24": "Centre-Val de Loire",
  "27": "Bourgogne-Franche-Comté",
  "28": "Normandie",
  "32": "Hauts-de-France",
  "44": "Grand Est",
  "52": "Pays de la Loire",
  "53": "Bretagne",
  "75": "Nouvelle-Aquitaine",
  "76": "Occitanie",
  "84": "Auvergne-Rhône-Alpes",
  "93": "Provence-Alpes-Côte d'Azur",
};

/**
 * The 96 prefectures of mainland France and Corsica: département, town, region,
 * latitude, longitude (degrees, 2 decimals; S-006). Each point was checked to lie
 * inside its département and its region (S-011).
 */
export const PREFECTURES: readonly (readonly [
  string,
  string,
  RegionCode | typeof CORSICA,
  number,
  number,
])[] = [
  ["01", "Bourg-en-Bresse", "84", 46.21, 5.23],
  ["02", "Laon", "32", 49.56, 3.62],
  ["03", "Moulins", "84", 46.57, 3.33],
  ["04", "Digne-les-Bains", "93", 44.09, 6.24],
  ["05", "Gap", "93", 44.56, 6.08],
  ["06", "Nice", "93", 43.7, 7.27],
  ["07", "Privas", "84", 44.74, 4.6],
  ["08", "Charleville-Mézières", "44", 49.77, 4.72],
  ["09", "Foix", "76", 42.97, 1.61],
  ["10", "Troyes", "44", 48.3, 4.08],
  ["11", "Carcassonne", "76", 43.21, 2.35],
  ["12", "Rodez", "76", 44.35, 2.57],
  ["13", "Marseille", "93", 43.3, 5.37],
  ["14", "Caen", "28", 49.18, -0.37],
  ["15", "Aurillac", "84", 44.93, 2.44],
  ["16", "Angoulême", "75", 45.65, 0.16],
  ["17", "La Rochelle", "75", 46.16, -1.15],
  ["18", "Bourges", "24", 47.08, 2.4],
  ["19", "Tulle", "75", 45.27, 1.77],
  ["21", "Dijon", "27", 47.32, 5.04],
  ["22", "Saint-Brieuc", "53", 48.51, -2.76],
  ["23", "Guéret", "75", 46.17, 1.87],
  ["24", "Périgueux", "75", 45.18, 0.72],
  ["25", "Besançon", "27", 47.24, 6.02],
  ["26", "Valence", "84", 44.93, 4.89],
  ["27", "Évreux", "28", 49.02, 1.15],
  ["28", "Chartres", "24", 48.45, 1.49],
  ["29", "Quimper", "53", 48.0, -4.1],
  ["2A", "Ajaccio", "94", 41.93, 8.74],
  ["2B", "Bastia", "94", 42.7, 9.45],
  ["30", "Nîmes", "76", 43.84, 4.36],
  ["31", "Toulouse", "76", 43.6, 1.44],
  ["32", "Auch", "76", 43.65, 0.59],
  ["33", "Bordeaux", "75", 44.84, -0.58],
  ["34", "Montpellier", "76", 43.61, 3.88],
  ["35", "Rennes", "53", 48.11, -1.68],
  ["36", "Châteauroux", "24", 46.81, 1.69],
  ["37", "Tours", "24", 47.39, 0.69],
  ["38", "Grenoble", "84", 45.19, 5.72],
  ["39", "Lons-le-Saunier", "27", 46.67, 5.55],
  ["40", "Mont-de-Marsan", "75", 43.89, -0.5],
  ["41", "Blois", "24", 47.59, 1.33],
  ["42", "Saint-Étienne", "84", 45.44, 4.39],
  ["43", "Le Puy-en-Velay", "84", 45.04, 3.88],
  ["44", "Nantes", "52", 47.22, -1.55],
  ["45", "Orléans", "24", 47.9, 1.91],
  ["46", "Cahors", "76", 44.45, 1.44],
  ["47", "Agen", "75", 44.2, 0.62],
  ["48", "Mende", "76", 44.52, 3.5],
  ["49", "Angers", "52", 47.47, -0.55],
  ["50", "Saint-Lô", "28", 49.12, -1.09],
  ["51", "Châlons-en-Champagne", "44", 48.96, 4.36],
  ["52", "Chaumont", "44", 48.11, 5.14],
  ["53", "Laval", "52", 48.07, -0.77],
  ["54", "Nancy", "44", 48.69, 6.18],
  ["55", "Bar-le-Duc", "44", 48.77, 5.16],
  ["56", "Vannes", "53", 47.66, -2.76],
  ["57", "Metz", "44", 49.12, 6.18],
  ["58", "Nevers", "27", 46.99, 3.16],
  ["59", "Lille", "32", 50.63, 3.06],
  ["60", "Beauvais", "32", 49.43, 2.08],
  ["61", "Alençon", "28", 48.43, 0.09],
  ["62", "Arras", "32", 50.29, 2.78],
  ["63", "Clermont-Ferrand", "84", 45.78, 3.08],
  ["64", "Pau", "75", 43.3, -0.37],
  ["65", "Tarbes", "76", 43.23, 0.08],
  ["66", "Perpignan", "76", 42.7, 2.9],
  ["67", "Strasbourg", "44", 48.58, 7.75],
  ["68", "Colmar", "44", 48.08, 7.36],
  ["69", "Lyon", "84", 45.76, 4.84],
  ["70", "Vesoul", "27", 47.62, 6.15],
  ["71", "Mâcon", "27", 46.31, 4.83],
  ["72", "Le Mans", "52", 48.0, 0.2],
  ["73", "Chambéry", "84", 45.57, 5.92],
  ["74", "Annecy", "84", 45.9, 6.13],
  ["75", "Paris", "11", 48.86, 2.35],
  ["76", "Rouen", "28", 49.44, 1.1],
  ["77", "Melun", "11", 48.54, 2.66],
  ["78", "Versailles", "11", 48.8, 2.13],
  ["79", "Niort", "75", 46.32, -0.46],
  ["80", "Amiens", "32", 49.89, 2.3],
  ["81", "Albi", "76", 43.93, 2.15],
  ["82", "Montauban", "76", 44.02, 1.35],
  ["83", "Toulon", "93", 43.13, 5.93],
  ["84", "Avignon", "93", 43.95, 4.81],
  ["85", "La Roche-sur-Yon", "52", 46.67, -1.43],
  ["86", "Poitiers", "75", 46.58, 0.34],
  ["87", "Limoges", "75", 45.83, 1.26],
  ["88", "Épinal", "44", 48.17, 6.45],
  ["89", "Auxerre", "27", 47.8, 3.57],
  ["90", "Belfort", "27", 47.64, 6.86],
  ["91", "Évry-Courcouronnes", "11", 48.63, 2.44],
  ["92", "Nanterre", "11", 48.89, 2.21],
  ["93", "Bobigny", "11", 48.91, 2.44],
  ["94", "Créteil", "11", 48.79, 2.46],
  ["95", "Cergy", "11", 49.04, 2.08],
];

/** Regional prefectures: where the weather is read when no position is known. */
export const REGION_CAPITALS: Readonly<Record<RegionCode, string>> = {
  "11": "75",
  "24": "45",
  "27": "21",
  "28": "76",
  "32": "59",
  "44": "67",
  "52": "44",
  "53": "35",
  "75": "33",
  "76": "31",
  "84": "69",
  "93": "13",
};

/** Mean kilometres per degree of latitude. */
export const KM_PER_DEGREE = 111.2;

/**
 * cos(latitude) by its Taylor series to x⁸: only + and ×, so every JS engine gives
 * the same bits (AGENTS.md § Determinism: Math.cos may differ by 1 ulp, and here the
 * result picks an area). Error below 2·10⁻⁶ up to 60° of latitude.
 */
export function cosDeg(degrees: number): number {
  const x = (degrees * 3.141592653589793) / 180;
  const x2 = x * x;
  return 1 - (x2 / 2) * (1 - (x2 / 12) * (1 - (x2 / 30) * (1 - x2 / 56)));
}

/** Squared distance in degrees of latitude, equirectangular at `k` = cos(latitude). */
function distanceSq(lat1: number, lon1: number, lat2: number, lon2: number, k: number): number {
  const dy = lat2 - lat1;
  const dx = (lon2 - lon1) * k;
  return dx * dx + dy * dy;
}

/** Distance in km from a position to its nearest prefecture (for tools and tests). */
export function nearestPrefectureKm(latitude: number, longitude: number): number {
  const k = cosDeg(latitude);
  let best = Number.POSITIVE_INFINITY;
  for (const [, , , lat, lon] of PREFECTURES) {
    best = Math.min(best, distanceSq(latitude, longitude, lat, lon, k));
  }
  return Math.sqrt(best) * KM_PER_DEGREE;
}

/** Corsica's bounding box: near Corsica but outside it is abroad (Sardinia). */
function inCorsica(latitude: number, longitude: number): boolean {
  return latitude >= 41.33 && latitude <= 43.03 && longitude >= 8.53 && longitude <= 9.57;
}

/**
 * Farther than this from every prefecture, a position is outside mainland France.
 * Every point of the mainland is within 112 km of a prefecture
 * (S-011), so this keeps a margin; places just across a border (Geneva, Brussels)
 * still map to the French region next door.
 */
export const ABROAD_KM = 120;

export type LookupResult =
  | { readonly area: RegionCode; readonly reason: "region" }
  | { readonly area: "FR"; readonly reason: "abroad" | "corsica" | "invalid" };

/**
 * The area of a position: the region of the nearest prefecture; the national view
 * for Corsica, for a position abroad, or for a position that is not a number.
 * Distances use an equirectangular projection at the position's latitude, accurate
 * to well under 1 % over these distances.
 */
export function areaOfPosition(latitude: number, longitude: number): LookupResult {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
    return { area: "FR", reason: "invalid" };
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    return { area: "FR", reason: "invalid" };
  const k = cosDeg(latitude);
  let best: RegionCode | typeof CORSICA = "11";
  let bestSq = Number.POSITIVE_INFINITY;
  for (const [, , region, lat, lon] of PREFECTURES) {
    const sq = distanceSq(latitude, longitude, lat, lon, k);
    if (sq < bestSq) {
      bestSq = sq;
      best = region;
    }
  }
  if (Math.sqrt(bestSq) * KM_PER_DEGREE > ABROAD_KM) return { area: "FR", reason: "abroad" };
  if (best === CORSICA) {
    return inCorsica(latitude, longitude)
      ? { area: "FR", reason: "corsica" }
      : { area: "FR", reason: "abroad" };
  }
  return { area: best, reason: "region" };
}

/** Where to read the weather for an area when no position is known; none for France. */
export function referencePoint(area: Eco2mixArea): { latitude: number; longitude: number } | null {
  if (area === "FR") return null;
  const dept = REGION_CAPITALS[area];
  const prefecture = PREFECTURES.find(([code]) => code === dept);
  if (prefecture === undefined) return null;
  return { latitude: prefecture[3], longitude: prefecture[4] };
}
