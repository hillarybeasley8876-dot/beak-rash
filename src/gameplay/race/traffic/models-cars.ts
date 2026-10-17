// Car-sized traffic models (compact, van, pickup, ice-cream van). Model space: x right, y up,
// front at −z. `paint` takes the per-instance body colour; `trim` keeps its own colours.
import type { BufferGeometry } from 'three';
import { cone, cylinder, rbox, sphere, type V3 } from './kit';

export const GLASS = '#273450';
export const DARK = '#2b2b33';
export const CHROME = '#c9ced6';
export const HEAD = '#fff3c4';
export const TAIL = '#c0141c';
export const WHITE = '#f6f4ee';

export interface DecalSpot { region: DecalRegion; center: V3; uDir: V3; width: number; height: number }
export type DecalRegion = 'fish' | 'icecream' | 'route' | 'ad';

export interface ModelParts {
  paint: BufferGeometry[];
  trim: BufferGeometry[];
  decals: DecalSpot[];
  /** Lamp anchors: blinkers [FL, FR, RL, RR], brake lights [L, R], headlights [L, R]. */
  blink: V3[];
  brake: V3[];
  head: V3[];
}

/** Bumpers, head/tail lights and grille for a body of length L, width W at bumper height y. */
export function ends(L: number, W: number, y: number, lampY: number): BufferGeometry[] {
  const f = -L / 2, b = L / 2;
  return [
    rbox([W + 0.04, 0.24, 0.3], DARK, [0, y, f + 0.05], 0.08),
    rbox([W + 0.04, 0.24, 0.3], DARK, [0, y, b - 0.05], 0.08),
    rbox([0.36, 0.18, 0.1], HEAD, [-W / 2 + 0.32, lampY, f - 0.02], 0.05),
    rbox([0.36, 0.18, 0.1], HEAD, [W / 2 - 0.32, lampY, f - 0.02], 0.05),
    rbox([0.3, 0.16, 0.1], TAIL, [-W / 2 + 0.3, lampY, b + 0.02], 0.05),
    rbox([0.3, 0.16, 0.1], TAIL, [W / 2 - 0.3, lampY, b + 0.02], 0.05),
    rbox([W * 0.4, 0.14, 0.08], CHROME, [0, y + 0.2, f - 0.01], 0.04),
  ];
}

export const lampsFor = (L: number, W: number, y: number): Pick<ModelParts, 'blink' | 'brake' | 'head'> => ({
  blink: [[-W / 2 + 0.06, y, -L / 2 - 0.06], [W / 2 - 0.06, y, -L / 2 - 0.06], [-W / 2 + 0.06, y, L / 2 + 0.06], [W / 2 - 0.06, y, L / 2 + 0.06]],
  brake: [[-W / 2 + 0.3, y, L / 2 + 0.08], [W / 2 - 0.3, y, L / 2 + 0.08]],
  head: [[-W / 2 + 0.32, y, -L / 2 - 0.08], [W / 2 - 0.32, y, -L / 2 - 0.08]],
});

export function compact(): ModelParts {
  const L = 3.9, W = 1.8;
  return {
    paint: [
      rbox([W, 0.64, L], WHITE, [0, 0.64, 0], 0.22),
      rbox([1.6, 0.62, 2.1], WHITE, [0, 1.18, 0.25], 0.26),
    ],
    trim: [
      rbox([1.64, 0.36, 1.8], GLASS, [0, 1.24, 0.25], 0.12),
      rbox([1.42, 0.36, 2.16], GLASS, [0, 1.24, 0.25], 0.12),
      rbox([0.12, 0.1, 0.2], DARK, [-0.9, 1.0, -0.6], 0.04),
      rbox([0.12, 0.1, 0.2], DARK, [0.9, 1.0, -0.6], 0.04),
      ...ends(L, W, 0.42, 0.74),
    ],
    decals: [],
    ...lampsFor(L, W, 0.74),
  };
}

