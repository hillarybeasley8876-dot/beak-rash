// Sunset Pass viewpoint pagoda (env-mountain): a three-tier wooden pavilion on a stone plinth with
// red columns, upturned eaves (corner horns), a gold finial, hanging lanterns at the corners and a
// little lookout deck with a railing. Local frame: origin at the ground centre, front faces −Z.
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';
import { part } from './mountain-kit';
import { poly } from './building';
import { lantern } from './mountain-deco';

const C = (h: string): Color => new Color(h);
const PAL = {
  stone: C('#a99c8c'), stoneDark: C('#857a6e'), column: C('#c8331f'), beam: C('#7a2418'), wall: C('#f1e4cc'),
  roof: C('#2f3a4a'), roofUnder: C('#4b2a22'), trim: C('#e8b23a'), rail: C('#8a3a22'), gold: C('#ffcf4a'),
};
const lm = new Matrix4(), wm = new Matrix4();

/** Square pyramid-ish eave roof: steep upper slope over a flared lower skirt, horns at the corners. */
function eave(buf: MeshBuf, base: Matrix4, y: number, half: number, rise: number, flare: number): void {
  const H = half + flare, h2 = half * 0.42, ym = y + rise * 0.35, yt = y + rise;
  const ring = (r: number, yy: number): Array<[number, number, number]> => [[-r, yy, -r], [r, yy, -r], [r, yy, r], [-r, yy, r]];
  const lo = ring(H, y), mid = ring(half * 0.8, ym), hi = ring(h2, yt);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const [a, b2] = [lo[i] as [number, number, number], lo[j] as [number, number, number]];
    const [c, d] = [mid[j] as [number, number, number], mid[i] as [number, number, number]];
    const [e, f] = [hi[j] as [number, number, number], hi[i] as [number, number, number]];
    poly(buf, base, [a, b2, c, d], PAL.roof);
    poly(buf, base, [d, c, e, f], PAL.roof);
    poly(buf, base, [a, d, c, b2].map(([x, yy, z]) => [x, yy - 0.12, z] as [number, number, number]), PAL.roofUnder);
  }
  poly(buf, base, hi, PAL.roof);
  // Corner horns (upturned eave tips) + a gold trim band.
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
    const hm = new Matrix4().multiplyMatrices(base, new Matrix4().makeTranslation(sx * H * 0.98, y + 0.28, sz * H * 0.98));
    hm.multiply(new Matrix4().makeRotationY(Math.atan2(sx, sz))).multiply(new Matrix4().makeRotationX(0.75)).multiply(new Matrix4().makeScale(0.28, 0.75, 0.28));
    box(buf, hm, PAL.roof);
  }
  part(buf, base, 0, y - 0.1, 0, 2 * half + 0.3, 0.22, 2 * half + 0.3, PAL.trim);
}

/** Viewpoint pagoda. (x, y, z) = ground centre; ry turns local −Z toward the road. */
export function pagoda(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng, scale = 1): void {
  const base = trs(x, y, z, ry, scale, scale, scale, new Matrix4());
  // Plinth with steps on the road side.
  part(props, base, 0, -1.6, 0, 10.5, 4.2, 10.5, PAL.stoneDark);
  part(props, base, 0, 0.75, 0, 9.6, 0.5, 9.6, PAL.stone);
  for (let k = 0; k < 3; k++) part(props, base, 0, 0.1 + k * 0.22, -5.3 - (2 - k) * 0.42, 3.2, 0.24, 0.5, PAL.stone);
  // Railing around the lookout deck (open in front of the steps).
  for (let i = 0; i <= 8; i++) {
    const t = -4.5 + (i * 9) / 8;
    for (const [px, pz] of [[t, 4.5], [-4.5, t], [4.5, t]] as Array<[number, number]>) part(props, base, px, 1.45, pz, 0.16, 0.9, 0.16, PAL.rail);
    if (Math.abs(t) > 1.7) part(props, base, t, 1.45, -4.5, 0.16, 0.9, 0.16, PAL.rail);
  }
  part(props, base, 0, 1.9, 4.5, 9.2, 0.14, 0.18, PAL.rail);
  for (const sx of [-1, 1]) {
    part(props, base, sx * 4.5, 1.9, 0, 0.18, 0.14, 9.2, PAL.rail);
    part(props, base, sx * 3.1, 1.9, -4.5, 2.9, 0.14, 0.18, PAL.rail);
  }
  // Ground floor: red columns, white panels at the back, then three tiers.
  const tiers: Array<[number, number, number]> = [[3.2, 1.0, 3.6], [2.4, 4.9, 2.6], [1.7, 8.1, 2.3]];
  for (const [i, [half, y0, hh]] of tiers.entries()) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
      wm.multiplyMatrices(base, trs(sx * half * 0.85, y0, sz * half * 0.85, 0, 0.22, hh, 0.22, lm));
      cylinder(props, wm, PAL.column, 8, 1, 1, false);
    }
    if (i === 0) {
      part(props, base, 0, y0 + 1.4, half * 0.85, half * 1.7, 2.6, 0.12, PAL.wall);
      for (const sx of [-1, 1]) part(props, base, sx * half * 0.85, y0 + 1.4, half * 0.3, 0.12, 2.6, half * 1.1, PAL.wall);
    } else {
      part(props, base, 0, y0 + hh * 0.45, 0, half * 1.6, hh * 0.9, half * 1.6, PAL.wall);
      for (const sx of [-1, 1]) part(props, base, sx * half * 0.4, y0 + hh * 0.5, -half * 0.81, half * 0.45, hh * 0.45, 0.06, PAL.beam);
    }
    part(props, base, 0, y0 + hh - 0.15, 0, half * 1.8, 0.3, half * 1.8, PAL.beam);
    eave(props, base, y0 + hh, half, i === 2 ? 2.4 : 1.5, i === 0 ? 1.4 : 1.1);
    // Lanterns hanging from the lowest eave corners.
    if (i === 0) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
        const p = new Matrix4().multiplyMatrices(base, trs(sx * (half + 0.9), y0 + hh - 0.2, sz * (half + 0.9), 0, 1, 1, 1, lm));
        const e = p.elements;
        lantern(props, glow, e[12] ?? 0, e[13] ?? 0, e[14] ?? 0, rng, scale);
      }
    }
  }
  // Finial: gold pole + stacked rings.
  wm.multiplyMatrices(base, trs(0, 12.6, 0, 0, 0.12, 2.4, 0.12, lm));
  cylinder(props, wm, PAL.gold, 6, 1, 1, false);
  for (let k = 0; k < 3; k++) {
    wm.multiplyMatrices(base, trs(0, 13.0 + k * 0.5, 0, 0, 0.36 - k * 0.07, 0.14, 0.36 - k * 0.07, lm));
    sphere(props, wm, PAL.gold, 8, 4);
  }
  wm.multiplyMatrices(base, trs(0, 14.5, 0, 0, 0.26, 0.6, 0.26, lm));
  cone(props, wm, PAL.gold, 6);
}
