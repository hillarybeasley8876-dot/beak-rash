// Swing smear (P5 ink look): a ribbon behind the weapon / wing tip while a strike is active. Three bands across the
// blade — a fading inner edge, a bright white core and a thin red-black ink edge on the outer (tip) side — over a
// tail that tapers toward the tip as it ages. Frame samples are Catmull-Rom subdivided so the arc curves.
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three';

const LIFE = 0.1, MAX_SAMPLES = 8, SUB = 3, ROWS = (MAX_SAMPLES - 1) * SUB + 1;
/** Fractions base → tip across the blade and their colour (rgb) and opacity factor. */
const BANDS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0.0, 1, 1, 1, 0], [0.5, 1, 1, 1, 0.55], [0.86, 1, 1, 1, 0.95], [0.93, 0.9, 0.1, 0.12, 1], [1.0, 0.04, 0.04, 0.06, 1],
];
const K = BANDS.length;

const cr = (p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, out: Vector3): Vector3 => {
  const t2 = t * t, t3 = t2 * t;
  return out.set(0, 0, 0)
    .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t).addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
    .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t).addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
};

const b = new Vector3(), t = new Vector3(), p = new Vector3();

export class SwingSmear {
  readonly mesh: Mesh;
  private readonly base: Vector3[] = [];
  private readonly tip: Vector3[] = [];
  private readonly age: number[] = [];
  private readonly geo = new BufferGeometry();

  constructor() {
    this.geo.setAttribute('position', new BufferAttribute(new Float32Array(ROWS * K * 3), 3));
    this.geo.setAttribute('color', new BufferAttribute(new Float32Array(ROWS * K * 4), 4));
    const idx: number[] = [];
    for (let r = 0; r < ROWS - 1; r++) for (let k = 0; k < K - 1; k++) {
      const a = r * K + k, c = (r + 1) * K + k;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
    this.geo.setIndex(idx);
    this.mesh = new Mesh(this.geo, new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.mesh.userData.noOutline = true;
  }

  /** Feed the current blade (base → tip, parent space) while `active`; the history fades over LIFE seconds. */
  update(base: Vector3, tip: Vector3, active: boolean, dt: number): void {
    for (let i = 0; i < this.age.length; i++) this.age[i] = (this.age[i] ?? 0) + dt;
    if (active) {
      this.base.unshift(base.clone());
      this.tip.unshift(tip.clone());
      this.age.unshift(0);
    }
    while (this.age.length > MAX_SAMPLES || (this.age.length && (this.age[this.age.length - 1] ?? 0) > LIFE)) {
      this.age.pop(); this.base.pop(); this.tip.pop();
    }
    const n = this.age.length;
    this.mesh.visible = n >= 2;
    if (!this.mesh.visible) return;
    const pos = this.geo.getAttribute('position') as BufferAttribute, col = this.geo.getAttribute('color') as BufferAttribute;
    const rows = (n - 1) * SUB + 1, at = (arr: Vector3[], i: number): Vector3 => arr[Math.max(0, Math.min(n - 1, i))] as Vector3;
    for (let r = 0; r < ROWS; r++) {
      const rr = Math.min(r, rows - 1), seg = Math.min(n - 2, Math.floor(rr / SUB)), f = rr / SUB - seg;
      cr(at(this.base, seg - 1), at(this.base, seg), at(this.base, seg + 1), at(this.base, seg + 2), f, b);
      cr(at(this.tip, seg - 1), at(this.tip, seg), at(this.tip, seg + 1), at(this.tip, seg + 2), f, t);
      const ageR = (this.age[seg] ?? 0) * (1 - f) + (this.age[seg + 1] ?? LIFE) * f;
      const life = Math.max(0, 1 - ageR / LIFE), along = rr / Math.max(1, rows - 1);
      // Tapered tail: older rows keep only the outer part of the blade and fade.
      const keep = 0.25 + 0.75 * life, a = life * (1 - 0.6 * along);
      for (let k = 0; k < K; k++) {
        const band = BANDS[k] as readonly [number, number, number, number, number];
        p.copy(b).lerp(t, 1 - keep * (1 - band[0]));
        pos.setXYZ(r * K + k, p.x, p.y, p.z);
        col.setXYZW(r * K + k, band[1], band[2], band[3], band[4] * a);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}
