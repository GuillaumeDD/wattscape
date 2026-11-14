/**
 * Captions (B-020): which mark the pointer is on, and where its caption goes. Pure,
 * so tested without a page; `src/ui/scene-view.ts` and `src/main.ts` wire them.
 */
import { type Locale } from "../i18n";
import { LANDMARK_CAPTIONS } from "../map/landmark-captions";
import { type Mark } from "../render/theme";

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

export function captionText(mark: Pick<Mark, "kind" | "id">, locale: Locale): CaptionText | null {
  const caption = LANDMARK_CAPTIONS[mark.id];
  if (caption === undefined) return null;
  return { name: caption.name, line: caption[locale] };
}

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
