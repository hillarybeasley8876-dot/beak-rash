// The corgi officer's riding (track space): sprint in from behind (always faster than the player, boosts
// included) and hold station alongside for a few seconds, then cruise just under the player's own top
// speed, so a player at full pedal slowly pulls away (police.ts sends it on one more sprint before it gives
// up). Short legs tire after chasing close for a while (腿短), traffic and other riders block it (brakes
// behind them, changes lanes slowly), and a swing or a Wing Dash from the player knocks it back.
import { approach, clamp, damp } from '../../core/math';
import type { Track } from '../../core/contracts';
import type { Obstacle, RiderState } from '../../core/types';

const SPRINT_MUL = 1.28, SPRINT_MAX = 15;   // × player top, while arriving (at most SPRINT_MAX s)…
const SPRINT_CLOSE = 4;                      // …and never less than the player's current speed + this
const ALONG_HOLD = 4;                        // …and for this long alongside
const RESPRINT_MAX = 8, RESPRINT_HOLD = 3;   // one more sprint (s at most) and hold (s alongside) when trailing
const CRUISE = 0.97;                         // × the player's flat-road top speed
const TIRE_AFTER = 15, TIRED_TIME = 6, TIRED_MUL = 0.85;
// r6 (SPEC §25): a hit only nudges the officer — it stays in reach of the next swing instead of being
// thrown three seconds down the road.
const KNOCK_TIME = 0.8, KNOCK_MUL = 0.85;   // s of the nudge, and the speed it keeps while nudged
const KNOCK_SHOVE = 1.2;                    // m/s sideways while it is shoved (≈0.5 m aside)
const KNOCK_HOLD = 0.4;                     // s the shove lasts (then it steers back alongside)
// At ★2+ the officer fights the player instead of chasing it: it matches the player's speed and holds
// station beside it, so the player can hit it (r6 SPEC §25).
const TAIL_TOP = 1.25;                      // × the player's flat top: the headroom it needs to close in again
export const WALK_BACK = 2.5;                // m/s pushing the bike back to a stopped player
const LOOK = 22;                             // m ahead the corgi watches for traffic

export interface Corgi {
  readonly st: RiderState;
  chaseT: number;     // s since the chase started
  sprintT: number;    // s of sprint left (arrival, or the one re-sprint)
  alongT: number;     // s alongside the player this chase (sprint over after ALONG_HOLD)
  closeT: number;     // s chased within CLOSE m since the last rest
  tiredT: number;     // s left out of breath
  knockT: number;     // s left knocked back
  tail: boolean;      // it fights the player (★2+): it matches the player's speed instead of cruising
}

const CLOSE = 12;                            // m: chasing this close wears the short legs out

export const createCorgi = (st: RiderState): Corgi =>
  ({ st, chaseT: 0, sprintT: SPRINT_MAX, alongT: 0, closeT: 0, tiredT: 0, knockT: 0, tail: false });

export function resetCorgi(c: Corgi): void {
  c.chaseT = c.alongT = c.closeT = c.tiredT = c.knockT = 0;
  c.sprintT = SPRINT_MAX;
  c.tail = false;
}

/** Trailing the player: one more sprint back into whistle range, then a shorter hold alongside. */
export function resprint(c: Corgi): void {
  c.sprintT = RESPRINT_MAX;
  c.alongT = ALONG_HOLD - RESPRINT_HOLD;
}

/** Still sprinting in (arrival or re-sprint), not yet holding station alongside. */
export const sprinting = (c: Corgi): boolean => c.alongT < ALONG_HOLD && c.sprintT > 0;

/** Advance stamina (`gap` = player.s − corgi.s); returns true on the step the corgi runs out of breath. */
export function tire(c: Corgi, dt: number, gap: number): boolean {
  c.chaseT += dt;
  if (sprinting(c)) c.sprintT -= dt;
  if (Math.abs(gap) < 4) c.alongT += dt;
  c.knockT = Math.max(0, c.knockT - dt);
  if (c.tiredT > 0) {
    c.tiredT = Math.max(0, c.tiredT - dt);
    return false;
  }
  if (Math.abs(gap) < CLOSE) c.closeT += dt;
  if (c.closeT < TIRE_AFTER) return false;
  c.closeT = 0;
  c.tiredT = TIRED_TIME;
  return true;
}

/** Knocked aside by the player: a small shove and a short slowdown — it rides straight back alongside. */
export function knock(c: Corgi, awayX: number): void {
  c.knockT = KNOCK_TIME;
  c.st.speed *= KNOCK_MUL;
  c.st.vx = clamp(awayX * KNOCK_SHOVE, -KNOCK_SHOVE, KNOCK_SHOVE);
}

export const tired = (c: Corgi): boolean => c.tiredT > 0;

