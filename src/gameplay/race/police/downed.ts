// A downed officer (SPEC §14/§25): it tumbles to a stop, sits up, shakes its head and rides off the road.
// It is lifted (gone from the chase) T.leaveTime after it sits up, or as soon as the player is far ahead of
// it — the road is free again for the next one.
import type { Session } from '../../../core/contracts';
import type { RiderState } from '../../../core/types';
import { ride, type RideWorld } from '../police-chase';
import { liftCorgi, type PoliceCorgi } from './corgi';
import { T } from './tuning';

/** True while the officer is still on the road (down or on its way off). */
export function stepDowned(
  c: PoliceCorgi, dt: number, world: RideWorld, session: Session, player: RiderState, side: number,
): boolean {
  if (c.down) {
    // the tumble: it slides to a stop
    c.st.speed = Math.max(0, c.st.speed - 6 * dt);
    c.st.s += c.st.speed * dt;
    c.downT += dt;
    if (c.downT < T.downTime) return true;
    c.down = false;
    c.leaving = true;
    c.leaveT = 0;
    c.st.mode = 'racing';
    c.st.crash = null;
    return true;
  }
  if (!c.leaving) return false;
  // it rides off to the side of the road
  const hw = session.track.bounds(c.st.s).halfWidth;
  ride(c.ride, world, dt, Math.max(0, c.st.speed - 6 * dt), side * (hw - 0.8), 3);
  c.leaveT += dt;
  if (c.leaveT >= T.leaveTime || player.s - c.st.s > 45 || c.st.s - player.s > 120) liftCorgi(c, session);
  return true;
}
