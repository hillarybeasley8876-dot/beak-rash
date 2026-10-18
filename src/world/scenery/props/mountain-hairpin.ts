// Sunset Pass hairpin landmarks (env-mountain), big enough to read from 40–60 m at speed: a red
// paifang gate with a tiled hip roof, stone lanterns for the curb, a camper van, a timber viewing deck
// and a mossy rock spire. Local frame: -Z faces the road (yaw = the spot's faceRoad), +X along it.
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { cone, cylinder, sphere, trs } from '../../kit/shapes';
import { hipRoof } from './building';
import { part } from './mountain-kit';
import { crag } from './rocks';

const C = (h: string): Color => new Color(h);
const PAL = {
  red: C('#d23a2c'), redDark: C('#9e2a22'), roof: C('#3f3b52'), gold: C('#f0c45a'), ink: C('#2a2430'),
  stone: C('#b9ad9c'), stoneDark: C('#958a7d'), glow: C('#ffcf6a').multiplyScalar(1.4), glass: C('#3b4a66'),
  wood: C('#9a6a42'), woodDark: C('#6e4a30'), white: C('#f3efe6'), tyre: C('#26232a'),
  moss: C('#6f9a4a'), granite: [C('#b98f7d'), C('#a07a72'), C('#8a6c6c')],
} as const;
const lm = new Matrix4(), wm = new Matrix4(), rz = new Matrix4().makeRotationZ(Math.PI / 2);

function frame(x: number, y: number, z: number, yaw: number): Matrix4 {
  return new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationY(yaw));
}

/** Red paifang gate (≈ 6.8 m tall, 7.4 m wide): pillars on stone plinths, two beams, a name board, a hip roof. */
export function paifang(props: MeshBuf, x: number, y: number, z: number, yaw: number): void {
  const base = frame(x, y, z, yaw);
  for (const sx of [-2.6, 2.6]) {
    part(props, base, sx, 0.3, 0, 0.95, 0.8, 0.95, PAL.stone);
    wm.multiplyMatrices(base, trs(sx, 0.6, 0, 0, 0.25, 4.9, 0.25, lm));
    cylinder(props, wm, PAL.red, 10);
  }
  part(props, base, 0, 4.55, 0, 6.6, 0.5, 0.44, PAL.red);
  part(props, base, 0, 5.5, 0, 7.4, 0.38, 0.44, PAL.redDark);
  part(props, base, 0, 5.05, -0.08, 2.7, 0.8, 0.1, PAL.ink);
  part(props, base, 0, 5.05, -0.14, 2.4, 0.6, 0.06, PAL.gold);
  wm.multiplyMatrices(base, lm.identity());
  hipRoof(props, wm, 7.6, 1.7, 5.7, 0.9, PAL.roof, PAL.redDark);
  part(props, base, 0, 6.66, 0, 6.2, 0.2, 0.26, PAL.roof);
  for (const sx of [-3.1, 3.1]) {
    wm.multiplyMatrices(base, trs(sx, 6.6, 0, 0, 0.16, 0.42, 0.16, lm));
    cone(props, wm, PAL.gold, 6);
  }
}

/** Stone lantern (tōrō, ≈ 1.6 m): plinth, post, a glowing firebox in a stone frame, pyramid cap. */
export function stoneLantern(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number): void {
  const base = frame(x, y, z, yaw);
  part(props, base, 0, 0.1, 0, 0.62, 0.3, 0.62, PAL.stoneDark);
  wm.multiplyMatrices(base, trs(0, 0.2, 0, 0, 0.13, 0.65, 0.13, lm));
  cylinder(props, wm, PAL.stone, 8);
  part(props, base, 0, 0.9, 0, 0.56, 0.1, 0.56, PAL.stone);
  part(glow, base, 0, 1.1, 0, 0.32, 0.3, 0.32, PAL.glow);
  for (const [cx, cz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]] as const) part(props, base, cx, 1.1, cz, 0.08, 0.32, 0.08, PAL.stone);
  wm.multiplyMatrices(base, trs(0, 1.25, 0, Math.PI / 4, 0.52, 0.34, 0.52, lm));
  cone(props, wm, PAL.stoneDark, 4);
  wm.multiplyMatrices(base, trs(0, 1.62, 0, 0, 0.07, 0.07, 0.07, lm));
  sphere(props, wm, PAL.stone, 6, 4);
}

