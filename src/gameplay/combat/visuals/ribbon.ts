// Camera-facing ribbon strip with per-point width and alpha (trails, lightning, tethers).
import { BufferAttribute, BufferGeometry, Color, Mesh, Vector3, type ColorRepresentation } from 'three';
import type { MaterialPool } from './materials';

export class Ribbon {
  readonly mesh: Mesh;
  private geo = new BufferGeometry();
  private pos: Float32Array;
  private col: Float32Array;
  private color: Color;
  private t = new Vector3();
  private v = new Vector3();
  private side = new Vector3();

  constructor(pool: MaterialPool, private max: number, color: ColorRepresentation, additive = false) {
    this.color = new Color(color);
    this.pos = new Float32Array(max * 2 * 3);
    this.col = new Float32Array(max * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i < max - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new BufferAttribute(this.col, 4));
    this.geo.setDrawRange(0, 0);
    this.mesh = new Mesh(this.geo, pool.ribbon(additive));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /** Rebuild from the first `count` world points (≤ max). width/alpha get (i, n) with i = 0 at the head. */
  set(
    points: readonly Vector3[], width: (i: number, n: number) => number, alpha: (i: number, n: number) => number, eye: Vector3,
    count = points.length,
  ): void {
    const n = Math.min(count, points.length, this.max);
    if (n < 2) {
      this.geo.setDrawRange(0, 0);
      return;
    }
    for (let i = 0; i < n; i++) {
      const p = points[i] as Vector3;
      const a = points[Math.max(0, i - 1)] as Vector3;
      const b = points[Math.min(n - 1, i + 1)] as Vector3;
      this.t.subVectors(b, a);
      this.v.subVectors(eye, p);
      this.side.crossVectors(this.t, this.v);
      const len = this.side.length();
      if (len > 1e-6) this.side.multiplyScalar(width(i, n) * 0.5 / len);
      else this.side.set(0, width(i, n) * 0.5, 0);
      const o = i * 6;
      this.pos[o] = p.x + this.side.x;
      this.pos[o + 1] = p.y + this.side.y;
      this.pos[o + 2] = p.z + this.side.z;
      this.pos[o + 3] = p.x - this.side.x;
      this.pos[o + 4] = p.y - this.side.y;
      this.pos[o + 5] = p.z - this.side.z;
      const al = alpha(i, n);
      for (let k = 0; k < 2; k++) {
        const c = i * 8 + k * 4;
        this.col[c] = this.color.r;
        this.col[c + 1] = this.color.g;
        this.col[c + 2] = this.color.b;
        this.col[c + 3] = al;
      }
    }
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('color') as BufferAttribute).needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * 6);
  }

  /** The shared material stays with the pool. */
  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
  }
}
