// One corgi officer: the actors RiderView (corgi on an MTB with a beacon), the race-owned
// RiderState it is posed from, the obstacle the game sees (900 = the first officer, 901 = the
// backup) and its fight state (HP, baton, down). Two of these can chase at once at ★3.
import type { AppContext, Session } from '../../../core/contracts';
import { createRiderState } from '../../../core/rider';
import { ROSTER } from '../../../data/roster';
import type { Obstacle, RiderState, Side } from '../../../core/types';
import type { Group } from 'three';
import { createCorgi, resetCorgi, type Corgi } from '../police-chase';
import { PoliceView } from '../police-view';
import { createBaton, resetBaton, type Baton } from './baton';
import { T } from './tuning';

export interface PoliceCorgi {
  /** The obstacle id the game knows this officer by (900 = the first, 901 = the backup). */
  readonly id: number;
  readonly st: RiderState;
  /** The riding state (sprint, cruise, tiredness, knocks). */
  readonly ride: Corgi;
  readonly view: PoliceView;
  readonly ob: Obstacle;
  readonly baton: Baton;
  hp: number;
  /** True while the officer is knocked out of the chase (it sits up and leaves). */
  down: boolean;
  /** s since it went down. */
  downT: number;
  /** True while it rides off after the chase or after going down. */
  leaving: boolean;
  /** The speed it commits to while it winds the baton up (m/s). */
  lunge: number;
  /** The side of the player it rides on. */
  side: Side;
  /** Sim time of its last line (the per-officer rate limit). */
  lastSay: number;
  /** Is it on the road? */
  active: boolean;
}

export function createCorgiUnit(app: AppContext, world: Group, id: number, riderId: number): PoliceCorgi {
  const st = createRiderState(riderId, 'corgi', 'mtb', false);
  st.name = ROSTER.corgi.name;
  st.mode = 'racing';
  const ob: Obstacle = {
    id, kind: 'police', s: 0, x: 0, speed: 0, halfWidth: 0.45, halfLength: 0.9, height: 1.6,
    solid: false, active: false,
  };
  const view = new PoliceView(app, world);
  view.visible = false;
  return {
    id, st, ride: createCorgi(st), view, ob, baton: createBaton(),
    hp: T.hp, down: false, downT: 0, leaving: false, lunge: 0, side: 1, lastSay: -99, active: false,
  };
}

export function disposeCorgiUnit(c: PoliceCorgi): void {
  c.view.dispose();
}

/** Put an officer on the road (the first one when the chase starts, the backup at ★3). */
export function placeCorgi(c: PoliceCorgi, session: Session, behind: number, x: number): void {
  resetCorgi(c.ride);
  c.st.s = Math.max(5, session.player.s - behind);
  c.st.x = x;
  c.st.speed = Math.max(session.player.speed + 4, 12);
  c.st.vx = 0;
  c.st.mode = 'racing';
  c.hp = T.hp;
  c.down = false;
  c.downT = 0;
  c.leaving = false;
  c.lunge = 0;
  resetBaton(c.baton);
  c.active = true;
  c.view.visible = true;
  c.ob.active = true;
  if (!session.obstacles.includes(c.ob)) session.obstacles.push(c.ob);
}

/** Take an officer off the road (it is out of the chase but the game keeps its record). */
export function liftCorgi(c: PoliceCorgi, session: Session): void {
  c.active = false;
  c.view.visible = false;
  c.ob.active = false;
  c.st.action = null;
  const i = session.obstacles.indexOf(c.ob);
  if (i >= 0) session.obstacles.splice(i, 1);
}
