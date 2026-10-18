// Sunset Pass vegetation props (env-mountain): tiered pines, slim firs, golden birches, tea bushes
// and a cheap far pine (single cone, for unoutlined distant forests). Chunky toon forms; bases sink
// a little into the ground; per-instance variation from the rng.
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { cone, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const PAL = {
  trunk: C('#7a4b33'), trunkDark: C('#5c3826'),
  pine: [C('#2f6b3f'), C('#2a6040'), C('#386f37')], pineTop: C('#4f8a46'),
  fir: [C('#245a4a'), C('#2b5f4c')], firTop: C('#3f7a5a'),
  birch: C('#f2ece0'), birchMark: C('#2b2a2e'), birchLeaf: [C('#e0b743'), C('#c9c24f'), C('#e88f3a')],
  tea: C('#4f9a3c'), teaTop: C('#7fbf4a'),
};
const m = new Matrix4();

/** Pine: short trunk + 3–4 stacked cone tiers, lighter tip. Height ≈ 7–11 m × scale. */
export function pine(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const H = rng.range(7, 10.5) * scale, R = rng.range(2.1, 2.8) * scale;
  const col = rng.pick(PAL.pine);
  cylinder(buf, trs(x, y - 0.4, z, 0, 0.28 * scale, H * 0.32, 0.28 * scale, m), PAL.trunk, 6, 1, 0.8, false);
  const tiers = rng.int(3, 4);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = R * (1 - t * 0.62), h = (H * 0.5) * (1 - t * 0.25);
    const y0 = y + H * 0.2 + t * H * 0.62;
    const ox = rng.range(-0.12, 0.12) * scale, oz = rng.range(-0.12, 0.12) * scale;
    cone(buf, trs(x + ox, y0, z + oz, rng.range(0, 6.28), r, h, r, m), i === tiers - 1 ? PAL.pineTop : col, 8);
  }
}

/** Fir: tall and slim, 5 tiers, blue-green. Height ≈ 10–14 m × scale. */
export function fir(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const H = rng.range(10, 14) * scale, R = rng.range(1.6, 2.1) * scale;
  const col = rng.pick(PAL.fir);
  cylinder(buf, trs(x, y - 0.4, z, 0, 0.24 * scale, H * 0.25, 0.24 * scale, m), PAL.trunkDark, 6, 1, 0.8, false);
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const r = R * (1 - t * 0.7), h = H * 0.34 * (1 - t * 0.3);
    cone(buf, trs(x, y + H * 0.14 + t * H * 0.66, z, rng.range(0, 6.28), r, h, r, m), i === 4 ? PAL.firTop : col, 7);
  }
}

/** Birch: white trunk with dark marks, a few golden autumn blobs. Height ≈ 7–9 m × scale. */
export function birch(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const H = rng.range(6.5, 8.5) * scale;
  const lean = rng.range(-0.25, 0.25);
  const K = 5;
  for (let i = 0; i < K; i++) {
    const t0 = i / K;
    cylinder(buf, trs(x + lean * t0 * 0.5, y - 0.3 + t0 * H * 0.75, z, 0, 0.16 * scale, (H * 0.75) / K, 0.16 * scale, m), i % 2 ? PAL.birchMark : PAL.birch, 6, 1, 0.92, false);
  }
  const leaf = rng.pick(PAL.birchLeaf);
  const top = y + H * 0.72;
  for (let k = 0; k < 3; k++) {
    const r = rng.range(1.2, 1.7) * scale;
    sphere(buf, trs(x + lean * 0.4 + rng.range(-0.8, 0.8) * scale, top + k * 0.9 * scale, z + rng.range(-0.8, 0.8) * scale, 0, r, r * 0.85, r, m), leaf, 8, 5);
  }
}

/** Distant pine (one cone + stub): ~16 triangles, for the unoutlined far forest. */
export function farPine(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const H = rng.range(8, 12) * scale, R = rng.range(1.8, 2.6) * scale;
  cone(buf, trs(x, y - 0.5, z, rng.range(0, 6.28), R, H, R, m), rng.pick(PAL.pine), 6);
}

/** Round tea bush (terraces): a squashed blob with a lighter top. */
export function teaBush(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, len: number, yaw: number): void {
  const r = rng.range(0.55, 0.7);
  sphere(buf, trs(x, y + r * 0.3, z, yaw, len * 0.5, r * 0.9, r, m), PAL.tea, 7, 4, PAL.tea.clone().multiplyScalar(0.75));
  sphere(buf, trs(x, y + r * 0.85, z, yaw, len * 0.42, r * 0.35, r * 0.75, m), PAL.teaTop, 6, 3);
}
