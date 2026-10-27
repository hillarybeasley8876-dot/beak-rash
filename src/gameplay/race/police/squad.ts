// The 特警 squad (SPEC §25): three corgis with riot shields that ride in when the player has downed three
// officers in one race. They ride in a line behind the player, batons armed; a frontal swing bounces off
// the shield, but their flanks, thrown weapons and skills do not. All three down = 警局下班.
import type { AppContext, Session } from '../../../core/contracts';
import type { Rng } from '../../../core/rng';
import type { RiderState, Vec3Like } from '../../../core/types';
import { clamp } from '../../../core/math';
import { ride, WALK_BACK, type RideWorld } from '../police-chase';
import { createCorgiUnit, disposeCorgiUnit, liftCorgi, placeCorgi, type PoliceCorgi } from './corgi';
import { stepDowned } from './downed';
import { stepOfficer, type FightCtx } from './fight';
import { FIGHT } from './tuning';

export interface SquadCtx {
  app: AppContext;
  session: Session;
  player: RiderState;
  rng: Rng;
  /** The line from an officer (rate limited per officer). */
  say(c: PoliceCorgi, text: string): void;
  /** Where an officer is in the world (its chest). */
  at(c: PoliceCorgi): Vec3Like;
  /** Every member of the squad is down: the police station clocks off. */
  onClear(): void;
}

export interface Squad {
  /** The three members (obstacle ids 910–912), built with the race and hidden until they are called. */
  readonly members: PoliceCorgi[];
  /** Has the squad been called? */
  readonly called: boolean;
  /** The ids of the members that are on the road. */
  activeIds(): number[];
  /** The player downed their third officer: the squad is called. */
  call(): void;
  /** The chase runs: the squad rides in and keeps station behind the player. */
  update(dt: number, fight: FightCtx, world: RideWorld): void;
  /** A member went down: how many are left on the road. */
  noteDown(c: PoliceCorgi): void;
  /** The chase is over (or the station clocks off): the squad goes home. */
  reset(): void;
  dispose(): void;
}

export function createSquad(ctx: SquadCtx): Squad {
  const { session, player } = ctx;
  const members = FIGHT.squadIds.map((id, i) =>
    createCorgiUnit(ctx.app, session.world, id, 97 - i, { shield: true, hp: FIGHT.squadHp }));
  let called = false;
  let arriveIn = 0;

  /** Put the squad on the road: a line behind the player, one on each side of the centre line. */
  const place = (): void => {
    members.forEach((c, i) => {
      const behind = 8 + FIGHT.squadGap + i * FIGHT.squadGapStep;
      const x = clamp(player.x + (i % 2 === 0 ? 1.8 : -1.8), -6, 6);
      placeCorgi(c, session, behind, x);
      c.st.weapon = 'baton';
    });
    ctx.app.bus.emit('police:squad', { phase: 'arrive', obstacleId: members[0]?.id ?? null, left: members.length });
  };

  /** One member rides: it keeps its place in the line behind the player. */
  const rideMember = (c: PoliceCorgi, i: number, dt: number, world: RideWorld): void => {
    const st = c.st;
    const gap = player.s - st.s;
    const target = FIGHT.squadGap + i * FIGHT.squadGapStep;
    const want = gap < -3 && player.speed < 3 ? -WALK_BACK
      : gap < 8 ? player.speed + (gap - target) * 1.2
      : player.speed + clamp(gap * 0.7, -5, 9);
    const tx = player.x + (i % 2 === 0 ? 1.8 : -1.8);
    c.ride.tail = true;   // the squad fights the player: it matches the player's speed
    ride(c.ride, world, dt, want, tx, 5.5);
  };

  return {
    members,
    get called(): boolean { return called; },
    activeIds: () => members.filter((c) => c.active).map((c) => c.id),
    call(): void {
      if (called) return;
      called = true;
      arriveIn = FIGHT.squadDelay;
      ctx.app.bus.emit('police:squad', { phase: 'call', obstacleId: null, left: members.length });
    },
    update(dt: number, fight: FightCtx, world: RideWorld): void {
      if (!called) return;
      if (arriveIn > 0) {
        arriveIn -= dt;
        if (arriveIn <= 0) { arriveIn = 0; place(); }
        return;
      }
      for (const [i, c] of members.entries()) {
        if (!c.active) continue;
        if (c.down || c.leaving) { stepDowned(c, dt, world, session, player, i % 2 === 0 ? 1 : -1); continue; }
        rideMember(c, i, dt, world);
        stepOfficer(fight, c, dt);
      }
    },
    noteDown(c: PoliceCorgi): void {
      const left = members.filter((m) => m.active && !m.down && !m.leaving).length;
      ctx.app.bus.emit('police:squad', { phase: 'down', obstacleId: c.id, left });
      if (left > 0) return;
      ctx.app.bus.emit('police:squad', { phase: 'clear', obstacleId: null, left: 0 });
      ctx.onClear();
    },
    reset(): void {
      for (const c of members) liftCorgi(c, session);
      arriveIn = 0;
    },
    dispose(): void {
      for (const c of members) {
        liftCorgi(c, session);
        disposeCorgiUnit(c);
      }
    },
  };
}
