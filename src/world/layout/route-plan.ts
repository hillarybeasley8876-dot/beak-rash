// The route's plan view: a centre-line integrator with the same maths as layout/build.ts (so a
// route can be checked before it is built) and the self-distance rule the routes must obey — two
// parts of the road more than 150 m apart along it stay 40 m apart in plan, unless one passes at
// least 8 m above the other (a bridge over a lower leg).
import { ramped } from './build';
import type { SegmentDef } from './types';

export interface Plan {
  /** Distance along the road (m). */
  s: Float64Array;
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  /** Where the run of road ends (the state the next one continues from). */
  end: PlanState;
}

/** Where the integrator starts: the heading, the position and the distance along the road. */
export interface PlanState {
  h: number;
  x: number;
  y: number;
  z: number;
  s: number;
}

/** Sampling step of the plan (m). */
export const PLAN_STEP = 4;
/** Two parts of the road closer than this along it are neighbours, not a crossing. */
export const SELF_GAP = 150;
/** The closest the road may come to itself in plan (m). */
export const SELF_MIN = 40;
/** A part of the road this much higher than another may pass over it (m). */
export const SELF_RISE = 8;

/**
 * The centre line of a segment list, integrated with the same midpoint rule as the layout build
 * (curvature and slope ramp across the segment boundaries). The list starts at `state`, so a run
 * of road can be continued from where the last one ended.
 */
export function planOf(segs: SegmentDef[], state: PlanState, step = PLAN_STEP): Plan {
  const starts: number[] = [];
  let acc = 0;
  for (const g of segs) { starts.push(acc); acc += g.len; }
  const total = acc;
  const kappa = ramped(segs, starts, (g) => (g.radius ? 1 / g.radius : 0), (g) => g.ease ?? 30);
  const grade = ramped(segs, starts, (g) => (g.rise ?? 0) / g.len, (g) => g.vEase ?? g.ease ?? 30);
  const n = Math.max(1, Math.floor(total / step) + 1);
  const s = new Float64Array(n), x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n);
  const SUB = 4, ds = step / SUB;
  let h = state.h, px = state.x, py = state.y, pz = state.z, seg = 0;
  const segAt = (ss: number): number => {
    while (seg < segs.length - 1 && ss >= (starts[seg + 1] ?? Infinity)) seg++;
    return seg;
  };
  for (let i = 0; i < n; i++) {
    const ss = i * step;
    s[i] = state.s + ss; x[i] = px; y[i] = py; z[i] = pz;
    for (let j = 0; j < SUB; j++) {
      const sm = ss + (j + 0.5) * ds;
      const km = kappa(sm, segAt(sm));
      const hm = h + km * ds * 0.5;
      px += Math.sin(hm) * ds;
      pz -= Math.cos(hm) * ds;
      py += grade(sm, segAt(sm)) * ds;
      h += km * ds;
    }
  }
  return {
    s, x, y, z,
    end: { h, x: px, y: py, z: pz, s: state.s + total },
  };
}

export interface SelfHit {
  /** The closest approach in plan (m); Infinity when the road never comes near itself. */
  dist: number;
  /** The two distances along the road (m). */
  at: [number, number];
}

/**
 * How close the road comes to itself: the closest pair of points more than `gap` metres apart along
 * it, ignoring a pair where one passes at least `rise` metres above the other. `stride` skips
 * samples (every second 4 m sample is the measure the tracks are held to).
 */
export function selfDistance(plan: Plan, gap = SELF_GAP, rise = SELF_RISE, stride = 1): SelfHit {
  const n = plan.s.length;
  let best = Infinity, at: [number, number] = [0, 0];
  for (let i = 0; i < n; i += stride) {
    const si = plan.s[i] ?? 0, xi = plan.x[i] ?? 0, yi = plan.y[i] ?? 0, zi = plan.z[i] ?? 0;
    for (let j = i + 1; j < n; j += stride) {
      const sj = plan.s[j] ?? 0;
      if (sj - si <= gap) continue;
      if (Math.abs((plan.y[j] ?? 0) - yi) >= rise) continue;
      const d = Math.hypot((plan.x[j] ?? 0) - xi, (plan.z[j] ?? 0) - zi);
      if (d < best) { best = d; at = [si, sj]; }
    }
  }
  return { dist: best, at };
}

/**
 * The part of a plan that lies after `s` (the road already laid is skipped, so only the new stretch
 * is weighed against the old one).
 */
export function planAfter(p: Plan, s: number): Plan {
  let i = 0;
  while (i < p.s.length && (p.s[i] ?? 0) <= s) i++;
  return { s: p.s.slice(i), x: p.x.slice(i), y: p.y.slice(i), z: p.z.slice(i), end: p.end };
}

/**
 * The closest approach between a new stretch of road and the road already laid: the same rule as
 * selfDistance, but only the old part is compared (the new part is its continuation).
 */
export function approachTo(old: Plan, add: Plan, gap = SELF_GAP, rise = SELF_RISE): number {
  let best = Infinity;
  for (let i = 0; i < old.s.length; i++) {
    const xi = old.x[i] ?? 0, yi = old.y[i] ?? 0, zi = old.z[i] ?? 0;
    for (let j = 0; j < add.s.length; j++) {
      if ((add.s[j] ?? 0) - (old.s[i] ?? 0) <= gap) continue;
      if (Math.abs((add.y[j] ?? 0) - yi) >= rise) continue;
      const d = Math.hypot((add.x[j] ?? 0) - xi, (add.z[j] ?? 0) - zi);
      if (d < best) best = d;
    }
  }
  return best;
}
