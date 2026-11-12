/**
 * The rules that turn a commune into a town on the map (B-015, D-031), shared by
 * the bake (tools/bake-towns.ts) and the scene.
 */

/** The smallest commune drawn, inhabitants: at 1 km, it covers one cell. */
export const MIN_POPULATION = 2000;

/**
 * Inhabitants per km² of built town: a town covers population / URBAN_DENSITY km²,
 * never more than its commune's area.
 */
export const URBAN_DENSITY = 4000;