function topSpeed(c: Corgi, w: RideWorld): number {
  const base = sprinting(c)
    ? Math.max(w.playerTop * SPRINT_MUL, w.playerSpeed + SPRINT_CLOSE)
    : c.tail ? w.playerTop * TAIL_TOP : w.playerTop * CRUISE;
  return base * (c.tiredT > 0 ? TIRED_MUL : 1) * (c.knockT > 0 ? KNOCK_MUL : 1);
}

/** Something the corgi rides around: a solid obstacle (traffic) or another rider. */
interface Box { s: number; x: number; speed: number; halfWidth: number; halfLength: number }
const RIDER_HW = 0.45, RIDER_HL = 0.9;

/** Gap ahead (m) of a box within LOOK m and across the corgi's path between lo..hi, else Infinity. */
function inPath(b: Box, st: RiderState, lo: number, hi: number): number {
  const ds = b.s - st.s;
  if (ds < -b.halfLength || ds > LOOK + b.halfLength) return Infinity;
  const m = b.halfWidth + 0.9;
  return b.x + m < lo || b.x - m > hi ? Infinity : ds;
}

/** Nearest solid obstacle or rival within LOOK m ahead in the corgi's lane or across its path to `tx`. */
function blocker(w: RideWorld, st: RiderState, tx: number): Box | null {
  const lo = Math.min(st.x, tx), hi = Math.max(st.x, tx);
  let best: Box | null = null, bestDs = Infinity;
  for (const o of w.obstacles) {
    if (!o.active || !o.solid) continue;
    const ds = inPath(o, st, lo, hi);
    if (ds < bestDs) { best = o; bestDs = ds; }
  }
  for (const r of w.riders) {
    if (r.isPlayer || (r.mode !== 'racing' && r.mode !== 'finished') || r.mods.intangible) continue;
    const box = { s: r.s, x: r.x, speed: r.speed, halfWidth: RIDER_HW, halfLength: RIDER_HL };
    const ds = inPath(box, st, lo, hi);
    if (ds < bestDs) { best = box; bestDs = ds; }
  }
  return best;
}

/** Pass on the side the corgi is already on when there is room, else on the roomier side. */
function passSide(b: Box, x: number, hw: number): 1 | -1 {
  const room = (side: number): number => hw - side * b.x - b.halfWidth;
  const mine = x >= b.x ? 1 : -1;
  if (room(mine) > 1.6) return mine;
  return room(1) >= room(-1) ? 1 : -1;
}

export interface RideWorld {
  track: Track;
  obstacles: readonly Obstacle[];
  /** Everyone in the race (the corgi rides around rivals; the player is its target, not a blocker). */
  riders: readonly RiderState[];
  playerTop: number;
  /** The player's current speed (boosts included): the arrival sprint always closes in. */
  playerSpeed: number;
}

/** Ride toward `wantSpeed` and lateral target `tx`; brakes behind traffic or a rival and squeezes past.
 *  `commit` > 0 = a committed burst (the baton wind-up): the officer keeps that speed whatever the
 *  player does and holds its line, so braking out of its reach works. */
export function ride(c: Corgi, w: RideWorld, dt: number, wantSpeed: number, tx: number, accel: number, commit = 0): void {
  const st = c.st;
  const hold = commit > 0;
  let want = hold ? commit : clamp(wantSpeed, -WALK_BACK, topSpeed(c, w));
  let lat = 4;
  if (hold) { tx = st.x; lat = 1.4; }
  const hw = w.track.bounds(st.s).halfWidth;
  const b = blocker(w, st, tx);
  if (b) {
    // Steer around it (slowly around traffic); brake only while still in its lane (beside it the corgi rides on).
    tx = b.x + passSide(b, st.x, hw) * (b.halfWidth + 1.3);
    lat = b.speed < 0 ? 3.5 : b.halfWidth === RIDER_HW ? 2.5 : 1.6;   // oncoming traffic: dodge smartly
    if (Math.abs(b.x - st.x) < b.halfWidth + 0.9) {
      const gap = b.s - st.s - b.halfLength - 1;
      want = Math.min(want, Math.max(0, b.speed + (gap - 2) * 0.8));
    }
  }
  st.speed = approach(st.speed, want, (want > st.speed ? accel : 14) * dt);
  const target = clamp(tx, -hw + 0.6, hw - 0.6);
  st.vx = c.knockT > KNOCK_TIME - KNOCK_HOLD ? st.vx : clamp((target - st.x) * 2.5, -lat, lat);
  st.x = clamp(st.x + st.vx * dt, -hw + 0.4, hw - 0.4);
  st.s += st.speed * dt;
  st.yaw = Math.atan2(st.vx, Math.max(st.speed, 1));
  st.lean = damp(st.lean, clamp(st.vx * 0.12, -0.4, 0.4), 8, dt);
}
