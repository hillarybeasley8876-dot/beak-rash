// Cinematic camera shots for the KO / ult director. Each shot is a CameraOverride that frames a
// moving subject (smoothed), orbits slowly and dollies in; `stop()` hands the camera back. The rig
// then hard-cuts on the release whoosh when the chase view is far away (> 90°), else arcs home.
import { Vector3, type PerspectiveCamera } from 'three';
import { damp, DEG, lerp } from '../../core/math';
import type { CameraOverride } from '../../core/contracts';

export interface ShotSpec {
  /** Subject point (world) — read every frame; null = keep the last known point. */
  subject(): Vector3 | null;
  /** Road height under the subject. */
  ground(): number;
  /** Subject heading (unit, world) used to place the first camera angle. */
  heading: Vector3;
  azimuth: number;      // start angle from the heading (rad, 0 = straight ahead looking back)
  orbit: number;        // rad/s (sign = direction)
  dist: [number, number];
  height: [number, number]; // above the road, start → end
  fov: [number, number];
  duration: number;     // seconds over which dist/height/fov interpolate
  roll?: number;        // dutch angle (rad)
  lookUp?: number;      // look-at offset above the subject
  /** 0..1: how much the camera climbs with a subject that leaves the road (ult leap). */
  heightFollow?: number;
  /** While true the shot holds still (game paused). */
  frozen?(): boolean;
}

export interface Shot {
  readonly override: CameraOverride;
  /** Hand the camera back (from the next frame). */
  stop(): void;
  /** Smoothed subject position (for the post focus). */
  readonly focus: Vector3;
}

/** Rig blend-out to register overrides with (used when the chase view is close enough to arc to). */
export const HANDBACK = 0.32;

const UP = new Vector3(0, 1, 0);

export function createShot(spec: ShotSpec): Shot {
  const focus = new Vector3();
  const offset = new Vector3();
  const look = new Vector3();
  const base = Math.atan2(spec.heading.x, spec.heading.z);
  let t = 0;
  let alive = true;
  let first = true;

  const frame = (cam: PerspectiveCamera, dtReal: number): void => {
    const subject = spec.subject();
    if (subject) {
      if (first) focus.copy(subject);
      else focus.set(damp(focus.x, subject.x, 9, dtReal), damp(focus.y, subject.y, 6, dtReal), damp(focus.z, subject.z, 9, dtReal));
    }
    first = false;
    t += dtReal;
    const k = Math.min(1, t / spec.duration);
    const ease = 1 - (1 - k) * (1 - k);
    const az = base + spec.azimuth + spec.orbit * t;
    const dist = lerp(spec.dist[0], spec.dist[1], ease);
    offset.set(Math.sin(az) * dist, 0, Math.cos(az) * dist);
    cam.position.copy(focus).add(offset);
    const ground = spec.ground();
    const climb = (spec.heightFollow ?? 0) * Math.max(0, focus.y - ground - 1.3);
    cam.position.y = Math.max(ground + lerp(spec.height[0], spec.height[1], ease) + climb, ground + 0.35);
    look.copy(focus).addScaledVector(UP, spec.lookUp ?? 0.1);
    cam.up.copy(UP);
    cam.lookAt(look);
    if (spec.roll) cam.rotateZ(spec.roll);
    cam.fov = lerp(spec.fov[0], spec.fov[1], ease);
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
    stop: () => {
      alive = false;
    },
  };
}

export type ShotFraming = Omit<ShotSpec, 'subject' | 'ground'>;

/**
 * Framing per cinematic: KO = low front three-quarter, orbiting out toward the side; wrecked = from
 * the side with a dutch tilt; ult = wide low shot of the impact. Put the camera on the side away
 * from the attacker so it is seen behind the victim, never in front of the lens. Orbits drift out
 * toward the side, so an arc back to the chase view never passes through the riders.
 */
export function shotFor(kind: 'ko' | 'wrecked' | 'ult', heading: Vector3, cameraLeft: boolean, duration: number): ShotFraming {
  // Heading −Z with +X right: azimuth > 0 puts the camera on the subject's left.
  const side = cameraLeft ? 1 : -1;
  if (kind === 'wrecked') {
    return { heading, azimuth: side * 92 * DEG, orbit: -side * 14 * DEG, dist: [3.5, 3.0], height: [1.15, 1.35], fov: [56, 50], duration, roll: 7 * DEG };
  }
  if (kind === 'ult') {
    return { heading, azimuth: 35 * DEG, orbit: 16 * DEG, dist: [7.0, 6.0], height: [1.6, 2.3], fov: [60, 54], duration, lookUp: 0.6 };
  }
  return { heading, azimuth: side * 30 * DEG, orbit: side * 22 * DEG, dist: [3.3, 2.6], height: [0.75, 1.0], fov: [52, 46], duration, lookUp: 0.05 };
}
