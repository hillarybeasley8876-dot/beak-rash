// SHOWTIME target assist: where the dive lands. The leap keeps its natural landing spot when that already
// catches the most rivals; otherwise it homes forward onto the rival whose spot catches more (landing just
// behind it), so a leader's SHOWTIME still finds the pack ahead. It never homes backwards: the caster's track
// position keeps advancing at least at its pre-cast speed, so a cast can't cost places (a pack behind is only
// caught by the shockwave's reach behind the impact). No rival to catch → no plan: the cast is denied, SP kept.
// The planner reuses scratch storage (it also runs every step for RiderState.ultTarget).
import type { RiderState } from '../../../core/types';
import { targetable, type CombatCtx } from '../ctx';
import { clearLane } from './common';

export const AIM = {
  ahead: 120, behind: 30, // m: rivals the planner considers (track distance from the caster when it casts)
  landBehind: 2.5,        // m short of the anchor rival the dive lands
} as const;

/** The ult numbers the planner needs (passed in by ult.ts). */
export interface UltReach {
  ahead: number;   // shockwave reach ahead of the impact (m)
  behind: number;  // … and behind it
  lineGap: number; // the impact must stay this far short of the finish line
  flight: number;  // s from the cast to the impact
  extra: number;   // m the dive adds to the natural landing spot
  speed(r: RiderState): number; // the caster's track speed during the leap (≥ its speed when it casts)
}

/** anchor = the rival the leap homes onto (null = natural landing); victims = rivals the impact should catch. */
export interface UltPlan { anchor: RiderState | null; victims: number }

/** Where a rider will be `left` s from now at its current speed. */
const spotIn = (v: RiderState, left: number): number => v.s + v.speed * left;

/** Scratch for planUlt: rivals in the window, their spots at the impact, the returned plan (copy what you keep). */
const pool: RiderState[] = [];
const spots: number[] = [];
const plan: UltPlan = { anchor: null, victims: 0 };

/** Rivals whose spot at the impact lies within the shockwave around `p` (riders over the line have finished). */
function caught(p: number, len: number, reach: UltReach): number {
  let n = 0;
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i] ?? Infinity;
    if (s < len && s - p <= reach.ahead && s - p >= -reach.behind) n++;
  }
  return n;
}

/**
 * Best impact spot for a SHOWTIME cast now, or null if the shockwave would catch nobody short of the finish line.
 * The returned object is shared scratch: read it before the next call.
 */
export function planUlt(ctx: CombatCtx, r: RiderState, reach: UltReach): UltPlan | null {
  const len = ctx.session.track.length, limit = len - reach.lineGap;
  const natural = r.s + reach.speed(r) * reach.flight + reach.extra;
  if (natural >= limit) return null; // every landing is at or past the natural one: too close to the line
  pool.length = spots.length = 0;
  for (const v of ctx.session.riders) {
    const ds = v.s - r.s;
    if (v === r || ds > AIM.ahead || ds < -AIM.behind || !targetable(ctx, v)) continue;
    pool.push(v);
    spots.push(spotIn(v, reach.flight));
  }
  let best = -1, bestN = caught(natural, len, reach), bestP = natural; // -1 = the natural landing (wins ties)
  for (let i = 0; i < pool.length; i++) {
    const p = (spots[i] ?? 0) - AIM.landBehind;
    if (p <= natural || p >= limit) continue; // only forward of the natural landing, short of the line
    const n = caught(p, len, reach);
    if (n < bestN || (n === bestN && (best < 0 || p >= bestP))) continue;
    best = i;
    bestN = n;
    bestP = p;
  }
  if (bestN === 0) return null;
  plan.anchor = best >= 0 ? pool[best] ?? null : null;
  plan.victims = bestN;
  return plan;
}

/** Share of the leap's travel done at u ∈ [0, 1]: quick off the ground (in the slow-mo), settling into the dive. */
const travelled = (u: number): number => (u >= 1 ? 1 : u <= 0 ? 0 : u * (2 - u));

/**
 * One homing step, after physics: moves the caster by this step's share of the gap between where it would land
 * and the anchor's landing spot, so it lands exactly there at t = flight (closed loop: follows the anchor's speed).
 * Only ever forward: an anchor that falls back behind the caster's own landing is let go.
 */
export function homeStep(ctx: CombatCtx, r: RiderState, anchor: RiderState, t: number, dt: number, flight: number): void {
  if (anchor.mode !== 'racing' || dt <= 0) return; // the anchor went down: the leap flies on to its natural spot
  const left = Math.max(0, flight - t);
  const aimS = spotIn(anchor, left) - AIM.landBehind;
  const gap = aimS - spotIn(r, left);
  if (gap <= 0) return;
  const done = travelled((t - dt) / flight);
  const w = done >= 1 ? 1 : (travelled(t / flight) - done) / (1 - done);
  r.s += gap * w;
  r.x += (clearLane(ctx, r, aimS, anchor.x, anchor) - r.x) * w;
}
