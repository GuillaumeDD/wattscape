/**
 * The names of the themes (PRD G-011), apart from the themes themselves, so that the
 * settings can validate a name without loading a renderer. Pure data.
 */

/** The ids of the themes, the default first. */
export const THEME_IDS = ["pixel", "modern"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_ID: ThemeId = "pixel";

/** Whether an untrusted value (a URL setting, a stored one) names a theme. */
export function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.some((id) => id === value);
}