/** Camper van (5.6 m long along local Z, front at −Z), two-tone body, pop-top roof, striped awning. */
export function camperVan(props: MeshBuf, x: number, y: number, z: number, yaw: number, body: Color, accent: Color): void {
  const base = frame(x, y, z, yaw);
  part(props, base, 0, 1.3, 0.2, 2.1, 1.7, 4.8, body);
  part(props, base, 0, 0.62, 0.15, 2.06, 0.34, 5.1, PAL.ink);
  part(props, base, 0, 0.95, -2.5, 2.0, 1.0, 0.7, accent);
  part(props, base, 0, 1.62, -2.17, 1.84, 0.66, 0.08, PAL.glass);
  for (const sx of [-1.06, 1.06]) {
    part(props, base, sx, 1.62, 0.6, 0.04, 0.56, 2.6, PAL.glass);
    part(props, base, sx, 0.98, 0.2, 0.03, 0.2, 4.8, accent);
  }
  part(props, base, 0, 2.28, 0.6, 1.9, 0.26, 3.4, PAL.white);
  part(props, base, 1.75, 2.0, 0.6, 1.4, 0.06, 2.6, accent);
  part(props, base, 1.75, 2.0, 0.6, 1.36, 0.07, 1.2, PAL.white);
  for (const sx of [-1.12, 1.12]) {
    for (const sz of [-1.7, 1.9]) {
      wm.multiplyMatrices(base, trs(sx + (sx > 0 ? 0.13 : -0.13), 0.42, sz, 0, 1, 1, 1, lm)).multiply(rz);
      wm.multiply(trs(0, -0.13, 0, 0, 0.4, 0.26, 0.4, lm));
      cylinder(props, wm, PAL.tyre, 10);
    }
  }
}

/** Timber viewing deck w × d (local X × Z) on posts, railing on the far side and both ends. */
export function timberDeck(props: MeshBuf, x: number, y: number, z: number, yaw: number, w: number, d: number): void {
  const base = frame(x, y, z, yaw);
  part(props, base, 0, 0.42, 0, w, 0.16, d, PAL.wood);
  for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) for (const sz of [-d / 2 + 0.2, d / 2 - 0.2]) part(props, base, sx, 0.0, sz, 0.2, 0.9, 0.2, PAL.woodDark);
  const rail = (x0: number, z0: number, x1: number, z1: number): void => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) part(props, base, x0 + ((x1 - x0) * i) / n, 0.95, z0 + ((z1 - z0) * i) / n, 0.1, 0.9, 0.1, PAL.woodDark);
    part(props, base, (x0 + x1) / 2, 1.38, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.12, 0.1, Math.abs(z1 - z0) + 0.12, PAL.wood);
  };
  rail(-w / 2, d / 2, w / 2, d / 2);
  rail(-w / 2, -d / 2 + 0.6, -w / 2, d / 2);
  rail(w / 2, -d / 2 + 0.6, w / 2, d / 2);
}

/** Mossy granite spire (≈ h m): stacked faceted blocks tapering upward, moss caps on the ledges. */
export function rockSpire(props: MeshBuf, x: number, y: number, z: number, rng: Rng, h: number): { top: number } {
  let yy = y - 0.6;
  const n = 5;
  for (let k = 0; k < n && yy < y + h; k++) {
    const r = (1 - k / (n + 1)) * h * 0.24;
    const jx = rng.range(-0.3, 0.3) * r, jz = rng.range(-0.3, 0.3) * r;
    crag(props, x + jx, yy + r * 0.7, z + jz, r * rng.range(1.0, 1.25), r * rng.range(0.9, 1.1), r * rng.range(0.9, 1.15), rng.range(0, 6.3), rng,
      rng.pick([...PAL.granite]), false);
    wm.copy(trs(x + jx + r * 0.2, yy + r * 1.45, z + jz, 0, r * 0.62, r * 0.18, r * 0.55, lm));
    sphere(props, wm, PAL.moss, 7, 4);
    yy += r * 1.45;
  }
  return { top: yy };
}
