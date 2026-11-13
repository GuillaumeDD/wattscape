/**
 * The two families of sources on the map (PRD § 4.5): the major ones, whose plants
 * are few and large, each drawn where it stands; and the diffuse ones, many small
 * units spread over a region, drawn as a number of sites in proportion to the
 * region's installed capacity (D-041).
 */
import { type Source } from "../data/eco2mix.ts";

/** The diffuse sources. */
export const DIFFUSE_SOURCES = ["wind", "solar", "bioenergy"] as const;
export type DiffuseSource = (typeof DIFFUSE_SOURCES)[number];
/** The major sources. */
export type MajorSource = Exclude<Source, DiffuseSource>;

/** Whether a source is a diffuse one. */
export function isDiffuse(source: Source): source is DiffuseSource {
  return DIFFUSE_SOURCES.some((s) => s === source);
}
