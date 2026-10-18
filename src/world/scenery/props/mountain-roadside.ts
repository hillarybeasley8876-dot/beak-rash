// Sunset Pass roadside furniture (env-mountain): a little red mountain shrine with lanterns and a
// yuzu offering, a viewpoint bench and a coin-op binocular — small landmarks that give each hairpin
// its own identity. Local frame: -Z faces the road (models face -Z; yaw = the spot's faceRoad).
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { cone, cylinder, sphere, trs } from '../../kit/shapes';
import { lantern } from './mountain-deco';
import { part } from './mountain-kit';

const C = (h: string): Color => new Color(h);
const PAL = {
  stone: C('#9d9387'), stoneDark: C('#7d746b'), red: C('#c8322a'), roof: C('#3f3b52'), gold: C('#e8b85a'),
  wood: C('#8a5a36'), steel: C('#5b6270'), yellow: C('#ffcc2a'), yuzu: C('#ffc21a'),
} as const;
const lm = new Matrix4(), wm = new Matrix4();

function frame(x: number, y: number, z: number, yaw: number): Matrix4 {
  return new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationY(yaw));
}

/** Red wayside shrine on a stone plinth, pyramid roof, two lanterns on posts, a yuzu offering. */
export function shrine(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng): void {
  const base = frame(x, y, z, yaw);
  part(props, base, 0, 0.1, 0, 2.2, 1.0, 1.7, PAL.stone);
  part(props, base, 0, 0.66, 0, 1.6, 0.12, 1.2, PAL.stoneDark);
  part(props, base, 0, 1.3, 0.1, 1.1, 1.2, 0.85, PAL.red);
  part(props, base, 0, 1.25, -0.33, 0.62, 0.8, 0.04, PAL.roof);
  wm.multiplyMatrices(base, trs(0, 1.9, 0.1, Math.PI / 4, 1.05, 0.75, 0.95, lm));
  cone(props, wm, PAL.roof, 4);
  wm.multiplyMatrices(base, trs(0, 2.7, 0.1, 0, 0.1, 0.1, 0.1, lm));
  sphere(props, wm, PAL.gold, 6, 4);
  wm.multiplyMatrices(base, trs(0.5, 0.86, -0.45, 0, 0.13, 0.13, 0.13, lm));
  sphere(props, wm, PAL.yuzu, 7, 5);
  for (const sx of [-1.4, 1.4]) {
    wm.multiplyMatrices(base, trs(sx, -0.4, -0.5, 0, 0.07, 2.5, 0.07, lm));
    cylinder(props, wm, PAL.wood, 6);
    const p = trs(sx, 2.0, -0.5, 0, 1, 1, 1, lm).premultiply(base);
    lantern(props, glow, p.elements[12] ?? x, p.elements[13] ?? y, p.elements[14] ?? z, rng, 0.62);
  }
}

/** Timber bench facing the view: backrest on the road side (-Z), seat facing the valley (+Z). */
export function bench(props: MeshBuf, x: number, y: number, z: number, yaw: number): void {
  const base = frame(x, y, z, yaw);
  part(props, base, 0, 0.45, 0, 1.8, 0.08, 0.5, PAL.wood);
  part(props, base, 0, 0.8, -0.24, 1.8, 0.36, 0.06, PAL.wood);
  for (const sx of [-0.75, 0.75]) part(props, base, sx, 0.2, 0, 0.08, 0.5, 0.45, PAL.steel);
}

/** Coin-op binocular on a post: eyepieces on the road side (-Z), aimed at the view (+Z). */
export function binocular(props: MeshBuf, x: number, y: number, z: number, yaw: number): void {
  const base = frame(x, y, z, yaw);
  wm.multiplyMatrices(base, trs(0, 0, 0, 0, 0.08, 1.15, 0.08, lm));
  cylinder(props, wm, PAL.steel, 8);
  part(props, base, 0, 1.25, 0, 0.42, 0.26, 0.34, PAL.yellow);
  for (const sx of [-0.11, 0.11]) part(props, base, sx, 1.27, -0.22, 0.12, 0.12, 0.14, PAL.steel);
}
