// Air tricks (SPEC §16) and the umbrella glide (SPEC §15).
// A trick starts on a FRESH drift press while airborne: the drift must be pressed after the take-off (a
// drift held from the ground never tricks), the rider must be racing, un-stunned and not gliding, and the
// air must be older than tricks.minAir. The same step's controls pick the trick: |steer| → spin,
// brake → backflip, hop → frontflip, drift alone → superman (it starts after tricks.supermanHold of
// holding and lasts while the drift is held). The trick is visual only: the yaw, the position and the
// landing alignment never see it — the actors rotate the view from rider.trick.
// Landing with a trick below tricks.snap done (or a superman still held) crashes the rider with cause
// 'trick'; a finished trick extends the chain (rider.trickChain) and the landing pays points + a boost.
// The umbrella (SPEC §15) turns the same fresh drift press into a glide instead: less gravity, more air
// steering, no trick, no points.
import { TUNING as T } from './tuning';
import { hasStatus, type SimCtx, type SimRider } from './state';
import type { Controls, RiderState, Side, TrickKind } from '../core/types';

const K = T.tricks;

/** Seconds until touchdown on flat road from the current height and vertical speed (crests only add to it). */
function airLeft(sr: SimRider): number {
  const r = sr.r;
  const g = sr.airKind === 'hop' ? T.hopGravity : T.airGravity;
  return (r.vy + Math.sqrt(Math.max(0, r.vy * r.vy + 2 * g * Math.max(0, r.y)))) / g;
}

/** The rider may start a trick: racing, un-stunned, not gliding and no trick running. */
function canTrick(r: RiderState): boolean {
  return r.mode === 'racing' && r.mods.steerMul > 0 && !hasStatus(r, 'stun') && !r.gliding && !r.trick;
}

/** The trick this step's controls ask for (throttle never picks one). */
function pickKind(c: Controls): TrickKind {
  if (Math.abs(c.steer) > K.steerMin) return 'spin';
  if (c.brake > K.brakeMin) return 'backflip';
  if (c.hop) return 'frontflip';
  return 'superman';
}

/** The direction of a trick: the spin follows the steer, the flips are fixed. */
function dirOf(kind: TrickKind, c: Controls): Side {
  if (kind === 'spin') return c.steer < 0 ? -1 : 1;
  if (kind === 'backflip') return -1;
  return 1;
}

/** A steer, brake or hop during the superman hold disqualifies it. */
function interferes(c: Controls): boolean {
  return Math.abs(c.steer) > K.steerMin || c.brake > K.brakeMin || c.hop;
}

/** One sim step of the air: the trick state machine and the umbrella glide. */
export function updateAirTricks(ctx: SimCtx, sr: SimRider, c: Controls, dt: number): void {
  const r = sr.r;
  if (!r.airborne) {
    r.gliding = false;
    sr.supermanHold = -1;
    return;
  }
  // The glide ends with the drift release, without the umbrella, or when a trick takes over.
  if (r.gliding && (!c.drift || r.weapon !== 'umbrella' || r.trick)) r.gliding = false;

  if (sr.driftPressed) {
    if (r.weapon === 'umbrella' && !r.trick && r.mode === 'racing' && r.mods.steerMul > 0) {
      r.gliding = true; // the umbrella glide is not a trick: no points, no events
    } else if (canTrick(r) && r.airTime >= K.minAir) {
      // Only with enough air left to land it: a late Shift (+ steer) just before touchdown is a drift, not a trick.
      const kind = pickKind(c);
      const left = airLeft(sr) - K.predictMargin;
      if (kind === 'superman') {
        if (left >= K.supermanHold + K.supermanMin) sr.supermanHold = 0; // starts after the hold
      } else if (left >= (kind === 'spin' ? K.spinDur : K.flipDur) * K.snap) {
        startTrick(ctx, sr, kind, dirOf(kind, c));
      }
    }
  }

  if (r.trick && r.trick.kind === 'superman') {
    if (!c.drift) endSuperman(sr);
    else sr.supermanHold += dt;
  } else if (sr.supermanHold >= 0) {
    if (!c.drift || interferes(c)) sr.supermanHold = -1; // released or spoiled before it started
    else {
      sr.supermanHold += dt;
      if (sr.supermanHold >= K.supermanHold) startTrick(ctx, sr, 'superman', 1);
    }
  }

  // Advance the running trick; a finished one extends the chain.
  if (r.trick && r.trick.kind !== 'superman') {
    r.trick.t += dt;
    if (r.trick.t >= r.trick.dur) finishTrick(sr);
  }
}

function startTrick(ctx: SimCtx, sr: SimRider, kind: TrickKind, dir: Side): void {
  const r = sr.r;
  const dur = kind === 'spin' ? K.spinDur : kind === 'superman' ? Infinity : K.flipDur;
  r.trick = { kind, t: 0, dur, dir };
  ctx.bus.emit('rider:trick', { riderId: r.id, phase: 'start', kind, count: r.trickChain + 1, points: 0 });
}

/** The trick is done: the chain grows, the landing will pay for it. */
function finishTrick(sr: SimRider): void {
  const r = sr.r;
  const kind = r.trick?.kind ?? 'spin';
  r.trick = null;
  r.trickChain += 1;
  sr.lastTrick = kind;
}

/** The drift was released: a long enough superman counts, a short one is cancelled silently. */
function endSuperman(sr: SimRider): void {
  const r = sr.r;
  const done = sr.supermanHold >= K.supermanMin;
  r.trick = null;
  sr.supermanHold = -1;
  if (!done) return;
  r.trickChain += 1;
  sr.lastTrick = 'superman';
}

/** Forget every trick (a new air episode, a crash, a respawn). */
export function resetTrick(sr: SimRider): void {
  const r = sr.r;
  r.trick = null;
  r.trickChain = 0;
  r.gliding = false;
  sr.supermanHold = -1;
  sr.lastTrick = null;
}
