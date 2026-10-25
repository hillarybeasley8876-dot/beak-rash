// Critters and plants of the gobi: camels (the caravan), oasis palms and the dust devils.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';
import { C } from './kit';

const m = new Matrix4();
const UP = new Vector3(0, 1, 0);
const dir = new Vector3(), q = new Quaternion(), sc = new Vector3(), from = new Vector3(), to = new Vector3();

/** A capsule-ish rod from `a` to `b` (cylinder along the segment). */
export function rod(buf: MeshBuf, a: Vector3, b: Vector3, r: number, col: Color, segs = 6, rTop = r): void {
  dir.subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return;
  q.setFromUnitVectors(UP, dir.normalize());
  cylinder(buf, m.compose(a, q, sc.set(r, len, r)), col, segs, 1, rTop / r, true);
}

/** A camel, facing `yaw` (models face −Z): body, hump, neck, head, four legs, tail. */
export function camel(buf: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng, s = 1): void {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const bodyY = y + 1.18 * s;
  sphere(buf, trs(x, bodyY, z, yaw, 1.12 * s, 0.6 * s, 0.56 * s, m), C.camel, 10, 7, C.camelDark);
  sphere(buf, trs(x - fx * 0.1 * s, bodyY + 0.52 * s, z - fz * 0.1 * s, yaw, 0.4 * s, 0.3 * s, 0.36 * s, m), C.camel, 8, 6);
  // Neck and head.
  from.set(x + fx * 0.85 * s, bodyY + 0.25 * s, z + fz * 0.85 * s);
  to.set(x + fx * 1.45 * s, bodyY + 0.95 * s, z + fz * 1.45 * s);
  rod(buf, from, to, 0.16 * s, C.camel, 6);
  from.copy(to);
  to.set(x + fx * 1.75 * s, bodyY + 0.86 * s, z + fz * 1.75 * s);
  rod(buf, from, to, 0.14 * s, C.camel, 6);
  box(buf, trs(x + fx * 1.82 * s, bodyY + 0.8 * s, z + fz * 1.82 * s, yaw, 0.3 * s, 0.22 * s, 0.44 * s, m), C.camelDark);
  for (const side of [-1, 1]) {
    cone(buf, trs(x + fx * 1.66 * s + rx * side * 0.12 * s, bodyY + 1.0 * s, z + fz * 1.66 * s + rz * side * 0.12 * s, yaw,
      0.06 * s, 0.18 * s, 0.06 * s, m), C.camelDark, 5);
  }
  // Legs.
  for (const [lx, lz] of [[0.7, 0.3], [0.7, -0.3], [-0.7, 0.3], [-0.7, -0.3]] as Array<[number, number]>) {
    const px = x + fx * lx * s + rx * lz * s, pz = z + fz * lx * s + rz * lz * s;
    from.set(px, bodyY - 0.28 * s, pz);
    to.set(px + rng.range(-0.06, 0.06) * s, y + 0.04 * s, pz + rng.range(-0.06, 0.06) * s);
    rod(buf, from, to, 0.1 * s, C.camelDark, 5);
  }
  // Tail.
  from.set(x - fx * 1.05 * s, bodyY + 0.3 * s, z - fz * 1.05 * s);
  to.set(x - fx * 1.25 * s, bodyY - 0.15 * s, z - fz * 1.25 * s);
  rod(buf, from, to, 0.05 * s, C.camelDark, 4);
}

/** Oasis palm: a leaning trunk and a crown of fronds (fronds go in the double-sided batch). */
export function palm(props: MeshBuf, thin: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng, s = 1): void {
  const lean = rng.range(-0.25, 0.25);
  const h = rng.range(4.4, 6.2) * s;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let prev = new Vector3(x, y, z);
  const segs = 5;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const px = x + fx * lean * h * t * t, pz = z + fz * lean * h * t * t;
    const next = new Vector3(px, y + h * t, pz);
    rod(props, prev, next, (0.24 - 0.08 * t) * s, C.mudDark, 6);
    prev = next;
  }
  const fronds = rng.int(7, 9);
  for (let i = 0; i < fronds; i++) {
    const a = yaw + (i / fronds) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const len = rng.range(1.9, 2.7) * s;
    const droop = rng.range(0.35, 0.7);
    const tip = new Vector3(prev.x + Math.sin(a) * len, prev.y - droop * s, prev.z + Math.cos(a) * len);
    const mid = new Vector3(prev.x + Math.sin(a) * len * 0.5, prev.y + 0.25 * s, prev.z + Math.cos(a) * len * 0.5);
    rod(thin, prev, mid, 0.1 * s, i % 2 ? C.green : C.greenDark, 4, 0.16 * s);
    rod(thin, mid, tip, 0.16 * s, i % 2 ? C.green : C.greenDark, 4, 0.03 * s);
  }
  // Coconuts.
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, 6.28);
    sphere(props, trs(prev.x + Math.sin(a) * 0.35, prev.y - 0.25, prev.z + Math.cos(a) * 0.35, 0, 0.16, 0.18, 0.16, m), C.mudDark, 6, 4);
  }
}

/** Dust devil: a tall, thin sand funnel (the group is spun slowly at runtime). */
export function dustDevil(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, h = 9): void {
  const rings = 6;
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const r = (1.15 - t * 0.95) * rng.range(0.85, 1.1);
    const yy = y + h * t;
    cone(buf, trs(x + rng.range(-0.35, 0.35), yy, z + rng.range(-0.35, 0.35), rng.range(0, 6.28), r, h / rings * 1.2, r, m),
      i % 2 ? C.sandLit : C.sand, 8);
  }
}
