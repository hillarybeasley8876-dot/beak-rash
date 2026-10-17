// Racing line: a minimum-curvature path across the asphalt (outside → apex → outside), relaxed once
// per race from the track's centre line. Also curvature look-ups for braking/drift decisions.
import { clamp } from '../../../core/math';
import type { Track } from '../../../core/contracts';
import type { TrackFrame } from '../../../core/types';

const STEP = 4;          // m between samples
const EDGE = 1.3;        // m kept from the asphalt edge
const ITERATIONS = 500;

export interface RacingLine {
  /** Ideal lateral offset at s. */
  x(s: number): number;
  /** Signed centre-line curvature at s (1/m, + = right). */
  curv(s: number): number;
  /** Curvature with the largest magnitude in [s0, s1] (signed). */
  peakCurv(s0: number, s1: number): number;
  /** Asphalt half-width at s. */
  halfWidth(s: number): number;
}

export function buildRacingLine(track: Track): RacingLine {
  const n = Math.max(2, Math.ceil(track.length / STEP) + 1);
  const cx = new Float64Array(n), cz = new Float64Array(n);
  const rx = new Float64Array(n), rz = new Float64Array(n);
  const kappa = new Float32Array(n), half = new Float32Array(n), lim = new Float32Array(n);
  const xs = new Float64Array(n);
  const fr = {} as TrackFrame;
  for (let i = 0; i < n; i++) {
    const s = Math.min(i * STEP, track.length);
    track.frameAt(s, fr);
    cx[i] = fr.pos.x; cz[i] = fr.pos.z;
    const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
    rx[i] = fr.right.x / rl; rz[i] = fr.right.z / rl;
    kappa[i] = fr.curvature;
    half[i] = fr.halfWidth;
    lim[i] = Math.max(0, fr.halfWidth - EDGE);
  }
  for (let it = 0; it < ITERATIONS; it++) {
    for (let i = 1; i < n - 1; i++) {
      const px = cx[i] + xs[i] * rx[i], pz = cz[i] + xs[i] * rz[i];
      const ax = cx[i - 1] + xs[i - 1] * rx[i - 1], az = cz[i - 1] + xs[i - 1] * rz[i - 1];
      const bx = cx[i + 1] + xs[i + 1] * rx[i + 1], bz = cz[i + 1] + xs[i + 1] * rz[i + 1];
      const mx = (ax + bx) / 2 - px, mz = (az + bz) / 2 - pz;
      const l = lim[i];
      xs[i] = clamp(xs[i] + 0.6 * (mx * rx[i] + mz * rz[i]), -l, l);
    }
  }
  const sample = (arr: ArrayLike<number>, s: number): number => {
    const f = clamp(s, 0, track.length) / STEP;
    const i = Math.min(Math.floor(f), n - 2);
    const t = f - i;
    return arr[i] * (1 - t) + arr[i + 1] * t;
  };
  return {
    x: (s) => sample(xs, s),
    curv: (s) => sample(kappa, s),
    halfWidth: (s) => sample(half, s),
    peakCurv(s0, s1) {
      let best = 0;
      const i0 = Math.max(0, Math.floor(clamp(s0, 0, track.length) / STEP));
      const i1 = Math.min(n - 1, Math.ceil(clamp(s1, 0, track.length) / STEP));
      for (let i = i0; i <= i1; i++) if (Math.abs(kappa[i]) > Math.abs(best)) best = kappa[i];
      return best;
    },
  };
}
