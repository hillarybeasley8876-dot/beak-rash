// How the officer rides (track space, SPEC §9/§14): it tails the player at ★2+ so the player can hit it,
// it commits to a lunge while it winds the baton up, and it stays on screen — once it trails out of sight it
// sprints back once with a line, and the next time it trails it gives up.
import { clamp } from '../../../core/math';
import type { Rng } from '../../../core/rng';
import type { Session } from '../../../core/contracts';
import type { RiderState } from '../../../core/types';
import { POLICE_LINES } from '../../../data/roster';
import { resprint, ride, sprinting, tire, tired, WALK_BACK, type RideWorld } from '../police-chase';
import type { PoliceCorgi } from './corgi';
import { stepDowned } from './downed';
import { stepOfficer, type FightCtx } from './fight';
import { CHASE, T } from './tuning';
import type { Wanted } from './wanted';

export interface OfficerRide {
  world: RideWorld;
  session: Session;
  player: RiderState;
  wanted: Wanted;
  fight: FightCtx;
}

/** Ride one officer: it holds station beside the player and it winds its baton up. */
export function rideOfficer(r: OfficerRide, c: PoliceCorgi, dt: number, mySide: number): void {
  const st = c.st;
  // A downed officer tumbles, sits up and rides off the road (it is gone from the chase).
  if (c.down || c.leaving) { stepDowned(c, dt, r.world, r.session, r.player, mySide); return; }
  const gap = r.player.s - st.s;
  const tx = Math.abs(gap) < 14 ? r.player.x + mySide * 1.6 : r.player.x;
  const targetGap = r.wanted.level >= 2 ? T.tailGap : 0;
  // At ★2+ the officer fights the player: it matches the player's speed instead of cruising under it,
  // so it stays in reach of the next swing (r6 SPEC §25).
  c.ride.tail = r.wanted.level >= 2;
  const want = gap < -3 && r.player.speed < 3 ? -WALK_BACK
    : gap < 6 ? r.player.speed + (gap - targetGap) * 1.5
    : r.player.speed + clamp(gap * 0.7, -5, 9);
  if (c.baton.windup > 0) ride(c.ride, r.world, dt, 0, tx, T.lungeAccel, c.lunge);
  else ride(c.ride, r.world, dt, want, tx, 5.5);
  tire(c.ride, dt, gap);
  stepOfficer(r.fight, c, dt);
}

export interface TrailCtx {
  officer: PoliceCorgi;
  rng: Rng;
  /** A line from the officer (rate limited per officer). */
  say(c: PoliceCorgi, text: string): void;
  /** The one re-sprint of this chase is used. */
  resprinted: boolean;
  /** s trailing more than CHASE.trailGap behind the player. */
  trailT: number;
}

/** Trailing behind the camera: one more sprint back (with a line), then the corgi gives up; stuck behind it
 *  (still out of sight after CHASE.stuckTime, sprinting or not) it gives up as soon as the chase may end. */
export function trail(ctx: TrailCtx, dt: number, gap: number): boolean {
  ctx.trailT = gap > CHASE.trailGap ? ctx.trailT + dt : 0;
  if (ctx.trailT > CHASE.stuckTime) return true;
  if (ctx.trailT < CHASE.trailTime || sprinting(ctx.officer.ride)) return false;
  ctx.trailT = 0;
  if (ctx.resprinted || tired(ctx.officer.ride)) return true;
  ctx.resprinted = true;
  resprint(ctx.officer.ride);
  ctx.say(ctx.officer, ctx.rng.pick(POLICE_LINES.chase));
  return false;
}
