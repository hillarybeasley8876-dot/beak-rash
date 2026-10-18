// Tiny rigid-body integrator for crash tumbles (body, bike, helmet): gravity, spin, and point contacts with
// restitution + Coulomb friction against a ground plane given per step (point P, normal N). A body touches the
// ground through contact spheres in its own frame (default: one sphere at the origin), so long shapes roll,
// tip over and come to rest on their real extremities instead of sinking. Visual only — the sim owns the rider.
import { Quaternion, Vector3 } from 'three';

export interface Ground { P: Vector3; N: Vector3 }
/** Contact sphere: centre in the body frame (relative to p), radius. */
export interface Contact { p: Vector3; r: number }

const tq = new Quaternion(), wp = new Vector3(), arm = new Vector3(), vc = new Vector3(), tv = new Vector3();
const ax = new Vector3(), rn = new Vector3(), tgt = new Vector3();
export const GRAVITY = 15;
const SLOP = 0.002;

export class TumbleBody {
  readonly p = new Vector3();
  readonly v = new Vector3();
  readonly q = new Quaternion();
  readonly w = new Vector3();
  contacts: Contact[];
  /** Moment of inertia per unit mass (m²). */
  inertia: number;
  /** Local axis that settles parallel to the ground normal (bike: right axis → lies on its side).
   *  null: the local up axis settles perpendicular to it (a body lies flat on its back, front or side). */
  settleAxis: Vector3 | null = null;
  resting = false;
  bounces = 0;
  /** Seconds since the last ground contact (0 while touching). */
  air = 0;

  constructor(public r: number, public e: number, public mu: number, public flop = 0) {
    this.contacts = [{ p: new Vector3(), r }];
    this.inertia = 0.4 * r * r;
  }

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

  /** Push the body out of the ground after its contacts moved (re-posed limbs); returns the push (m). */
  depenetrate(g: Ground): number {
    let deepest = 0;
    for (const c of this.contacts) deepest = Math.min(deepest, this.gap(c, g));
    if (deepest >= -0.003) return 0;
    this.p.addScaledVector(g.N, -deepest);
    const vn = this.v.dot(g.N);
    if (vn < 0) this.v.addScaledVector(g.N, -vn);
    return -deepest;
  }

  /** Signed gap of contact c above the ground (negative = penetrating); leaves its world offset in `arm`. */
  private gap(c: Contact, g: Ground): number {
    arm.copy(c.p).applyQuaternion(this.q);
    return wp.copy(arm).add(this.p).sub(g.P).dot(g.N) - c.r;
  }

  private sub(dt: number, g: Ground): number {
    this.v.y -= GRAVITY * dt;
    this.p.addScaledVector(this.v, dt);
    const wl = this.w.length();
    if (wl > 1e-6) {
      tq.setFromAxisAngle(ax.copy(this.w).multiplyScalar(1 / wl), wl * dt);
      this.q.premultiply(tq).normalize();
    }
    let deepest = Infinity;
    for (const c of this.contacts) deepest = Math.min(deepest, this.gap(c, g));
    if (deepest > SLOP) {
      this.air += dt;
      return 0;
    }
    this.air = 0;
    if (deepest < 0) this.p.addScaledVector(g.N, -deepest);
    let impact = 0;
    for (const c of this.contacts) {
      if (this.gap(c, g) > SLOP) continue;
      arm.addScaledVector(g.N, -c.r);
      const vn = vc.crossVectors(this.w, arm).add(this.v).dot(g.N);
      if (vn >= 0) continue;
      impact = Math.max(impact, -vn);
      const j = (-(1 + (vn < -0.6 ? this.e : 0)) * vn) / (1 + rn.crossVectors(arm, g.N).lengthSq() / this.inertia);
      this.v.addScaledVector(g.N, j);
      this.w.addScaledVector(rn, j / this.inertia);
      // Coulomb friction at the contact point (turns sliding into rolling/tumbling).
      vc.crossVectors(this.w, arm).add(this.v);
      tv.copy(vc).addScaledVector(g.N, -vc.dot(g.N));
      const sp = tv.length();
      if (sp < 1e-5) continue;
      tv.multiplyScalar(1 / sp);
      const jt = Math.min(sp / (1 + rn.crossVectors(arm, tv).lengthSq() / this.inertia), this.mu * j);
      this.v.addScaledVector(tv, -jt);
      this.w.addScaledVector(rn, -jt / this.inertia);
    }
    if (impact > 0.6) this.bounces++;
    this.w.multiplyScalar(Math.exp(-2.5 * dt));
    this.settle(dt, g);
    const slide = tv.copy(this.v).addScaledVector(g.N, -this.v.dot(g.N)).length();
    this.resting = slide < 0.3 && this.w.length() < 0.8;
    return impact > 0.6 ? impact : 0;
  }

  /** Nudge the body toward its rest orientation while it touches the ground. */
  private settle(dt: number, g: Ground): void {
    if (this.flop <= 0) return;
    const k = this.flop * dt * 30;
    if (this.settleAxis) {
      ax.copy(this.settleAxis).applyQuaternion(this.q);
      tgt.copy(g.N).multiplyScalar(ax.dot(g.N) >= 0 ? 1 : -1);
      this.w.addScaledVector(rn.crossVectors(ax, tgt), k);
      return;
    }
    ax.set(0, 1, 0).applyQuaternion(this.q);
    const d = ax.dot(g.N);
    if (Math.abs(d) > 0.35) this.w.addScaledVector(rn.crossVectors(ax, g.N).normalize(), -Math.sign(d) * k);
  }
}
