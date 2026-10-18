// Small timing helpers for cue clips: envelopes and eased keyframe tracks over normalised time u = 0..1.
import { easeInOutCubic, lerp, smoothstep } from '../../core/math';

/** Rise over [a, b], hold, fall over [c, d] (normalised time). */
export function env(t: number, a: number, b: number, c: number, d: number): number {
  return smoothstep(a, b, t) * (1 - smoothstep(c, d, t));
}

/** Piecewise-linear keyframes with eased segments: keys = [[t, value], ...]. */
export function keys(t: number, k: ReadonlyArray<readonly [number, number]>): number {
  const first = k[0];
  if (!first || t <= first[0]) return first ? first[1] : 0;
  for (let i = 1; i < k.length; i++) {
    const a = k[i - 1] as readonly [number, number], b = k[i] as readonly [number, number];
    if (t <= b[0]) return lerp(a[1], b[1], easeInOutCubic((t - a[0]) / (b[0] - a[0])));
  }
  return (k[k.length - 1] as readonly [number, number])[1];
}

type Key = readonly [number, number];

/** Velocity-continuous keyframes (non-uniform Catmull-Rom tangents, zero slope at the first and last key): the
 *  motion carries through interior keys instead of stopping at each one; close keys with near-equal values make a
 *  short hold (anticipation). */
export function spline(t: number, k: ReadonlyArray<Key>): number {
  const n = k.length, first = k[0], last = k[n - 1];
  if (!first || !last) return 0;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  let i = 1;
  while (i < n - 1 && t > (k[i] as Key)[0]) i++;
  const a = k[i - 1] as Key, b = k[i] as Key, h = b[0] - a[0];
  const slope = (j: number): number => {
    const p = k[j - 1], q = k[j + 1];
    return p && q ? (q[1] - p[1]) / (q[0] - p[0]) : 0;
  };
  const m0 = slope(i - 1) * h, m1 = slope(i) * h, s = (t - a[0]) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a[1] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b[1] + (s3 - s2) * m1;
}
