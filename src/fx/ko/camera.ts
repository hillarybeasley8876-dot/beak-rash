// Cinematic camera shots for the KO / ult director. Each shot is a CameraOverride that frames a
// moving subject (smoothed), orbits slowly and dollies in; `stop()` hands the camera back. The rig
// then hard-cuts on the release whoosh when the chase view is far away (> 90°), else arcs home.
import { Vector3, type PerspectiveCamera } from 'three';
import { damp, DEG, lerp } from '../../core/math';
import type { CameraOverride } from '../../core/contracts';

/** Where the camera sits relative to the subject (see framing.ts for the per-kind choices). */
export interface ShotFraming {
  /** Subject heading (unit, world) used to place the first camera angle. */
  heading: Vector3;
  azimuth: number;      // start angle from the heading (rad, 0 = straight ahead looking back)
  orbit: number;        // rad/s (sign = direction)
  dist: [number, number];
  height: [number, number]; // above the road, start → end
  fov: [number, number];
  duration: number;     // seconds over which dist/height/fov interpolate
  delay?: number;       // seconds before that interpolation starts (default 0)
  roll?: number;        // dutch angle (rad)
  lookUp?: number;      // look-at offset above the subject (m)
  bias?: number;        // NDC y the subject is placed at (+ = upper part); the fit shrinks to stay inside the bars
  /** 0..1: how much the camera climbs with a subject that leaves the road (ult leap). */
  heightFollow?: number;
  /** Vertical / horizontal focus follow rates (1/s, defaults 6 / 9); fast for a diving subject. */
  followY?: number;
  followXZ?: number;
  /** SHOWTIME: share of the victims' centroid offset the aim pans toward (default 0.35; 0 = hero centred). */
  pan?: number;
}

export interface ShotSpec extends ShotFraming {
  /** Subject point (world) — read every frame; null = keep the last known point. */
  subject(): Vector3 | null;
  /** Road height under the subject. */
  ground(): number;
  /** While true the shot holds still (game paused). */
  frozen?(): boolean;
  /** Keep the eye inside the track's drivable bounds (moves `eye` in place). */
  confine?(eye: Vector3, focus: Vector3): void;
  /** Push the eye out of the subject's near zone (moves `eye` in place; runs before confine). */
  clear?(eye: Vector3): void;
  /** Radius (m) around the focus that must stay in frame (head, body, bike); the camera backs off to fit
   *  it inside FIT_NDC of the half-height, i.e. clear of the letterbox bars. */
  fit?(): number;
}

export interface Shot {
  readonly override: CameraOverride;
  /** Hand the camera back (from the next frame). */
  stop(): void;
  /** Smoothed subject position (for the post focus). */
  readonly focus: Vector3;
  /** The shot has framed at least one frame (focus is valid). */
  readonly ready: boolean;
}

/** Rig blend-out to register overrides with (used when the chase view is close enough to arc to). */
export const HANDBACK = 0.32;

/** Share of the half-height a fitted subject may fill: the 12 % bars cover |NDC y| > 0.76. */
export const FIT_NDC = 0.6;

const UP = new Vector3(0, 1, 0);

/** Interpolation weight of a framing `t` seconds in (ease-out over its duration). */
export function framingEase(f: ShotFraming, t: number): number {
  const k = Math.min(1, Math.max(0, t - (f.delay ?? 0)) / f.duration);
  return 1 - (1 - k) * (1 - k);
}

/** Eye position of a framing `t` seconds in, around `focus` (shared by the shot and the shot picker). */
export function eyeAt(f: ShotFraming, focus: Vector3, ground: number, t: number, out: Vector3, minDist = 0): Vector3 {
  const ease = framingEase(f, t);
  const az = Math.atan2(f.heading.x, f.heading.z) + f.azimuth + f.orbit * t;
  const dist = Math.max(minDist, lerp(f.dist[0], f.dist[1], ease));
  out.set(focus.x + Math.sin(az) * dist, 0, focus.z + Math.cos(az) * dist);
  const climb = (f.heightFollow ?? 0) * Math.max(0, focus.y - ground - 1.3);
  out.y = Math.max(ground + lerp(f.height[0], f.height[1], ease) + climb, ground + 0.35);
  return out;
}

export function createShot(spec: ShotSpec): Shot {
  const focus = new Vector3();
  const look = new Vector3();
  const followY = spec.followY ?? 6;
  const followXZ = spec.followXZ ?? 9;
  let fitDist = 0;
  let t = 0;
  let alive = true;
  let first = true;

  const frame = (cam: PerspectiveCamera, dtReal: number): void => {
    const subject = spec.subject();
    if (subject) {
      if (first) focus.copy(subject);
      else focus.set(damp(focus.x, subject.x, followXZ, dtReal), damp(focus.y, subject.y, followY, dtReal), damp(focus.z, subject.z, followXZ, dtReal));
    }
    t += dtReal;
    const fov = lerp(spec.fov[0], spec.fov[1], framingEase(spec, t));
    const tanHalf = Math.tan((fov * DEG) / 2);
    const bias = spec.bias ?? 0;
    const radius = spec.fit?.() ?? 0;
    const want = radius > 0 ? radius / ((FIT_NDC - Math.abs(bias)) * tanHalf) : 0;
    fitDist = first ? want : damp(fitDist, want, 5, dtReal);
    first = false;
    eyeAt(spec, focus, spec.ground(), t, cam.position, fitDist);
    spec.clear?.(cam.position);
    spec.confine?.(cam.position, focus);
    // Look below the subject by `bias` of the half-height at its distance, so it rides higher in frame.
    look.copy(focus).addScaledVector(UP, (spec.lookUp ?? 0.1) - bias * cam.position.distanceTo(focus) * tanHalf);
    cam.up.copy(UP);
    cam.lookAt(look);
    if (spec.roll) cam.rotateZ(spec.roll);
    cam.fov = fov;
  };

  const override: CameraOverride = (cam, dtReal) => {
    if (!alive) return false;
    if (spec.frozen?.()) return true;
    frame(cam, dtReal);
    cam.updateProjectionMatrix();
    return true;
  };
  return {
    override,
    focus,
    get ready() {
      return !first;
    },
    stop: () => {
      alive = false;
    },
  };
}
