/**
 * A visual theme: how a scene (src/scene/scene.ts) becomes pixels. The scene says
 * what is there; the theme decides how it looks. Three themes, chosen by the viewer
 * (PRD G-011, G-024): the pixel art of ARCHITECTURE § Art direction, the modern one
 * and the neon one.
 */
import { type Scene, type ScenePlant } from "../scene/scene.ts";
import { modernTheme } from "./modern-theme.ts";
import { neonTheme } from "./neon-theme.ts";
import { pixelTheme } from "./pixel-theme.ts";
import { type Surface } from "./surface.ts";
import { DEFAULT_THEME_ID, type ThemeId } from "./theme-ids.ts";

export { type ThemeId } from "./theme-ids.ts";

/**
 * Something a frame shows that has a caption (B-020): where it stands, as the box
 * of its sprite in scene pixels (left and top included, right and bottom excluded).
 */
export type Mark = LandmarkMark | PlantMark;

interface MarkBox {
  /** Unique in a frame, and the same from frame to frame, so a caption can follow it. */
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface LandmarkMark extends MarkBox {
  readonly kind: "landmark";
  /** `id` is its row in docs/POI.md. */
}

export interface PlantMark extends MarkBox {
  readonly kind: "plant";
  readonly plant: ScenePlant;
}

/** A box of pixels of a surface: left and top included, right and bottom excluded. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** What a drawn frame leaves to animate: the plants' motion (B-012). */
export interface Drawn {
  /** Whether anything moves: when not, the frame stays as drawn. */
  readonly moving: boolean;
  /** What the frame shows that has a caption, in the order it was drawn. */
  readonly marks: readonly Mark[];
  /**
   * Draws the motion at an animation time (seconds) into `target`, which holds a copy
   * of the drawn frame. Pure: the same time gives the same pixels. To be called
   * before the theme draws its next frame, whose buffers it may share. A theme may
   * return the boxes of `target` it drew in, all of them: the page then copies and
   * shows these alone, instead of the whole frame at every step.
   */
  animate(target: Surface, seconds: number): readonly Rect[] | undefined;
}

export interface Theme {
  readonly id: ThemeId;
  /**
   * Output pixels per scene pixel, a whole number, for a scene of `width` × `height`
   * shown at `factor` device pixels per scene pixel: 1 for pixel art, more for a
   * smooth theme. The scene, its camera and the marks stay in scene pixels. With
   * `moving`, the density for a frame of a moving camera, which a smooth theme may
   * draw with fewer pixels to keep its pace (PRD Q-34).
   */
  density(width: number, height: number, factor: number, moving?: boolean): number;
  /**
   * Draws the whole still frame into `out`, which has the scene's size times the
   * density. Pure.
   */
  draw(scene: Scene, out: Surface): Drawn;
}

/** Every theme, by id. */
export const THEMES: Readonly<Record<ThemeId, Theme>> = {
  pixel: pixelTheme,
  modern: modernTheme,
  neon: neonTheme,
};

export const DEFAULT_THEME: Theme = THEMES[DEFAULT_THEME_ID];