export function van(): ModelParts {
  const L = 4.6, W = 1.95;
  return {
    paint: [
      rbox([W, 1.66, 3.95], WHITE, [0, 1.22, 0.32], 0.26),
      rbox([1.9, 0.8, 1.0], WHITE, [0, 0.78, -1.75], 0.22),
    ],
    trim: [
      rbox([1.76, 0.66, 0.5], GLASS, [0, 1.62, -1.42], 0.12),
      rbox([1.99, 0.56, 0.95], GLASS, [0, 1.62, -1.05], 0.1),
      rbox([1.99, 0.46, 1.9], GLASS, [0, 1.68, 0.75], 0.1),
      rbox([1.6, 0.5, 0.06], GLASS, [0, 1.62, 2.3], 0.05),
      rbox([1.99, 0.16, 3.3], '#e5191c', [0, 1.02, 0.45], 0.06),
      ...ends(L, W, 0.45, 0.8),
    ],
    decals: [],
    ...lampsFor(L, W, 0.8),
  };
}

export function pickup(): ModelParts {
  const L = 4.9, W = 1.95;
  const melon = '#2f8f3e';
  return {
    paint: [
      rbox([W, 0.72, L], WHITE, [0, 0.82, 0], 0.22),
      rbox([1.86, 0.78, 1.7], WHITE, [0, 1.5, -0.6], 0.24),
      rbox([0.14, 0.46, 2.1], WHITE, [-0.9, 1.36, 1.35], 0.06),
      rbox([0.14, 0.46, 2.1], WHITE, [0.9, 1.36, 1.35], 0.06),
      rbox([W, 0.46, 0.14], WHITE, [0, 1.36, 2.38], 0.06),
    ],
    trim: [
      rbox([1.9, 0.44, 1.4], GLASS, [0, 1.58, -0.62], 0.12),
      rbox([1.66, 0.44, 1.76], GLASS, [0, 1.58, -0.62], 0.12),
      sphere(0.32, melon, [-0.42, 1.48, 1.0], [1, 0.9, 1.15]),
      sphere(0.32, melon, [0.38, 1.48, 1.55], [1, 0.9, 1.15]),
      sphere(0.3, melon, [0.0, 1.75, 1.3], [1, 0.9, 1.15]),
      ...ends(L, W, 0.48, 0.86),
    ],
    decals: [],
    ...lampsFor(L, W, 0.86),
  };
}

export function icecream(): ModelParts {
  const L = 4.8, W = 2.0;
  return {
    paint: [
      rbox([W, 1.78, 4.0], WHITE, [0, 1.28, 0.38], 0.28),
      rbox([1.94, 0.8, 0.95], WHITE, [0, 0.8, -1.86], 0.22),
    ],
    trim: [
      rbox([1.8, 0.66, 0.5], GLASS, [0, 1.66, -1.5], 0.12),
      rbox([2.04, 0.56, 0.9], GLASS, [0, 1.66, -1.14], 0.1),
      rbox([0.08, 0.7, 1.5], DARK, [1.02, 1.55, 0.55], 0.04),
      rbox([1.5, 0.5, 0.06], GLASS, [0, 1.7, 2.39], 0.05),
      rbox([0.5, 0.06, 1.7], WHITE, [1.2, 2.0, 0.55], 0.03, [0, 0, -0.35]),
      cylinder(0.05, 0.05, 0.5, CHROME, [0, 2.4, 0.6]),
      cone(0.36, 0.95, '#e0a85a', [0, 2.9, 0.6], [Math.PI, 0, 0]),
      sphere(0.42, '#ff9ecf', [0, 3.45, 0.6]),
      sphere(0.36, '#fff7e6', [0, 3.85, 0.6]),
      sphere(0.12, '#e5191c', [0, 4.25, 0.6]),
      ...ends(L, W, 0.45, 0.82),
    ],
    decals: [
      { region: 'icecream', center: [1.025, 1.3, 0.4], uDir: [0, 0, -1], width: 2.6, height: 0.8 },
      { region: 'icecream', center: [-1.025, 1.3, 0.4], uDir: [0, 0, 1], width: 2.6, height: 0.8 },
    ],
    ...lampsFor(L, W, 0.82),
  };
}
