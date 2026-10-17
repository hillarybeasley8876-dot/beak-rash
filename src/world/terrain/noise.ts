// Deterministic 2D value noise + fbm for terrain (world-space, seeded per track).
import { Rng } from '../../core/rng';

export class Noise2 {
  private readonly perm = new Uint16Array(512);
  private readonly vals = new Float32Array(256);

  constructor(seed: number) {
    const rng = new Rng(seed);
    const p = rng.shuffle(Array.from({ length: 256 }, (_, i) => i));
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255] ?? 0;
    for (let i = 0; i < 256; i++) this.vals[i] = rng.range(-1, 1);
  }

  private v(ix: number, iz: number): number {
    const a = this.perm[ix & 255] ?? 0;
    return this.vals[(this.perm[(a + (iz & 255)) & 511] ?? 0) & 255] ?? 0;
  }

  /** Smooth value noise in [-1, 1]. */
  get(x: number, z: number): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = this.v(ix, iz), b = this.v(ix + 1, iz), c = this.v(ix, iz + 1), d = this.v(ix + 1, iz + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }

  /** Fractal sum of `oct` octaves (≈ [-1, 1]). */
  fbm(x: number, z: number, oct = 4): number {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += this.get(x * f + i * 17.3, z * f - i * 9.1) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }

  /** Ridged fbm in [0, 1] (sharp crests) for distant mountains. */
  ridge(x: number, z: number, oct = 4): number {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(this.get(x * f + i * 31.7, z * f + i * 5.3));
      sum += n * n * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.1;
    }
    return sum / norm;
  }
}
