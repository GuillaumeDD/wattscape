/**
 * A visual theme: how a scene (src/scene/scene.ts) becomes pixels. The scene says
 * what is there; the theme decides how it looks. One theme for now, the pixel art
 * of ARCHITECTURE § Art direction; PRD G-011 proposes a second, chosen by the viewer.
 */
import { type Scene } from "../scene/scene.ts";
import { pixelTheme } from "./pixel-theme.ts";
import { type Surface } from "./surface.ts";

export interface Theme {
  readonly id: string;
  /** Draws the whole frame into `out`, which has the scene's size. Pure. */
  draw(scene: Scene, out: Surface): void;
}

/** Every theme, by id. */
export const THEMES: Readonly<Record<string, Theme>> = { [pixelTheme.id]: pixelTheme };

export const DEFAULT_THEME: Theme = pixelTheme;
