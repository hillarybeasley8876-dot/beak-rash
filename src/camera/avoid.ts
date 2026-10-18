// Keeps the chase / crash camera out of solid obstacles (traffic, police car, props). When the eye, or its
// sight line to the followed rider, comes within reach of a box (inflated by 0.5 m, plus 0.35 s of the
// closing speed along the road, so an oncoming bus is seen coming), a spring (ω 12) lifts the eye over the
// roof (+1.0 m) while it keeps looking at the rider. A last-resort floor never lets the eye sit inside a box.
import { springStep } from '../core/math';
import type { Session } from '../core/contracts';
import type { Obstacle } from '../core/types';

export const AVOID = { margin: 0.5, roof: 1.0, omega: 12, lead: 0.35, hard: 0.2, samples: 8, scan: 30 };

/** A point of the camera's world in track space: s along the road, x lateral, y above the road. */
export interface TrackPoint { s: number; x: number; y: number }

/** True when the sight line a → b passes through the obstacle box (sampled). */
function blocks(o: Obstacle, a: TrackPoint, b: TrackPoint): boolean {
  for (let i = 1; i < AVOID.samples; i++) {
    const t = i / AVOID.samples;
    const s = a.s + (b.s - a.s) * t;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (Math.abs(s - o.s) < o.halfLength && Math.abs(x - o.x) < o.halfWidth && y < o.height) return true;
  }
  return false;
}

export class ObstacleAvoid {
  /** Current lift of the eye (m), for telemetry. */
  lift = 0;
  private liftV = 0;
  private lastS = Number.NaN;

  reset(): void {
    this.lift = 0;
    this.liftV = 0;
    this.lastS = Number.NaN;
  }

  /** Eye height above the road after avoidance; `eye.y` is the unobstructed height, `target` the rider. */
  update(session: Session, eye: TrackPoint, target: TrackPoint, dt: number): number {
    const vs = dt > 1e-5 && Number.isFinite(this.lastS) ? (eye.s - this.lastS) / dt : 0;
    this.lastS = eye.s;
    let need = 0;
    let floor = 0;
    for (const o of session.obstacles) {
      if (!o.active || !o.solid) continue;
      const ds = Math.abs(o.s - eye.s);
      if (ds > o.halfLength + AVOID.scan) continue;
      const roof = o.height + AVOID.roof - eye.y;
      if (roof <= 0) continue;
      const closing = Math.max(0, (o.s > eye.s ? -1 : 1) * (o.speed - vs));
      const near = ds < o.halfLength + AVOID.margin + closing * AVOID.lead && Math.abs(o.x - eye.x) < o.halfWidth + AVOID.margin;
      if (near || blocks(o, eye, target)) need = Math.max(need, roof);
      if (ds < o.halfLength + AVOID.hard && Math.abs(o.x - eye.x) < o.halfWidth + AVOID.hard) {
        floor = Math.max(floor, o.height + AVOID.hard - eye.y);
      }
    }
    if (dt > 0) [this.lift, this.liftV] = springStep(this.lift, this.liftV, need, AVOID.omega, dt);
    if (this.lift < floor) {
      this.lift = floor;
      this.liftV = Math.max(0, this.liftV);
    }
    return eye.y + Math.max(0, this.lift);
  }
}
