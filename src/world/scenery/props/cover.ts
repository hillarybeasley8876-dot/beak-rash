// Ground cover and terrace props: grass tufts (a fan of blades), flower clumps, olive trees and
// dry-stone wall runs. Tufts/flowers go into an unoutlined double-sided batch; olives and walls
// into the outlined props batch.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const BLADE = [C('#5fae44'), C('#7cc04f'), C('#4f9a3a'), C('#9cc85a')];
const BLOOM = [C('#ff5fa2'), C('#ffd23f'), C('#ffffff'), C('#b388ff'), C('#ff8a3d')];
const OLIVE = { trunk: C('#7d6a55'), leaf: C('#8fa868'), leafDark: C('#6e8a52'), stone: C('#d2c4a4'), stoneTop: C('#b8a888') };
const m = new Matrix4();
const tint = new Color();
const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3();
const dir = new Vector3(), scl = new Vector3(), UP = new Vector3(0, 1, 0), quat = new Quaternion();

/** Grass tuft: 3–5 leaning blades (single triangles) round (x, y, z), height ~h m. */
export function grassTuft(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, h = 0.5): void {
  const col = rng.pick(BLADE);
  const k = rng.int(3, 5), yaw0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < k; i++) {
    const yaw = yaw0 + (i / k) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const dx = Math.cos(yaw), dz = Math.sin(yaw), w = rng.range(0.07, 0.12), hh = h * rng.range(0.7, 1.2), lean = rng.range(0.1, 0.3);
    a.set(x - dz * w, y - 0.04, z + dx * w);
    b.set(x + dz * w, y - 0.04, z - dx * w);
    c.set(x + dx * lean * hh, y + hh, z + dz * lean * hh);
    n.set(dx * 0.3, 1, dz * 0.3).normalize();
    buf.tri(buf.vert(a, n, col), buf.vert(b, n, col), buf.vert(c, n, col));
  }
}

/** Flower clump: a short tuft with a few coloured blossoms (small quads facing up). */
export function flowerClump(buf: MeshBuf, x: number, y: number, z: number, rng: Rng): void {
  grassTuft(buf, x, y, z, rng, 0.35);
  const col = rng.pick(BLOOM), k = rng.int(3, 6);
  n.set(0, 1, 0);
  for (let i = 0; i < k; i++) {
    const px = x + rng.range(-0.28, 0.28), pz = z + rng.range(-0.28, 0.28), py = y + rng.range(0.22, 0.4), r = rng.range(0.06, 0.1);
    const i0 = buf.vert(a.set(px - r, py, pz), n, col), i1 = buf.vert(b.set(px, py, pz + r), n, col);
    const i2 = buf.vert(c.set(px + r, py, pz), n, col), i3 = buf.vert(a.set(px, py, pz - r), n, col);
    buf.quad(i0, i1, i2, i3);
  }
}

/** Olive tree: short gnarled two-part trunk and a cloud of grey-green canopy blobs. */
export function oliveTree(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const lean = rng.range(-0.5, 0.5) * scale, h = rng.range(1.6, 2.2) * scale;
  const mx = x + lean * 0.6, mz = z + lean * 0.3;
  cylinder(buf, segment(a.set(x, y - 0.3, z), b.set(mx, y + h * 0.55, mz), 0.2 * scale), OLIVE.trunk, 6, 1, 0.8, false);
  cylinder(buf, segment(a.set(mx, y + h * 0.5, mz), b.set(x + lean, y + h, z + lean * 0.5), 0.15 * scale), OLIVE.trunk, 6, 1, 0.7, false);
  const k = rng.int(3, 4);
  for (let i = 0; i < k; i++) {
    const ang = rng.range(0, Math.PI * 2), d = rng.range(0.4, 1.0) * scale, r = rng.range(0.9, 1.3) * scale;
    sphere(buf, trs(x + lean + Math.cos(ang) * d, y + h + rng.range(0.1, 0.6) * scale, z + lean * 0.5 + Math.sin(ang) * d, ang, r, r * 0.7, r, m),
      OLIVE.leaf, 7, 4, OLIVE.leafDark);
  }
}

/** Matrix mapping the unit cylinder (y 0..1) onto p→e with radius r. */
function segment(p: Vector3, e: Vector3, r: number): Matrix4 {
  dir.subVectors(e, p);
  const len = dir.length();
  quat.setFromUnitVectors(UP, dir.normalize());
  return m.compose(p, quat, scl.set(r, len, r));
}

/** Dry-stone wall run from p to e (ground points): stepped block, top `h` above the higher end. */
export function stoneWall(buf: MeshBuf, p: Vector3, e: Vector3, h: number): void {
  const len = Math.hypot(e.x - p.x, e.z - p.z);
  if (len < 0.2) return;
  const yaw = Math.atan2(e.x - p.x, e.z - p.z) + Math.PI / 2;
  const lo = Math.min(p.y, e.y) - 0.3, hi = Math.max(p.y, e.y) + h;
  const cx = (p.x + e.x) / 2, cz = (p.z + e.z) / 2;
  // Two courses of dry stone (the upper one set back a little and lighter, so the joint reads) under a
  // capstone row; every segment gets its own tone.
  const tone = 0.92 + ((Math.abs(Math.round(cx * 7 + cz * 13)) % 9) / 9) * 0.14;
  const mid = lo + (hi - lo) * 0.55;
  box(buf, trs(cx, (lo + mid) / 2, cz, yaw, len + 0.1, mid - lo, 0.58, m), tint.copy(OLIVE.stone).multiplyScalar(tone * 0.94));
  box(buf, trs(cx, (mid + hi) / 2 + 0.01, cz, yaw, len + 0.06, hi - mid, 0.5, m), tint.copy(OLIVE.stone).multiplyScalar(tone * 1.04));
  box(buf, trs(cx, hi + 0.06, cz, yaw, len + 0.16, 0.12, 0.62, m), OLIVE.stoneTop);
}
