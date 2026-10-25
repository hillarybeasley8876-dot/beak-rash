// Racing line for the worn rubber band on the asphalt (road/detail.ts): the taut-string path through the
// corridor |x| ≤ halfWidth − EDGE — straight between apexes, hugging the inside of every corner, out wide
// before and after. Solved on a coarse grid by projected SOR (x'' = −curvature where the path is free),
// then sampled per 1 m road row and smoothed so the apexes round off.
import type { BuiltLayout } from '../layout/build';

/** Distance kept from the asphalt edge (m) and the coarse grid step (m). */
const EDGE = 1.5;
const STEP = 6;
const ITER = 4000;
const OMEGA = 1.9;
/** Box-filter half width (m), applied twice (≈ Gaussian). */
const SMOOTH = 10;

/** Lateral x of the racing line at every layout sample (index i ↔ s = sMin + i). */
export function racingLine(L: BuiltLayout): Float32Array {
  const n = L.n, lim = L.halfWidth - EDGE;
  const m = Math.floor((n - 1) / STEP) + 1;
  // Mean curvature over each coarse cell.
  const k = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    let sum = 0, cnt = 0;
    for (let i = Math.max(0, j * STEP - STEP / 2); i < Math.min(n, j * STEP + STEP / 2); i++, cnt++) sum += L.curv[i] ?? 0;
    k[j] = cnt ? sum / cnt : 0;
  }
  const x = new Float64Array(m);
  const h2 = STEP * STEP;
  for (let it = 0; it < ITER; it++) {
    let moved = 0;
    for (let j = 1; j < m - 1; j++) {
      const free = ((x[j - 1] ?? 0) + (x[j + 1] ?? 0) + (k[j] ?? 0) * h2) / 2;
      const v = Math.min(lim, Math.max(-lim, (x[j] ?? 0) + OMEGA * (free - (x[j] ?? 0))));
      moved = Math.max(moved, Math.abs(v - (x[j] ?? 0)));
      x[j] = v;
    }
    x[0] = x[1] ?? 0;
    x[m - 1] = x[m - 2] ?? 0;
    if (moved < 1e-4) break;
  }
  let out: Float32Array = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / STEP, j = Math.min(m - 2, Math.floor(f)), t = f - j;
    out[i] = (x[j] ?? 0) * (1 - t) + (x[j + 1] ?? 0) * t;
  }
  for (let pass = 0; pass < 2; pass++) out = boxFilter(out, SMOOTH);
  return out;
}

/** Moving average over ±r samples (ends clamped). */
function boxFilter(a: Float32Array, r: number): Float32Array {
  const n = a.length, out = new Float32Array(n);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += a[Math.min(n - 1, Math.max(0, i))] ?? 0;
  for (let i = 0; i < n; i++) {
    out[i] = sum / (2 * r + 1);
    sum += (a[Math.min(n - 1, i + r + 1)] ?? 0) - (a[Math.max(0, i - r)] ?? 0);
  }
  return out;
}
