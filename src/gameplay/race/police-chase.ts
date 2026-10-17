// The corgi officer's riding (track space): sprint in from behind and hold station alongside for a few
// seconds, then cruise just under the player's own top speed, so a player at full pedal slowly pulls away. Short
// legs tire after chasing close for a while (腿短), traffic blocks it (brakes behind vehicles, changes
// lanes slowly), and a swing or a Wing Dash from the player knocks it back for a few seconds.
import { approach, clamp, damp } from '../../core/math';
import type { Track } from '../../core/contracts';
import type { Obstacle, RiderState } from '../../core/types';

const SPRINT_MUL = 1.28, SPRINT_MAX = 15;   // × player top, while arriving (at most SPRINT_MAX s)…
const ALONG_HOLD = 4;                        // …and for this long alongside
const CRUISE = 0.97;                         // × the player's flat-road top speed
const TIRE_AFTER = 15, TIRED_TIME = 6, TIRED_MUL = 0.85;
const KNOCK_TIME = 3, KNOCK_MUL = 0.7;
export const WALK_BACK = 2.5;                // m/s pushing the bike back to a stopped player
const LOOK = 22;                             // m ahead the corgi watches for traffic

export interface Corgi {
  readonly st: RiderState;
  chaseT: number;     // s since the chase started
  alongT: number;     // s alongside the player this chase (sprint over after ALONG_HOLD)
  closeT: number;     // s chased within CLOSE m since the last rest
  tiredT: number;     // s left out of breath
  knockT: number;     // s left knocked back
}

const CLOSE = 12;                            // m: chasing this close wears the short legs out

export const createCorgi = (st: RiderState): Corgi => ({ st, chaseT: 0, alongT: 0, closeT: 0, tiredT: 0, knockT: 0 });

export function resetCorgi(c: Corgi): void {
  c.chaseT = c.alongT = c.closeT = c.tiredT = c.knockT = 0;
}

/** Advance stamina (`gap` = player.s − corgi.s); returns true on the step the corgi runs out of breath. */
export function tire(c: Corgi, dt: number, gap: number): boolean {
  c.chaseT += dt;
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

/** Knocked aside by the player: slows at once, rides at reduced top for a few seconds. */
export function knock(c: Corgi, awayX: number): void {
  c.knockT = KNOCK_TIME;
  c.st.speed *= 0.6;
  c.st.vx = clamp(awayX * 4, -4, 4);
}

export const tired = (c: Corgi): boolean => c.tiredT > 0;

function topSpeed(c: Corgi, playerTop: number): number {
  const sprint = c.alongT < ALONG_HOLD && c.chaseT < SPRINT_MAX;
  const base = playerTop * (sprint ? SPRINT_MUL : CRUISE);
  return base * (c.tiredT > 0 ? TIRED_MUL : 1) * (c.knockT > 0 ? KNOCK_MUL : 1);
}

/** Nearest solid obstacle in the corgi's path within LOOK m ahead. */
function blocker(obstacles: readonly Obstacle[], st: RiderState, tx: number): Obstacle | null {
  let best: Obstacle | null = null;
  for (const o of obstacles) {
    if (!o.active || !o.solid) continue;
    const ds = o.s - st.s;
    if (ds < -o.halfLength || ds > LOOK + o.halfLength) continue;
    const lane = Math.min(Math.abs(o.x - st.x), Math.abs(o.x - tx));
    if (lane > o.halfWidth + 0.9) continue;
    if (!best || ds < best.s - st.s) best = o;
  }
  return best;
}

export interface RideWorld {
  track: Track;
  obstacles: readonly Obstacle[];
  playerTop: number;
}

/** Ride toward `wantSpeed` and lateral target `tx`; brakes behind traffic and squeezes past slowly. */
export function ride(c: Corgi, w: RideWorld, dt: number, wantSpeed: number, tx: number, accel: number): void {
  const st = c.st;
  let want = clamp(wantSpeed, -WALK_BACK, topSpeed(c, w.playerTop));
  let lat = 4;
  const hw = w.track.bounds(st.s).halfWidth;
  const b = blocker(w.obstacles, st, tx);
  if (b) {
    const gap = b.s - st.s - b.halfLength - 1;
    want = Math.min(want, Math.max(0, b.speed + (gap - 2) * 0.8));
    const room = (side: number): number => hw - side * b.x - b.halfWidth;
    const side = room(1) >= room(-1) ? 1 : -1;
    tx = b.x + side * (b.halfWidth + 1.3);
    lat = 1.6;
  }
  st.speed = approach(st.speed, want, (want > st.speed ? accel : 14) * dt);
  const target = clamp(tx, -hw + 0.6, hw - 0.6);
  st.vx = c.knockT > KNOCK_TIME - 0.4 ? st.vx : clamp((target - st.x) * 2.5, -lat, lat);
  st.x = clamp(st.x + st.vx * dt, -hw + 0.4, hw - 0.4);
  st.s += st.speed * dt;
  st.yaw = Math.atan2(st.vx, Math.max(st.speed, 1));
  st.lean = damp(st.lean, clamp(st.vx * 0.12, -0.4, 0.4), 8, dt);
}
