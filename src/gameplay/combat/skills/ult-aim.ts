// SHOWTIME target assist: where the dive lands. The leap keeps its natural landing spot when that already
// catches the most rivals; otherwise it homes onto the rival whose spot catches more (landing just behind it),
// so a leader's SHOWTIME still finds the pack. No rival in the window → no plan: the cast is denied, SP kept.
import type { RiderState } from '../../../core/types';
import { targetable, type CombatCtx } from '../ctx';
import { clearLane } from './common';

export const AIM = {
  ahead: 120, behind: 30, // m: rivals the leap may travel to (track distance from the caster when it casts)
  landBehind: 2.5,        // m short of the anchor rival the dive lands
} as const;

/** The ult numbers the planner needs (passed in by ult.ts). */
export interface UltReach {
  ahead: number;   // shockwave reach ahead of the impact (m)
  behind: number;  // … and behind it
  lineGap: number; // the impact must stay this far short of the finish line
  flight: number;  // s from the cast to the impact
  extra: number;   // m the dive adds to the natural landing spot
}

/** anchor = the rival the leap homes onto (null = natural landing); victims = rivals the impact should catch. */
export interface UltPlan { anchor: RiderState | null; victims: number }

/** Where a rider will be `left` s from now at its current speed. */
const spotIn = (v: RiderState, left: number): number => v.s + v.speed * left;

/** Best impact spot for a SHOWTIME cast now, or null if no rival is in the window (or only past the line). */
export function planUlt(ctx: CombatCtx, r: RiderState, reach: UltReach): UltPlan | null {
  const len = ctx.session.track.length, limit = len - reach.lineGap;
  const rivals = ctx.session.riders.filter((v) => v !== r && targetable(ctx, v) && v.s - r.s <= AIM.ahead && v.s - r.s >= -AIM.behind);
  const spots = rivals.map((v) => spotIn(v, reach.flight));
  // rivals over the line by then have finished: nothing to catch there
  const caught = (p: number): number => spots.filter((s) => s < len && s - p <= reach.ahead && s - p >= -reach.behind).length;
  const natural = spotIn(r, reach.flight) + reach.extra;
  let best: UltPlan | null = natural < limit && caught(natural) > 0 ? { anchor: null, victims: caught(natural) } : null;
  let bestTravel = 0;
  for (let i = 0; i < rivals.length; i++) {
    const p = (spots[i] ?? 0) - AIM.landBehind;
    if (p >= limit) continue;
    const n = caught(p), travel = Math.abs(p - natural);
    if (best && (n < best.victims || (n === best.victims && travel >= bestTravel))) continue;
    best = { anchor: rivals[i] ?? null, victims: n };
    bestTravel = travel;
  }
  return best;
}

/** Share of the leap's travel done at u ∈ [0, 1]: quick off the ground (in the slow-mo), settling into the dive. */
const travelled = (u: number): number => (u >= 1 ? 1 : u <= 0 ? 0 : u * (2 - u));

/**
 * One homing step, after physics: moves the caster by this step's share of the gap between where it would land
 * and the anchor's landing spot, so it lands exactly there at t = flight (closed loop: follows the anchor's speed).
 */
export function homeStep(ctx: CombatCtx, r: RiderState, anchor: RiderState, t: number, dt: number, flight: number): void {
  if (anchor.mode !== 'racing' || dt <= 0) return; // the anchor went down: the leap flies on to its natural spot
  const left = Math.max(0, flight - t);
  const done = travelled((t - dt) / flight);
  const w = done >= 1 ? 1 : (travelled(t / flight) - done) / (1 - done);
  const aimS = spotIn(anchor, left) - AIM.landBehind;
  r.s += (aimS - spotIn(r, left)) * w;
  r.x += (clearLane(ctx, r, aimS, anchor.x, anchor) - r.x) * w;
}
