// Blend-out from a cinematic camera back to the live chase pose, in the rider's frame. The start pose is
// stored relative to an anchor (the followed rider + road frame) so it travels with the rider; the camera
// arcs around the rider (cylindrical lerp of radius / azimuth / height about the anchor's up axis) instead
// of flying a straight world line through traffic, and its orientation slerps in the same frame.
// Short residual blends stretch (up to 0.35 s) so the camera never exceeds ~15 m/s / 480°/s relative to the
// rider; starts too far from the chase pose (> 90° or > 12 m) hard-cut on the release whoosh instead of
// whipping ~170° across the scene in a third of a second.
import { Quaternion, Vector3, type PerspectiveCamera } from 'three';
import { DEG, lerp, wrapAngle } from '../core/math';
import type { CamPose } from './chase';

export const BLEND = { cutAngle: 90 * DEG, cutDist: 12, maxSpeed: 15, maxTurn: 480 * DEG, maxDur: 0.35 };

/** Peak rate of the smootherstep ramp relative to its average. */
const PEAK = 1.875;

/** Followed point (world) and the road frame there (+X right, +Y up, −Z forward). */
export interface Anchor { pos: Vector3; quat: Quaternion }

const smoother = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** Cylindrical interpolation about +Y (anchor space): never closer to the axis than the nearer end. */
function arc(a: Vector3, b: Vector3, t: number, out: Vector3): Vector3 {
  const ra = Math.hypot(a.x, a.z);
  const rb = Math.hypot(b.x, b.z);
  const pa = Math.atan2(a.x, a.z);
  const pb = Math.atan2(b.x, b.z);
  const p = pa + wrapAngle(pb - pa) * t;
  const r = lerp(ra, rb, t);
  return out.set(Math.sin(p) * r, lerp(a.y, b.y, t), Math.cos(p) * r);
}

export class Blend {
  /** Hard cuts taken so far (telemetry: a cut is a deliberate one-frame change, not a pop). */
  cuts = 0;
  /** Angle (rad) and distance (m) between the last start pose and the chase pose (telemetry). */
  lastGap = { angle: 0, dist: 0 };
  private from: CamPose = { pos: new Vector3(), quat: new Quaternion(), fov: 60 };
  private rel: CamPose = { pos: new Vector3(), quat: new Quaternion(), fov: 60 };
  private fresh = false;
  private t = 1;
  private dur = 0.35;
  private inv = new Quaternion();
  private tq = new Quaternion();
  private mq = new Quaternion();
  private tp = new Vector3();
  private mp = new Vector3();

  get active(): boolean {
    return this.t < 1;
  }

  start(cam: PerspectiveCamera, dur: number): void {
    this.from.pos.copy(cam.position);
    this.from.quat.copy(cam.quaternion);
    this.from.fov = cam.fov;
    this.dur = Math.max(0.01, dur);
    this.t = 0;
    this.fresh = true;
  }

  stop(): void {
    this.t = 1;
    this.fresh = false;
  }

  /** A deliberate hard cut decided outside the blend (e.g. a respawn glide that would lose the rider). */
  cut(): void {
    this.stop();
    this.cuts++;
  }

  /** Mixes `pose` (the live chase target) in place; `anchor` is the rider frame this frame. */
  apply(pose: CamPose, anchor: Anchor, dtReal: number): void {
    if (!this.active) return;
    this.inv.copy(anchor.quat).invert();
    if (this.fresh) {
      this.fresh = false;
      const ang = this.from.quat.angleTo(pose.quat);
      const dist = this.from.pos.distanceTo(pose.pos);
      this.lastGap.angle = ang;
      this.lastGap.dist = dist;
      if (ang > BLEND.cutAngle || dist > BLEND.cutDist) {
        this.t = 1;
        this.cuts++;
        return;
      }
      const need = PEAK * Math.max(dist / BLEND.maxSpeed, ang / BLEND.maxTurn);
      this.dur = Math.max(this.dur, Math.min(BLEND.maxDur, need));
      this.rel.pos.copy(this.from.pos).sub(anchor.pos).applyQuaternion(this.inv);
      this.rel.quat.copy(this.inv).multiply(this.from.quat);
      this.rel.fov = this.from.fov;
    }
    this.t = Math.min(1, this.t + dtReal / this.dur);
    const a = smoother(this.t);
    this.tp.copy(pose.pos).sub(anchor.pos).applyQuaternion(this.inv);
    arc(this.rel.pos, this.tp, a, this.mp);
    pose.pos.copy(this.mp).applyQuaternion(anchor.quat).add(anchor.pos);
    // Separate scratch quaternions: slerping into an argument would alias it (three's slerpQuaternions
    // copies qa into `this` first, so `x.slerpQuaternions(from, x, a)` never leaves `from`).
    this.tq.copy(this.inv).multiply(pose.quat);
    this.mq.copy(this.rel.quat).slerp(this.tq, a);
    pose.quat.copy(anchor.quat).multiply(this.mq);
    pose.fov = lerp(this.rel.fov, pose.fov, a);
  }
}
