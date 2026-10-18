// Marine props for the float-sway buffer (uv.x = phase, uv.y = height weight for roll):
// sailboats, small fishing boats, buoys. Origin at the waterline, bow toward local −Z.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const HULLS = [C('#f6f3ec'), C('#e5191c'), C('#2f7fc1'), C('#ffcf1f'), C('#2a9d8f')];
const SAIL = C('#fbfaf5'), STRIPE = C('#e5191c'), MAST = C('#5b4636'), DECK = C('#c99a66'), DARK = C('#24262c');
const m = new Matrix4(), lm = new Matrix4();
const n = new Vector3(), p = new Vector3();

/** Tapered hull: a box with a pointed bow built from two quads per side. */
function hull(buf: MeshBuf, base: Matrix4, len: number, beam: number, depth: number, col: Color, deck: Color): void {
  const L = len / 2, B = beam / 2;
  const pts = {
    sternL: [-B, 0, L], sternR: [B, 0, L], midL: [-B, 0, -L * 0.25], midR: [B, 0, -L * 0.25], bow: [0, 0.15, -L],
  } as const;
  const top = (k: keyof typeof pts, y: number): Vector3 => p.set(pts[k][0], pts[k][1] + y, pts[k][2]).clone().applyMatrix4(base);
  const quad = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color): void => {
    n.subVectors(b, a).cross(new Vector3().subVectors(d, a)).normalize();
    const ids = [a, b, c, d].map((v) => buf.vert(v, n, color));
    buf.quad(ids[0] ?? 0, ids[1] ?? 0, ids[2] ?? 0, ids[3] ?? 0);
  };
  const tri = (a: Vector3, b: Vector3, c: Vector3, color: Color): void => {
    n.subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    buf.tri(buf.vert(a, n, color), buf.vert(b, n, color), buf.vert(c, n, color));
  };
  const lo = -depth, hi = depth * 0.6;
  // Sides (outer faces), stern, bow wedges, deck.
  quad(top('sternR', lo), top('midR', lo), top('midR', hi), top('sternR', hi), col);
  quad(top('midL', lo), top('sternL', lo), top('sternL', hi), top('midL', hi), col);
  quad(top('sternL', lo), top('sternR', lo), top('sternR', hi), top('sternL', hi), col);
  quad(top('midR', lo), top('bow', lo * 0.3), top('bow', hi + 0.2), top('midR', hi), col);
  quad(top('bow', lo * 0.3), top('midL', lo), top('midL', hi), top('bow', hi + 0.2), col);
  quad(top('sternL', hi), top('sternR', hi), top('midR', hi), top('midL', hi), deck);
  tri(top('midL', hi), top('midR', hi), top('bow', hi + 0.2), deck);
}

export function sailboat(buf: MeshBuf, x: number, z: number, yaw: number, rng: Rng, scale = 1): void {
  const phase = rng.range(0, 6.28);
  buf.stamp(phase, 0);
  const base = trs(x, 0, z, yaw, scale, scale, scale, new Matrix4());
  hull(buf, base, 6, 2.1, 0.5, rng.pick(HULLS), DECK);
  const mastH = 7.5;
  // Mast + boom + sails carry the roll weight (uv.y = height).
  const at = (lx: number, ly: number, lz: number): Vector3 => new Vector3(lx, ly, lz).applyMatrix4(base);
  buf.stamp(phase, 0.5);
  cylinder(buf, new Matrix4().multiplyMatrices(base, trs(0, 0.3, -0.4, 0, 0.07, mastH, 0.07, lm)), MAST, 6, 1, 0.7, false);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 1.4, 0.8, 0, 0.08, 0.08, 2.4, lm)), MAST);
  // Two faces 3 cm apart (not coincident) so the outline hull can grow around both sides.
  const sail = (a: Vector3, b: Vector3, c: Vector3, color: Color): void => {
    n.subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    buf.tri(buf.vert(a, n, color), buf.vert(b, n, color), buf.vert(c, n, color));
    const off = n.clone().multiplyScalar(-0.03);
    n.negate();
    const a2 = a.clone().add(off), b2 = b.clone().add(off), c2 = c.clone().add(off);
    buf.tri(buf.vert(a2, n, color), buf.vert(c2, n, color), buf.vert(b2, n, color));
  };
  buf.stamp(phase, 1);
  sail(at(0.02, 1.5, -0.35), at(0.02, mastH - 0.2, -0.35), at(0.02, 1.5, 1.9), SAIL);
  sail(at(0.03, 2.6, -0.33), at(0.03, 3.3, -0.33), at(0.03, 2.6, 1.35), STRIPE);
  sail(at(-0.02, 1.2, -0.45), at(-0.02, mastH - 0.6, -0.45), at(-0.02, 0.9, -2.6), rng.chance(0.5) ? STRIPE : SAIL);
  buf.stamp(0, 0);
}

export function fishingBoat(buf: MeshBuf, x: number, z: number, yaw: number, rng: Rng): void {
  const phase = rng.range(0, 6.28);
  buf.stamp(phase, 0);
  const base = trs(x, 0, z, yaw, 1, 1, 1, new Matrix4());
  hull(buf, base, 5, 2, 0.45, rng.pick(HULLS), DECK);
  buf.stamp(phase, 0.4);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 1.0, 0.9, 0, 1.4, 1.2, 1.3, lm)), C('#f6f3ec'));
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 1.7, 0.9, 0, 1.6, 0.15, 1.5, lm)), STRIPE);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 1.15, 0.24, 0, 1.0, 0.45, 0.05, lm)), DARK);
  buf.stamp(phase, 0.8);
  cylinder(buf, new Matrix4().multiplyMatrices(base, trs(0, 1.7, 1.1, 0, 0.05, 1.6, 0.05, lm)), MAST, 5, 1, 1, false);
  sphere(buf, new Matrix4().multiplyMatrices(base, trs(0.5, 0.65, -0.9, 0, 0.2, 0.2, 0.2, lm)), C('#ff8a3d'), 6, 4);
  buf.stamp(0, 0);
}

export function buoy(buf: MeshBuf, x: number, z: number, rng: Rng): void {
  buf.stamp(rng.range(0, 6.28), 0.3);
  const red = rng.chance(0.6);
  cylinder(buf, trs(x, -0.3, z, 0, 0.45, 0.7, 0.45, m), red ? STRIPE : C('#ffcf1f'), 10, 1, 0.8);
  cylinder(buf, trs(x, 0.4, z, 0, 0.36, 0.25, 0.36, m), SAIL, 10, 1, 0.9);
  cone(buf, trs(x, 0.65, z, 0, 0.3, 0.7, 0.3, m), red ? STRIPE : C('#ffcf1f'), 8);
  buf.stamp(0, 0);
}

/** Timber mooring pile standing in the harbour, from below the seabed up to yTop (quay furniture
 *  stands on these, clear of the quay's drop line). */
export function pile(buf: MeshBuf, x: number, yTop: number, z: number): void {
  cylinder(buf, trs(x, -4, z, 0, 0.21, yTop + 4, 0.21, m), MAST, 8, 1, 1, true, DECK);
}
