// The ★3 field (SPEC §14): the reinforcement (a second corgi, obstacle 901), the roadblock that goes up
// ahead of the player, and the 「V我50」 bribe the player rings the bell for.
import type { AppContext, Session } from '../../../core/contracts';
import type { Rng } from '../../../core/rng';
import type { RiderState, Vec3Like } from '../../../core/types';
import { CORGI_LINES } from '../../../data/police-lines';
import { bribeLine, judgeBribe, type BribeOffer } from './bribe';
import { createCorgiUnit, disposeCorgiUnit, liftCorgi, placeCorgi, type PoliceCorgi } from './corgi';
import { placeRoadblock, removeRoadblock, type Roadblock } from './roadblock';
import { CHASE, T } from './tuning';
import type { Wanted } from './wanted';

export interface FieldCtx {
  app: AppContext;
  session: Session;
  player: RiderState;
  wanted: Wanted;
  rng: Rng;
  /** Every officer on the road (the first one and the backup). */
  officers(): PoliceCorgi[];
  /** The officer that leads the chase (the one that answers the player). */
  lead(): PoliceCorgi;
  /** A line from an officer (rate limited per officer). */
  say(c: PoliceCorgi, text: string): void;
  /** Where an officer is in the world (its chest). */
  at(c: PoliceCorgi): Vec3Like;
}

export interface Field {
  /** The backup officer (obstacle 901), built with the race. */
  readonly backup: PoliceCorgi;
  /** The stars reached ★3: the reinforcement and the block are on their way. */
  onStars(): void;
  /** An officer went down: a backup arrives in a few seconds if none is out. */
  onDown(): void;
  /** The chase runs: the backup arrives, the block goes up and comes down again. */
  update(dt: number, chasing: boolean): void;
  /** The chase is over: the block comes down and the next chase starts fresh. */
  reset(): void;
  /** The 「V我50」 offer: how the officer answers it. */
  offer(attempts: number): BribeOffer;
  /** Is this obstacle one of the roadblock's barriers? */
  isBarrier(id: number): boolean;
  summary(): { backup: boolean; roadblock: number | null };
  dispose(): void;
}

export function createField(ctx: FieldCtx): Field {
  const { session, player } = ctx;
  const backup = createCorgiUnit(ctx.app, session.world, 901, 98);
  let backupIn = 0;                 // s until the backup sprints in
  let roadblock: Roadblock | null = null;
  let roadblockIn = 0;              // s until the block goes up
  let roadblockUsed = false;        // one block per chase

  /** The block goes up: solid barriers across the road with one gap, and the sign. */
  const raiseBlock = (): void => {
    roadblock = placeRoadblock(session, ctx.rng);
    if (!roadblock) return;
    ctx.app.bus.emit('police:roadblock', {
      riderId: player.id, s: roadblock.s, gapX: +roadblock.gapX.toFixed(2),
      gapWidth: roadblock.gapWidth, pos: ctx.at(ctx.lead()),
    });
    ctx.say(ctx.lead(), ctx.rng.pick(CORGI_LINES.roadblock));
  };

  return {
    backup,
    onStars(): void {
      if (!backup.active && backupIn <= 0) backupIn = T.backupDelay;
      if (roadblockUsed) return;
      roadblockUsed = true;
      roadblockIn = T.delay;
    },
    onDown(): void {
      if (!backup.active) backupIn = T.backupDelayDown;
    },
    update(dt: number, chasing: boolean): void {
      if (!chasing) return;
      if (backupIn > 0) {
        backupIn -= dt;
        if (backupIn <= 0) {
          backupIn = 0;
          placeCorgi(backup, session, CHASE.spawnBehind, clampSide(player.x, ctx.lead().side));
          backup.st.weapon = ctx.wanted.level >= 2 ? 'baton' : 'none';
          ctx.say(backup, ctx.rng.pick(CORGI_LINES.backup));
        }
      }
      if (roadblockIn > 0) {
        roadblockIn -= dt;
        if (roadblockIn <= 0) { roadblockIn = 0; raiseBlock(); }
      }
      if (!roadblock) return;
      if (!roadblock.passed && player.s > roadblock.s) { roadblock.passed = true; roadblock.sincePass = 0; }
      if (!roadblock.passed) return;
      roadblock.sincePass += dt;
      if (roadblock.sincePass > T.lifetime) { removeRoadblock(roadblock, session); roadblock = null; }
    },
    reset(): void {
      if (roadblock) { removeRoadblock(roadblock, session); roadblock = null; }
      roadblockIn = 0;
      roadblockUsed = false;
      backupIn = 0;
    },
    offer(attempts: number): BribeOffer {
      let near: PoliceCorgi | null = null;
      let dist: number | null = null;
      for (const c of ctx.officers()) {
        if (!c.active || c.down) continue;
        const d = Math.hypot(c.st.s - player.s, c.st.x - player.x);
        if (dist === null || d < dist) { dist = d; near = c; }
      }
      const verdict = judgeBribe(ctx.wanted.level, player.coins, attempts, dist);
      if (verdict === 'noOfficer' || !near) return { verdict, officer: null, line: '' };
      return { verdict, officer: near, line: bribeLine(verdict, ctx.rng) };
    },
    isBarrier(id: number): boolean {
      return !!roadblock && roadblock.obstacles.some((o) => o.id === id);
    },
    summary(): { backup: boolean; roadblock: number | null } {
      return { backup: backup.active, roadblock: roadblock ? +roadblock.s.toFixed(0) : null };
    },
    dispose(): void {
      if (roadblock) removeRoadblock(roadblock, session);
      liftCorgi(backup, session);
      disposeCorgiUnit(backup);
    },
  };
}

/** The backup rides on the other side of the player, a little further out. */
function clampSide(playerX: number, leadSide: number): number {
  return Math.max(-4, Math.min(4, playerX - leadSide * 2.2));
}
