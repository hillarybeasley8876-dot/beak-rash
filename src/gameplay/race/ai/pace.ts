// Rubber band (SPEC §9: gentle ±8 %, never visibly cheating). Every rival's pace is a level reference (a
// roadbike rider, +2 %/level) plus a small per-rider offset, so the player's own bike is a real edge (a
// faster bike does not speed the field up) while rival bike differences are compressed; leaders ease off
// from 40 m ahead; riders far behind (out of the chase camera) get a catch-up nudge (none for 12 s after
// their own respawn, so a KO buys a real gap), and a hunter closing in from behind pedals freely. Riders only
// exceed their own bike top through `rider.rubber` (a top-speed factor the sim multiplies in, no boost visuals):
// out of the chase camera it carries the catch-up; in view it only lifts a slow bike (kidbike, shared) up to the
// field's pace, never above it, so those riders race the pack instead of always finishing last. A fast bike gets a
// rubber below 1 (its cap ÷ its top), so after a boost or a descent the sim's overspeed drag brings it back to the
// cap instead of letting it coast for seconds above the field (runaway fixie leaders).
import { BIKES } from '../../../data/bikes';
import { clamp, smoothstep } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import { topOf } from './control';

const EASE = 0.08;                    // max leader ease-off fraction (SPEC ±8 %)
const EASE_FROM = 40, EASE_FULL = 120;
/** Level-1 reference top speed (m/s): the starter roadbike, independent of what the player rides. */
export const REF_TOP = BIKES.roadbike.topSpeed;
const CATCH_UP = 0.08;                // max catch-up above the pace, unseen riders only (SPEC ±8 %)
const UNSEEN_BEHIND = 20;             // m behind the human: behind the chase camera
const CATCH_FULL = 90;                // m behind where the catch-up is complete
const SPRINT_BEHIND = 8;              // a hunter this far behind the human may sprint (unseen)
const MAX_RUBBER = 0.35;              // max top-speed factor above the rider's own bike (kidbike → pace + 8 %)
const MIN_RUBBER = 0.7;               // floor of the factor that holds a fast bike to its cap (fixie 22.5 → 15.8 m/s)
const RUBBER_RATE = 0.1;              // 1/s: how fast rider.rubber moves (0.08 settles in under a second)
/** A grudge closing the last metres to the player (fight.ts) may ride pace ×1.06, or the player's speed + 1.5 m/s
 * when that is higher (a boosted player), for a few seconds, also in view: an angry rival visibly chasing you. */
const PAYBACK_PACE = 1.06, PAYBACK_CLOSE = 1.5;
const PAYBACK_RATE = 0.4;             // 1/s: rubber rate while closing in for a payback
export const paybackPace = (pace: number, human: RiderState): number => Math.max(pace * PAYBACK_PACE, human.speed + PAYBACK_CLOSE);
/** 复仇之心 (SPEC §18): the nemesis rides 3 % faster while it is behind the player, within 80 m. */
const NEMESIS_BOOST = 1.03, NEMESIS_RANGE = 80;

export interface PaceInput {
  rider: RiderState;
  /** The human this rider is up against (offline: the player; online: its nearest human, SPEC §28). */
  human: RiderState;
  level: number;
  /** Per-rider pace offset (fraction, ± a few %). */
  offset: number;
  huntingPlayer: boolean;
  /** The chase camera is live (no look-back / cinematic), so riders behind the human are unseen. */
  chaseCam: boolean;
  /** Recently respawned (after a KO or crash): no catch-up, so the knock-down costs a real gap. */
  recovering: boolean;
  /** A grudge closing the last metres to the human (Fighter.paybackChase): paybackPace(), also in view. */
  payback: boolean;
  /** 宿敌: this rider is the nemesis of the race (SPEC §18). */
  nemesis: boolean;
}

/** A rival's base pace (m/s): the level reference plus its per-rider offset. */
export const basePace = (level: number, offset: number): number => REF_TOP * (1 + 0.02 * (level - 1) + offset);

/** Target top-speed cap (m/s, before mods/boosts) for an AI rider; Infinity = pedal freely. */
export function paceCap(i: PaceInput): number {
  const { rider: r, human: p } = i;
  const pace = basePace(i.level, i.offset);
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
  // 复仇之心: the nemesis is a little faster while it chases the player from behind.
  if (i.nemesis && d < 0 && -d < NEMESIS_RANGE) cap = Math.max(cap, pace * NEMESIS_BOOST);
  if (i.payback) cap = Math.max(cap, paybackPace(pace, p));
  return cap;
}

/**
 * Ease `rider.rubber` toward cap ÷ own bike top: the whole cap while unseen, at most `inView` (the base pace, or
 * a grudge's payback pace) in view (1 when not racing). Statuses such as chill still slow the rider down: the
 * sim multiplies both in.
 */
export function easeRubber(r: RiderState, cap: number, inView: number, unseen: boolean, dt: number, payback = false): void {
  const goal = unseen ? cap : Math.min(cap, inView);
  const want = r.mode === 'racing' ? clamp(goal / Math.max(1, topOf(r)), MIN_RUBBER, 1 + MAX_RUBBER) : 1;
  const now = r.rubber > 0 ? r.rubber : 1;
  const rate = (payback ? PAYBACK_RATE : RUBBER_RATE) * dt;
  r.rubber = now + clamp(want - now, -rate, rate);
}

/** Is a rider behind the player far enough to be out of the chase camera? */
export const unseenBehind = (r: RiderState, human: RiderState, chaseCam: boolean, hunting: boolean): boolean =>
  chaseCam && human.s - r.s > (hunting ? SPRINT_BEHIND : UNSEEN_BEHIND);
