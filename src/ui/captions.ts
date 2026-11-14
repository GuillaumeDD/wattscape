/**
 * Captions (B-020): which mark the pointer is on, and where its caption goes. Pure,
 * so tested without a page; `src/ui/scene-view.ts` and `src/main.ts` wire them.
 */
import { type Source } from "../data/eco2mix";
import { REGION_NAMES } from "../geo/regions";
import { type Locale, type MessageKey, translate } from "../i18n";
import { LANDMARK_CAPTIONS } from "../map/landmark-captions";
import { isDiffuse } from "../map/sources";
import { type Mark, type PlantMark } from "../render/theme";

/**
 * The mark under a point of the buffer, within `slack` pixels of its box (a finger is
 * wider than a cursor); the one drawn last, in front, when several are; else null.
 */
export function markAt(marks: readonly Mark[], x: number, y: number, slack: number): Mark | null {
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    if (m === undefined) continue;
    if (x >= m.left - slack && x < m.right + slack && y >= m.top - slack && y < m.bottom + slack)
      return m;
  }
  return null;
}

/** What a caption shows: a name, and one line in the viewer's language. */
export interface CaptionText {
  readonly name: string;
  readonly line: string;
}

const SOURCE_KEYS = {
  nuclear: "plantNuclear",
  thermal: "plantThermal",
  wind: "plantWind",
  solar: "plantSolar",
  hydro: "plantHydro",
  bioenergy: "plantBioenergy",
} as const satisfies Record<Source, MessageKey>;

/**
 * A mark's caption in the viewer's language; null for a landmark without one. A
 * plant's says what it is and where, its installed capacity (DS-07), and the figure
 * that drives it: its technology's load factor in its region, with the reading's
 * time (`time` formats it), or why there is none. Never a figure of its own: éCO2mix
 * gives none per plant (ARCHITECTURE § Data-to-scene mapping).
 */
export function captionText(
  mark: LandmarkMarkRef | Pick<PlantMark, "kind" | "plant">,
  locale: Locale,
  time: (ms: number) => string,
): CaptionText | null {
  if (mark.kind === "landmark") {
    const caption = LANDMARK_CAPTIONS[mark.id];
    return caption === undefined ? null : { name: caption.name, line: caption[locale] };
  }
  const t = (key: MessageKey): string => translate(locale, key);
  const { site, figure } = mark.plant;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const region = REGION_NAMES[site.region];
  const perCommune = isDiffuse(site.source) && !site.offshore;
  const capacity = t(perCommune ? "plantCapacityCommune" : "plantCapacity").replace(
    "{mw}",
    number.format(site.mw),
  );
  const load =
    figure === null
      ? t("plantNoData")
      : figure.loadFactorPct === null
        ? t("plantNoLoad").replace("{region}", region)
        : t("plantLoad")
            .replace("{region}", region)
            .replace("{pct}", number.format(figure.loadFactorPct))
            .replace("{time}", time(figure.timeMs));
  return { name: `${t(SOURCE_KEYS[site.source])} · ${site.commune}`, line: `${capacity} ${load}` };
}

/** A landmark's mark, as far as its caption needs. */
type LandmarkMarkRef = Pick<Mark, "id"> & { readonly kind: "landmark" };

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Room left between a caption and the window's edges, and the mark, in CSS pixels. */
const MARGIN = 8;

/**
 * Where a caption of a given size goes, in CSS pixels: centred above the mark, or below
 * it when there is no room above, and kept inside the window.
 */
export function captionPosition(
  mark: Box,
  width: number,
  height: number,
  windowWidth: number,
  windowHeight: number,
): { left: number; top: number } {
  const centre = (mark.left + mark.right) / 2;
  const left = Math.min(
    Math.max(MARGIN, centre - width / 2),
    Math.max(MARGIN, windowWidth - MARGIN - width),
  );
  const above = mark.top - MARGIN - height;
  const top =
    above >= MARGIN
      ? above
      : Math.min(mark.bottom + MARGIN, Math.max(MARGIN, windowHeight - MARGIN - height));
  return { left: Math.round(left), top: Math.round(top) };
}
