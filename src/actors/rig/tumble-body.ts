// Tiny rigid-body integrator for crash tumbles (body, bike, helmet): gravity, spin, bounces and skids
// on a ground plane given per step (point P, normal N). Visual only — the sim owns the real rider.
import { Quaternion, Vector3 } from 'three';

export interface Ground { P: Vector3; N: Vector3 }

const tq = new Quaternion(), vn = new Vector3(), vt = new Vector3(), ax = new Vector3(), up = new Vector3();
export const GRAVITY = 15;

export class TumbleBody {
  readonly p = new Vector3();
  readonly v = new Vector3();
  readonly q = new Quaternion();
  readonly w = new Vector3();
  resting = false;
  bounces = 0;
  /** Seconds since the last ground contact (0 while touching). */
  air = 0;

  constructor(public r: number, public e: number, public mu: number, public flop = 0) {}

  set(p: Vector3, v: Vector3, q: Quaternion, w: Vector3): void {
    this.p.copy(p); this.v.copy(v); this.q.copy(q); this.w.copy(w);
    this.resting = false;
    this.bounces = 0;
    this.air = 0;
  }

  /** Advance by dt (internally sub-stepped). Returns the strongest impact speed this step. */
  step(dt: number, g: Ground): number {
    let impact = 0;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) impact = Math.max(impact, this.sub(h, g));
    return impact;
  }

  private sub(dt: number, g: Ground): number {
    this.v.y -= GRAVITY * dt;
    this.p.addScaledVector(this.v, dt);
    const wl = this.w.length();
    if (wl > 1e-6) {
      tq.setFromAxisAngle(ax.copy(this.w).multiplyScalar(1 / wl), wl * dt);
      this.q.premultiply(tq).normalize();
    }
    const height = vn.subVectors(this.p, g.P).dot(g.N) - this.r;
    if (height > 0.002) {
      this.air += dt;
      return 0;
    }
    this.air = 0;
    this.p.addScaledVector(g.N, -height);
    const vNorm = this.v.dot(g.N);
    vt.copy(this.v).addScaledVector(g.N, -vNorm);
    let impact = 0;
    if (vNorm < -0.6) {
      impact = -vNorm;
      this.bounces++;
      this.v.copy(vt).multiplyScalar(Math.max(0, 1 - this.mu * 0.35)).addScaledVector(g.N, -vNorm * this.e);
      // Scuffing the ground turns sliding into tumbling.
      this.w.multiplyScalar(0.7).add(ax.crossVectors(g.N, vt).multiplyScalar(0.45 / this.r));
    } else {
      // Skid: kinetic friction + rolling resistance; settles flat (flop) when slow.
      const sp = vt.length();
      const dec = Math.min(sp, this.mu * GRAVITY * dt);
      this.v.copy(vt).multiplyScalar(sp > 1e-5 ? (sp - dec) / sp : 0);
      this.w.multiplyScalar(Math.exp(-5 * dt));
      if (this.flop > 0) {
        up.set(0, 1, 0).applyQuaternion(this.q);
        const d = up.dot(g.N);
        if (Math.abs(d) > 0.35) this.w.add(ax.crossVectors(up, g.N).normalize().multiplyScalar(-Math.sign(d) * this.flop * dt * 30));
      }
      this.resting = sp < 0.3 && this.w.length() < 0.8;
    }
    return impact;
  }
}
