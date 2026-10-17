// Nature props written into MeshBufs: palm trees, umbrella pines, cypresses, bushes, boulders.
// Chunky toon forms with a little per-instance variation (rng); bases sink slightly into the ground.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const PAL = {
  trunkA: C('#9a6a42'), trunkB: C('#7f5536'), frond: C('#3f9d3b'), frondUnder: C('#2c7a2e'), frondTip: C('#9ccf4a'),
  coconut: C('#6a4526'), pine: C('#4f8f3a'), pineDark: C('#3a7030'), pineTrunk: C('#8a5a3c'),
  cypress: C('#2f6b35'), cypressDark: C('#245429'), bush: C('#5fa843'), bushDark: C('#4a8c37'), flower: C('#ff5fa2'),
  rockA: C('#a89a88'), rockB: C('#8f8170'), rockC: C('#bfb3a0'),
};

const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), v = new Vector3(), w = new Vector3();

/** Matrix mapping the unit cylinder (y 0..1) onto the segment a→b with radius r. */
function segment(a: Vector3, b: Vector3, r: number, out: Matrix4): Matrix4 {
  v.subVectors(b, a);
  const len = v.length();
  q.setFromUnitVectors(up, v.normalize());
  return out.compose(a, q, w.set(r, len, r));
}

export function palm(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const H = rng.range(6.5, 9.5) * scale;
  const lean = rng.range(0.05, 0.22), dir = rng.range(0, Math.PI * 2);
  const pts: Vector3[] = [];
  const SEG = 6;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const off = lean * H * t * t;
    pts.push(new Vector3(x + Math.cos(dir) * off, y - 0.3 + H * t, z + Math.sin(dir) * off));
  }
  for (let i = 0; i < SEG; i++) {
    const r = (0.3 - 0.12 * (i / SEG)) * scale;
    cylinder(buf, segment(pts[i] as Vector3, pts[i + 1] as Vector3, r, m), i % 2 ? PAL.trunkA : PAL.trunkB, 7, 1, 0.86, false);
  }
  const top = pts[SEG] as Vector3;
  const n = rng.int(7, 9);
  for (let k = 0; k < n; k++) frond(buf, top, (k / n) * Math.PI * 2 + rng.range(-0.2, 0.2), rng.range(2.6, 3.6) * scale, rng.range(0.35, 0.75));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    sphere(buf, trs(top.x + Math.cos(a) * 0.28 * scale, top.y - 0.35 * scale, top.z + Math.sin(a) * 0.28 * scale, 0, 0.2 * scale, 0.22 * scale, 0.2 * scale, m), PAL.coconut, 6, 4);
  }
}

/** One drooping V-section leaf from the crown. */
function frond(buf: MeshBuf, top: Vector3, yaw: number, len: number, droop: number): void {
  const K = 5;
  const dx = Math.cos(yaw), dz = Math.sin(yaw);
  const sx = -dz, sz = dx; // sideways
  const ids: number[][] = [];
  const n = new Vector3(0, 1, 0), p = new Vector3();
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    const reach = len * t, drop = len * droop * t * t - 0.35 * t;
    const cx = top.x + dx * reach, cy = top.y + 0.15 - drop, cz = top.z + dz * reach;
    const wdt = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.55 * (len / 3);
    const col = t > 0.75 ? PAL.frondTip : PAL.frond;
    const row: number[] = [];
    for (const [s, dy] of [[-1, 0.12], [0, 0], [1, 0.12]] as Array<[number, number]>) {
      p.set(cx + sx * s * wdt, cy + dy * wdt, cz + sz * s * wdt);
      n.set(-sx * s * 0.5, 1, -sz * s * 0.5).normalize();
      row.push(buf.vert(p, n, col));
    }
    for (const [s, dy] of [[-1, 0.12], [0, 0], [1, 0.12]] as Array<[number, number]>) {
      p.set(cx + sx * s * wdt, cy + dy * wdt - 0.05, cz + sz * s * wdt);
      n.set(sx * s * 0.3, -1, sz * s * 0.3).normalize();
      row.push(buf.vert(p, n, PAL.frondUnder));
    }
    ids.push(row);
  }
  for (let k = 0; k < K; k++) {
    const a = ids[k] as number[], b = ids[k + 1] as number[];
    for (let j = 0; j < 2; j++) {
      // Upper surface faces up; lower surface faces down (reversed winding).
      buf.quad(a[j] ?? 0, a[j + 1] ?? 0, b[j + 1] ?? 0, b[j] ?? 0);
      buf.quad(a[j + 3] ?? 0, b[j + 3] ?? 0, b[j + 4] ?? 0, a[j + 4] ?? 0);
    }
  }
}

export function umbrellaPine(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const H = rng.range(5, 7.5) * scale, R = rng.range(2.6, 3.6) * scale;
  const bend = rng.range(-0.6, 0.6);
  const top = new Vector3(x + bend, y + H, z + bend * 0.4);
  cylinder(buf, segment(new Vector3(x, y - 0.3, z), top, 0.24 * scale, m), PAL.pineTrunk, 7, 1, 0.7, false);
  sphere(buf, trs(top.x, top.y + 0.3 * scale, top.z, rng.range(0, 3), R, R * 0.38, R * 0.92, m), PAL.pine, 9, 5, PAL.pineDark);
  sphere(buf, trs(top.x + R * 0.35, top.y + 0.7 * scale, top.z - R * 0.2, 0, R * 0.55, R * 0.3, R * 0.55, m), PAL.pine, 6, 4, PAL.pineDark);
}

export function cypress(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const H = rng.range(6, 9) * scale, R = rng.range(0.8, 1.1) * scale;
  cylinder(buf, trs(x, y - 0.3, z, 0, 0.18 * scale, 1.2 * scale, 0.18 * scale, m), PAL.pineTrunk, 6, 1, 1, false);
  sphere(buf, trs(x, y + 0.6 * scale + H / 2, z, 0, R, H / 2, R, m), PAL.cypress, 7, 6, PAL.cypressDark);
}

export function bush(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1, flowers = false): void {
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.55, 0.95) * scale;
    sphere(buf, trs(x + rng.range(-0.6, 0.6) * scale, y + r * 0.55 - 0.1, z + rng.range(-0.6, 0.6) * scale, 0, r, r * 0.8, r, m), PAL.bush, 7, 4, PAL.bushDark);
  }
  if (!flowers) return;
  for (let i = 0; i < 4; i++) {
    sphere(buf, trs(x + rng.range(-0.7, 0.7) * scale, y + rng.range(0.6, 1.1) * scale, z + rng.range(-0.7, 0.7) * scale, 0, 0.13, 0.13, 0.13, m), PAL.flower, 5, 3);
  }
}

/** Faceted boulder (low-poly on purpose: rocks read better with flat facets). */
export function boulder(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, size: number): void {
  const col = rng.pick([PAL.rockA, PAL.rockB, PAL.rockC]);
  const sx = size * rng.range(0.8, 1.3), sy = size * rng.range(0.5, 0.9), sz = size * rng.range(0.8, 1.2);
  sphere(buf, trs(x, y + sy * 0.35, z, rng.range(0, 6), sx, sy, sz, m), col, 6, 4);
}
