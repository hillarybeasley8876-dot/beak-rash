// Big traffic models (cargo truck, bus, the 鹈鹕海鲜 fish truck). Same conventions as models-cars.
import type { BufferGeometry } from 'three';
import { box, cone, cylinder, rbox, sphere } from './kit';
import { CHROME, DARK, GLASS, WHITE, ends, lampsFor, type ModelParts } from './models-cars';

/** Cab-over truck front: cab body (paint) + glass + grille, cab front at z = f. */
function cab(W: number, f: number): { paint: BufferGeometry[]; trim: BufferGeometry[] } {
  return {
    paint: [rbox([W - 0.05, 1.95, 1.9], WHITE, [0, 1.62, f + 0.95], 0.28)],
    trim: [
      rbox([W - 0.25, 0.8, 0.1], GLASS, [0, 2.05, f - 0.01], 0.06),
      rbox([W - 0.01, 0.7, 1.1], GLASS, [0, 2.05, f + 0.7], 0.08),
      rbox([W - 0.6, 0.4, 0.08], CHROME, [0, 1.15, f - 0.02], 0.05),
      rbox([0.18, 0.3, 0.12], DARK, [-W / 2 - 0.05, 2.0, f + 0.3], 0.05),
      rbox([0.18, 0.3, 0.12], DARK, [W / 2 + 0.05, 2.0, f + 0.3], 0.05),
    ],
  };
}

/** Rear barn doors on a cargo box whose back face sits at z = back. */
const rearDoors = (W: number, back: number, y: number, h: number): BufferGeometry[] => [
  box([0.05, h - 0.2, 0.04], DARK, [0, y, back + 0.02]),
  box([W - 0.3, 0.05, 0.04], DARK, [0, y + h / 2 - 0.12, back + 0.02]),
  box([0.08, 0.5, 0.06], CHROME, [-0.18, y, back + 0.04]),
  box([0.08, 0.5, 0.06], CHROME, [0.18, y, back + 0.04]),
];

const chassis = (W: number, L: number): BufferGeometry[] => [
  rbox([W - 0.4, 0.38, L - 0.4], DARK, [0, 0.62, 0], 0.08),
  cylinder(0.26, 0.26, 1.1, CHROME, [W / 2 - 0.35, 0.6, -0.2], [Math.PI / 2, 0, 0]),
];

export function truck(): ModelParts {
  const L = 7.6, W = 2.35, f = -L / 2;
  const c = cab(W, f);
  return {
    paint: [...c.paint, rbox([W + 0.02, 0.34, 5.1], WHITE, [0, 1.25, 1.05], 0.06)],
    trim: [
      ...c.trim, ...chassis(W, L),
      rbox([W, 2.5, 5.4], '#eceae3', [0, 2.07, 1.08], 0.12),
      ...rearDoors(W, 3.78, 2.07, 2.5),
      ...ends(L, W, 0.55, 0.95),
    ],
    decals: [],
    ...lampsFor(L, W, 0.95),
  };
}

export function bus(): ModelParts {
  const L = 10, W = 2.45;
  return {
    paint: [rbox([W, 2.55, L], WHITE, [0, 1.8, 0], 0.32)],
    trim: [
      rbox([W + 0.04, 0.9, 8.2], GLASS, [0, 2.2, 0.35], 0.1),
      rbox([2.15, 1.25, 0.1], GLASS, [0, 2.05, -L / 2 - 0.01], 0.08),
      rbox([W + 0.04, 0.3, 9.4], WHITE, [0, 0.98, 0], 0.08),
      rbox([0.06, 1.85, 1.0], GLASS, [W / 2 + 0.01, 1.55, -3.75], 0.03),
      rbox([0.06, 1.85, 1.0], GLASS, [W / 2 + 0.01, 1.55, 3.6], 0.03),
      rbox([1.4, 0.28, 2.6], '#d9dde3', [0, 3.18, 0.5], 0.1),
      rbox([1.7, 0.42, 0.12], DARK, [0, 2.86, -L / 2 - 0.02], 0.04),
      rbox([2.0, 0.85, 0.08], GLASS, [0, 2.35, L / 2 + 0.01], 0.06),
      box([1.4, 0.36, 0.05], DARK, [0, 1.25, L / 2 + 0.02]),
      ...ends(L, W, 0.5, 0.92),
    ],
    decals: [
      { region: 'route', center: [0, 2.86, -L / 2 - 0.09], uDir: [-1, 0, 0], width: 1.6, height: 0.34 },
      { region: 'ad', center: [W / 2 + 0.035, 1.44, 0.1], uDir: [0, 0, -1], width: 3.7, height: 0.58 },
      { region: 'ad', center: [-W / 2 - 0.035, 1.44, 0.1], uDir: [0, 0, 1], width: 3.7, height: 0.58 },
    ],
    ...lampsFor(L, W, 0.92),
  };
}

/** 鹈鹕海鲜: white reefer box, a giant cartoon fish on the roof. */
export function fish(): ModelParts {
  const L = 7.2, W = 2.3, f = -L / 2;
  const c = cab(W, f);
  const scale = '#8fb6dd', fin = '#5f8fc4';
  return {
    paint: c.paint,
    trim: [
      ...c.trim, ...chassis(W, L),
      rbox([W, 2.4, 5.0], '#f7f8fa', [0, 2.02, 0.98], 0.14),
      ...rearDoors(W, 3.48, 2.02, 2.4),
      rbox([0.2, 0.3, 0.2], DARK, [0, 3.35, 0.0], 0.04),
      rbox([0.2, 0.3, 0.2], DARK, [0, 3.35, 1.9], 0.04),
      sphere(1, scale, [0, 3.95, 0.85], [0.55, 0.62, 1.75], 16),
      cone(0.62, 0.8, fin, [0, 3.95, 2.85], [-Math.PI / 2, 0, 0]),
      cone(0.3, 0.6, fin, [0, 4.6, 0.9], [0, 0, 0]),
      sphere(0.17, '#ffffff', [-0.45, 4.1, -0.35]),
      sphere(0.17, '#ffffff', [0.45, 4.1, -0.35]),
      sphere(0.08, '#111111', [-0.58, 4.12, -0.42]),
      sphere(0.08, '#111111', [0.58, 4.12, -0.42]),
      ...ends(L, W, 0.55, 0.95),
    ],
    decals: [
      { region: 'fish', center: [W / 2 + 0.02, 2.05, 0.98], uDir: [0, 0, -1], width: 4.5, height: 1.6 },
      { region: 'fish', center: [-W / 2 - 0.02, 2.05, 0.98], uDir: [0, 0, 1], width: 4.5, height: 1.6 },
    ],
    ...lampsFor(L, W, 0.95),
  };
}
