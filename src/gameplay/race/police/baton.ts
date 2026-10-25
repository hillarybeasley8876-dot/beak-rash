// The officer's baton (SPEC §14). At ★2+ the corgi holds the baton and, when it is close
// enough behind the player, winds up (a readable tell: the actors view plays the heavy swing
// pose and the HUD shows the red "!"), then swings: `police:windup` at the start, `police:swing`
// at the end, and an `npc:strike` if the player is still inside the box.
import type { RiderState, Side } from '../../../core/types';
import { T } from './tuning';

export interface Baton {
  /** s left of the wind-up (0 = the officer is not winding up). */
  windup: number;
  /** The wind-up that was started (s): the pose and the event carry it. */
  total: number;
  /** The side of the player the officer swings from. */
  side: Side;
  /** s until the officer may wind up again. */
  cooldown: number;
  /** s since the swing landed (the follow-through of the pose). */
  strikeT: number;
}

export function createBaton(): Baton {
  return { windup: 0, total: 0, side: 1, cooldown: 0, strikeT: 99 };
}

export function resetBaton(b: Baton): void {
  b.windup = 0;
  b.total = 0;
  b.cooldown = 0;
  b.strikeT = 99;
}

/** The wind-up time at the current wanted level. */
export function windupTime(level: number): number {
  return level >= 3 ? T.windupW3 : T.windup;
}

/** The cooldown between two wind-ups at the current wanted level. */
export function cooldownTime(level: number): number {
  return level >= 3 ? T.cooldownW3 : T.cooldown;
}

/** Start the wind-up: the rider action is what the actors view plays (a heavy swing). */
export function startWindup(st: RiderState, b: Baton, side: Side, time: number): void {
  b.windup = time;
  b.total = time;
  b.side = side;
  b.strikeT = 99;
  st.action = { kind: 'heavy', side, t: 0, dur: time + 0.25, weapon: 'baton', skillId: null, resolved: true };
}

/** Advance the baton: the wind-up timer, the swing pose and the cooldown. */
export function stepBaton(st: RiderState, b: Baton, dt: number): void {
  if (b.cooldown > 0) b.cooldown = Math.max(0, b.cooldown - dt);
  if (b.windup > 0) b.windup = Math.max(0, b.windup - dt);
  if (b.strikeT < 99) b.strikeT = Math.min(99, b.strikeT + dt);
  const act = st.action;
  if (act && act.kind === 'heavy') {
    act.t += dt;
    if (act.t >= act.dur) st.action = null;
  }
}
