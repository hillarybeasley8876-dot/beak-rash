// Faceted limestone rocks for crags, cliff tops, tunnel caps and shores: a jittered icosahedron with
// flat-shaded facets (each face its own vertices) so the toon ramp paints crisp light/dark planes.
import { Color, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';

const T = (1 + Math.sqrt(5)) / 2;
const ICO_V: Array<[number, number, number]> = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T],
  [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
];
const ICO_F: Array<[number, number, number]> = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];
const LEN = Math.hypot(1, T);

export const LIMESTONE = [new Color('#ece2cc'), new Color('#ddcfb2'), new Color('#cbb894')] as const;

const pts = ICO_V.map(() => new Vector3());
const n = new Vector3(), e1 = new Vector3(), e2 = new Vector3(), shade = new Color();

/**
 * Rock centred at (x, y, z), half-extents (sx, sy, sz), yaw ry; `flatBase` squashes the lower
 * half so it sits on (or sinks into) the ground. Colour from `col` with a small per-facet variation.
 */
export function crag(buf: MeshBuf, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, rng: Rng, col: Color,
  flatBase = true): void {
  const c = Math.cos(ry), s = Math.sin(ry);
  ICO_V.forEach(([vx, vy, vz], i) => {
    const k = rng.range(0.72, 1.12) / LEN;
    let px = vx * k, py = vy * k, pz = vz * k;
    if (flatBase && py < 0) py *= 0.55;
    px *= sx; py *= sy; pz *= sz;
    (pts[i] as Vector3).set(x + px * c + pz * s, y + py, z - px * s + pz * c);
  });
  for (const [a, b, d] of ICO_F) {
    const A = pts[a] as Vector3, B = pts[b] as Vector3, D = pts[d] as Vector3;
    n.crossVectors(e1.subVectors(B, A), e2.subVectors(D, A)).normalize();
    // Up-facing facets slightly lighter (sun-bleached tops), a little noise per facet.
    shade.copy(col).multiplyScalar(0.94 + 0.08 * Math.max(0, n.y) + rng.range(-0.03, 0.03));
    const i0 = buf.vert(A, n, shade), i1 = buf.vert(B, n, shade), i2 = buf.vert(D, n, shade);
    buf.tri(i0, i1, i2);
  }
}

/** A cluster of 1–3 rocks around (x, y, z) with overall size `size` (m). */
export function cragCluster(buf: MeshBuf, x: number, y: number, z: number, size: number, rng: Rng): void {
  const n2 = rng.int(1, 3);
  for (let i = 0; i < n2; i++) {
    const r = size * (i === 0 ? 1 : rng.range(0.4, 0.7));
    const a = rng.range(0, Math.PI * 2), d = i === 0 ? 0 : size * rng.range(0.6, 1.1);
    const col = rng.pick([...LIMESTONE]);
    crag(buf, x + Math.cos(a) * d, y + r * 0.15, z + Math.sin(a) * d, r * rng.range(0.9, 1.3), r * rng.range(0.55, 0.95), r * rng.range(0.8, 1.2),
      rng.range(0, 6.3), rng, col);
  }
}
