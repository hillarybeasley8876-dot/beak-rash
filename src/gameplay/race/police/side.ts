// Which side of the player the officer rides on (SPEC §9/§14): the side that is on the road and free —
// a rival parked there or the edge of the road sends it to the other side.
import type { Session, Track } from '../../../core/contracts';
import type { RiderState } from '../../../core/types';
import { CHASE } from './tuning';

/** Is the spot beside the player at lateral `x` taken by another rider? */
export function taken(session: Session, player: RiderState, x: number): boolean {
  return session.riders.some((r) => !r.isPlayer && (r.mode === 'racing' || r.mode === 'finished')
    && Math.abs(r.s - player.s) < 2.5 && Math.abs(r.x - x) < CHASE.sideClear);
}

/** The side of the player the officer rides on. */
export function chooseSide(
  side: 1 | -1, gap: number, officerX: number, session: Session, player: RiderState, track: Track,
): 1 | -1 {
  if (Math.abs(gap) > 14) side = officerX <= player.x ? -1 : 1;
  const hw = track.bounds(player.s).halfWidth;
  const here = player.x + side * 1.6, there = player.x - side * 1.6;
  const offRoad = (x: number): boolean => Math.abs(x) > hw - 0.6;
  if (offRoad(here) || (taken(session, player, here) && !offRoad(there) && !taken(session, player, there))) {
    side = side === 1 ? -1 : 1;
  }
  return side;
}
