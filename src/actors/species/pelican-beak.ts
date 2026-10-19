// 阿鹕's beak as smooth lofted surfaces (kit/loft.ts): a broad spoon-shaped upper mandible with a red hooked tip,
// a thin lower mandible on the jaw, and a big pink-orange gular pouch that sags from the throat to near the tip.
// The pouch's widest part hangs just below the face, so its sides show beside the neck from the chase camera;
// its rear blends to the head bone (throat stays put), the rest rides the pouch bone (Big Gulp inflates it).
import { Vector3 } from 'three';
import { smoothstep } from '../../core/math';
import type { CharacterBuilder, Influences } from '../kit/builder';
import { loft } from '../kit/loft';
import type { V3 } from '../kit/sdf';
import { B } from '../rig/skeleton';

export interface BeakColors { beak: number; lower: number; hook: number; pouch: number }

/** Beak base / tip z (bind pose, before the head offset) and the hook start (fraction of the length). */
const Z0 = -0.555, Z1 = -1.105, HOOK = 0.9;

const zAt = (t: number): number => Z0 + (Z1 - Z0) * t;
/** Rounds the last 14 % of the beak to the tip. */
const cap = (t: number): number => (t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1);
/** Gape line (tomium) height; the hook dips down over the last 14 %. */
const edgeY = (t: number): number => 0.718 - 0.022 * t - 0.034 * smoothstep(0.84, 1, t) ** 2;
const halfW0 = (t: number): number => 0.083 + 0.014 * Math.sin(Math.PI * t) - 0.022 * t;
const halfW = (t: number): number => halfW0(t) * cap(t);
/** The lower mandible ends (rounded) at t = 0.97, tucked under the hook. */
const capLow = (t: number): number => (t > 0.83 ? Math.sqrt(Math.max(0, 1 - ((t - 0.83) / 0.14) ** 2)) : 1);

function upperAt(t: number, v: number, o: V3, out: Vector3): Vector3 {
  const a = v * Math.PI * 2, s = Math.sin(a), c = cap(t), w = halfW(t), x = w * Math.cos(a);
  const top = (0.034 - 0.018 * t) * Math.sqrt(c) * Math.max(0, s) ** 0.7 + 0.005 * Math.exp(-((x / 0.022) ** 2)) * Math.max(0, s);
  const y = edgeY(t) + (s >= 0 ? top : 0.006 * c * s);
  return out.set(x + o[0], y + o[1], zAt(t) + o[2]);
}

function lowerAt(t: number, v: number, o: V3, out: Vector3): Vector3 {
  const a = v * Math.PI * 2, s = Math.sin(a), c = capLow(t);
  const w = halfW0(t) * 0.93 * c, y = edgeY(t) - 0.005 + (s >= 0 ? 0.004 * s : (0.017 - 0.007 * t) * Math.sqrt(c) * s);
  return out.set(w * Math.cos(a) + o[0], y + o[1], zAt(t) + o[2]);
}

/** Pouch sack: u = 0 at the throat (z −0.43) → 1 near the tip (z −1.03); widest/deepest at u ≈ 0.2. */
const PZ0 = -0.43, PZ1 = -1.03;
const sackShape = (u: number): number => Math.sin(Math.PI * u ** 0.45) ** 0.6;

function sackTop(z: number): number {
  if (z > -0.6) return 0.62 + 0.084 * smoothstep(-0.43, -0.6, z);
  return edgeY((z - Z0) / (Z1 - Z0)) - 0.013;
}

function sackAt(u: number, v: number, o: V3, out: Vector3): Vector3 {
  const z = PZ0 + (PZ1 - PZ0) * u, k = sackShape(u);
  const wx = 0.18 * k, hy = 0.085 * k ** 1.3, up = 1.1 * hy;
  const a = v * Math.PI * 2, s = Math.sin(a), yc = sackTop(z) - up;
  // A hanging sack: tucked under the mandible on top, deep and full at the bottom.
  const y = yc + (s >= 0 ? up * s : hy * s), x = wx * Math.cos(a) * (s < 0 ? 1 + 0.1 * -s : 1);
  return out.set(x + o[0], y + o[1], z + o[2]);
}

function sackWeights(p: Vector3, o: V3): Influences {
  const w = smoothstep(-0.47, -0.6, p.z - o[2]);
  return w <= 0 ? [[B.head, 1]] : w >= 1 ? [[B.pouch, 1]] : [[B.head, 1 - w], [B.pouch, w]];
}

/** Add the beak and pouch; `o` = head offset added to every point (bind pose). */
export function addPelicanBeak(b: CharacterBuilder, col: BeakColors, o: V3, fine: number): void {
  const n = (k: number): number => Math.max(4, Math.round(k / fine));
  loft(b, { ni: n(14), nj: n(12), at: (u, v, out) => upperAt(u * HOOK, v, o, out), color: col.beak, weights: () => [[B.head, 1]] });
  loft(b, { ni: n(3), nj: n(12), at: (u, v, out) => upperAt(HOOK + u * (1 - HOOK), v, o, out), color: col.hook, weights: () => [[B.head, 1]] });
  loft(b, { ni: n(9), nj: n(8), at: (u, v, out) => lowerAt(u * 0.97, v, o, out), color: col.lower, weights: () => [[B.jaw, 1]] });
  loft(b, { ni: n(12), nj: n(12), at: (u, v, out) => sackAt(u, v, o, out), color: col.pouch, weights: (p) => sackWeights(p, o), outline: 0.8 });
}
