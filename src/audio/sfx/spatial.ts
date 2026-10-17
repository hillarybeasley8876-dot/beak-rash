// Positional placement relative to the render camera: inverse-distance gain, equal-power-ish pan
// from the camera's right axis, air absorption (low-pass) for far sources, culling past 140 m.
import type { PerspectiveCamera } from 'three';
import type { Vec3Like } from '../../core/types';

export interface Placement {
  gain: number;
  pan: number;
  lowpass: number;
  dist: number;
}

const REF = 7;        // m: full volume inside this radius (the chase camera sits ~5 m behind the player)
const MAX = 140;      // m: inaudible beyond

export const CENTER: Placement = { gain: 1, pan: 0, lowpass: 20000, dist: 0 };

export function place(cam: PerspectiveCamera, p: Vec3Like): Placement {
  const e = cam.matrixWorld.elements;
  const dx = p.x - (e[12] ?? 0);
  const dy = p.y - (e[13] ?? 0);
  const dz = p.z - (e[14] ?? 0);
  const dist = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(dist) || dist >= MAX) return { gain: 0, pan: 0, lowpass: 20000, dist };
  const right = dx * (e[0] ?? 1) + dy * (e[1] ?? 0) + dz * (e[2] ?? 0);
  const pan = dist > 0.5 ? Math.max(-0.9, Math.min(0.9, (right / dist) * 1.1)) : 0;
  const fade = dist > MAX * 0.7 ? 1 - (dist - MAX * 0.7) / (MAX * 0.3) : 1;
  const gain = (REF / Math.max(REF, dist)) * fade;
  const lowpass = dist < 25 ? 20000 : 14000 - 11500 * Math.min(1, (dist - 25) / 110);
  return { gain, pan, lowpass, dist };
}
