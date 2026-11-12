/**
 * A visual theme: how a scene (src/scene/scene.ts) becomes pixels. The scene says
 * what is there; the theme decides how it looks. One theme for now, the pixel art
 * of ARCHITECTURE § Art direction; PRD G-011 proposes a second, chosen by the viewer.
 */
import { type Scene } from "../scene/scene.ts";
import { pixelTheme } from "./pixel-theme.ts";
import { type Surface } from "./surface.ts";

/** What a drawn frame leaves to animate: the plants' motion (B-012). */
export interface Drawn {
  /** Whether anything moves: when not, the frame stays as drawn. */
  readonly moving: boolean;
  /**
   * Draws the motion at an animation time (seconds) into `target`, which holds a copy
   * of the drawn frame. Pure: the same time gives the same pixels.
   */
  animate(target: Surface, seconds: number): void;
}

export interface Theme {
  readonly id: string;
  /** Draws the whole still frame into `out`, which has the scene's size. Pure. */
  draw(scene: Scene, out: Surface): Drawn;
}

/** Every theme, by id. */
export const THEMES: Readonly<Record<string, Theme>> = { [pixelTheme.id]: pixelTheme };

export const DEFAULT_THEME: Theme = pixelTheme;
