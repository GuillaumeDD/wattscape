/**
 * The names of the themes (PRD G-011), apart from the themes themselves, so that the
 * settings can validate a name without loading a renderer. Pure data.
 */

/** The ids of the themes, the default first. */
export const THEME_IDS = ["modern", "pixel"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** The modern theme by default (D-079, revising D-055); the pixel art stays a choice. */
export const DEFAULT_THEME_ID: ThemeId = "modern";

/** Whether an untrusted value (a URL setting, a stored one) names a theme. */
export function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.some((id) => id === value);
}
