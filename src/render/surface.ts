/**
 * A pixel buffer the scene is drawn into (ARCHITECTURE § Rendering and loop): RGBA
 * bytes, row after row. The browser blits it to a canvas; the tests hash it. Pure: no
 * DOM, no clock.
 */
import type { Rgb } from "./palette.ts";

export interface Surface {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export function createSurface(width: number, height: number): Surface {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0)
    throw new Error(`bad surface size ${String(width)} × ${String(height)}`);
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** Paints one opaque pixel; a pixel outside the surface is ignored (clipping). */
export function setPixel(surface: Surface, x: number, y: number, colour: Rgb): void {
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) return;
  const i = (y * surface.width + x) * 4;
  surface.data[i] = colour[0];
  surface.data[i + 1] = colour[1];
  surface.data[i + 2] = colour[2];
  surface.data[i + 3] = 255;
}

/** The colour of one pixel, alpha left out; a pixel outside the surface throws. */
export function getPixel(surface: Surface, x: number, y: number): Rgb {
  if (!(Number.isInteger(x) && Number.isInteger(y)) || x < 0 || y < 0)
    throw new RangeError(`no pixel at ${String(x)}, ${String(y)}`);
  if (x >= surface.width || y >= surface.height)
    throw new RangeError(`no pixel at ${String(x)}, ${String(y)}`);
  const i = (y * surface.width + x) * 4;
  return [surface.data[i] ?? 0, surface.data[i + 1] ?? 0, surface.data[i + 2] ?? 0];
}

/**
 * FNV-1a (32-bit) over its size (4 bytes each, little-endian) and every byte of the
 * buffer, as 8 hex digits: the
 * frame hash of the determinism tests (AGENTS.md § Determinism). Integer arithmetic
 * only, so every engine gives the same value for the same frame.
 */
export function hashSurface(surface: Surface): string {
  let h = 0x811c9dc5;
  const mix = (byte: number): void => {
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  };
  for (const n of [surface.width, surface.height])
    for (let shift = 0; shift < 32; shift += 8) mix((n >>> shift) & 0xff);
  const data = surface.data;
  for (let i = 0; i < data.length; i++) mix(data[i] ?? 0);
  return h.toString(16).padStart(8, "0");
}
