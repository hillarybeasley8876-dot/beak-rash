// Rubber band (SPEC §9: gentle ±8 %, never visibly cheating). Every rival's pace is a level reference (a
// roadbike rider, +2 %/level) plus a small per-rider offset, so the player's own bike is a real edge (a
// faster bike does not speed the field up) while rival bike differences are compressed; leaders ease off
// from 40 m ahead; riders far behind (out of the chase camera) get a catch-up nudge (none for 12 s after
// their own respawn, so a KO buys a real gap), and a hunter closing in from behind pedals freely. Riders never
// exceed their own bike top except through those unseen boost pulses (`rider.rubber` is not wired in sim).
import { BIKES } from '../../../data/bikes';
import { clamp, smoothstep } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import { topOf } from './control';

const EASE = 0.08;                    // max leader ease-off fraction (SPEC ±8 %)
const EASE_FROM = 40, EASE_FULL = 120;
/** Level-1 reference top speed (m/s): the starter roadbike, independent of what the player rides. */
export const REF_TOP = BIKES.roadbike.topSpeed;
const CATCH_UP = 0.08;                // max catch-up above the pace, unseen riders only (SPEC ±8 %)
const UNSEEN_BEHIND = 20;             // m behind the player: behind the chase camera
const CATCH_FULL = 90;                // m behind where the catch-up is complete
const SPRINT_BEHIND = 8;              // a hunter this far behind the player may sprint (unseen)
const PULSE = 0.15;                   // s of each nudge pulse
const MAX_PULSE = 0.35;

export interface PaceInput {
  rider: RiderState;
  player: RiderState;
  level: number;
  /** Per-rider pace offset (fraction, ± a few %). */
  offset: number;
  huntingPlayer: boolean;
  /** The chase camera is live (no look-back / cinematic), so riders behind the player are unseen. */
  chaseCam: boolean;
  /** Recently respawned (after a KO or crash): no catch-up, so the knock-down costs a real gap. */
  recovering: boolean;
}

/** Target top-speed cap (m/s, before mods/boosts) for an AI rider; Infinity = pedal freely. */
export function paceCap(i: PaceInput): number {
  const { rider: r, player: p } = i;
  const pace = REF_TOP * (1 + 0.02 * (i.level - 1) + i.offset);
  const d = r.s - p.s;
  if (d > 0) {
    const levelEase = Math.max(0.4, 1 - 0.15 * (i.level - 1));
    return pace * (1 - EASE * levelEase * smoothstep(EASE_FROM, EASE_FULL, d));
  }
  let cap = pace;
  if (i.recovering) return cap;
  if (i.chaseCam && -d > UNSEEN_BEHIND) cap = pace * (1 + CATCH_UP * smoothstep(UNSEEN_BEHIND, CATCH_FULL, -d));
  // A rider hunting the player from behind stops easing off (its own bike + draft decide); pulses stay unseen.
  if (i.huntingPlayer) cap = Math.max(cap, pace * (1.04 + 0.01 * (i.level - 1)));
  return cap;
}

/** Apply an unseen nudge pulse when the cap is above what the rider's own bike can reach. */
export function nudge(r: RiderState, cap: number, unseen: boolean): void {
  if (!unseen || r.mode !== 'racing' || r.boostTime > 0) return;
  // Relative to the bike's own top (statuses such as chill still slow the rider down).
  const need = cap / Math.max(1, topOf(r)) - 1;
  if (need <= 0.005) return;
  r.boostTime = PULSE;
  r.boostPower = clamp(need, 0, MAX_PULSE);
}

/** Is a rider behind the player far enough to be out of the chase camera? */
export const unseenBehind = (r: RiderState, p: RiderState, chaseCam: boolean, hunting: boolean): boolean =>
  chaseCam && p.s - r.s > (hunting ? SPRINT_BEHIND : UNSEEN_BEHIND);
