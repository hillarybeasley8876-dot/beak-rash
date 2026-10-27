// The payoff when an officer goes down (SPEC §25 薄纱警察): a 0.6 s slow-mo beat, the 「柯基下班了！」 line
// (the bubble over the tumbling corgi), its baton on the road as a weapon pickup and the bounty that pays
// the player — 80 coins plus the fines this race. Only the player earns the bounty: an officer that a
// rival put down is still down, but nobody is paid for it.
import type { AppContext } from '../../../core/contracts';
import type { RiderId, Vec3Like } from '../../../core/types';
import { CORGI_LINES } from '../../../data/police-lines';
import type { PoliceCorgi } from './corgi';
import { FIGHT } from './tuning';

export interface PayoffCtx {
  app: AppContext;
  /** The player: the bounty and the downs are theirs. */
  playerId: RiderId;
  /** Where an officer is in the world (its chest). */
  pos(c: PoliceCorgi): Vec3Like;
  /** The fines this race (the bounty gives them back). */
  fines(): number;
  /** Pay coins to the player. */
  pay(coins: number): void;
}

export interface Payoff {
  /** How many officers the player downed this race. */
  readonly downs: number;
  /** An officer went down: the slow-mo, the line, the baton on the road and the bounty. */
  down(c: PoliceCorgi, attacker: RiderId): void;
  /** The slow-mo runs on real time: this is where it is given back. */
  update(realTime: number): void;
}

export function createPayoff(ctx: PayoffCtx): Payoff {
  let downs = 0;
  let slowOn = false;
  let slowEnd = 0;

  return {
    get downs(): number { return downs; },
    down(c: PoliceCorgi, attacker: RiderId): void {
      // the slow-mo beat (it never stacks: a second down does not restart it)
      const real = ctx.app.clock.realTime;
      if (!slowOn || real >= slowEnd) {
        slowOn = true;
        slowEnd = real + FIGHT.slowTime;
        ctx.app.clock.setScale('police', FIGHT.slowScale);
      }
      // the line (the bubble is the only channel it has)
      ctx.app.bus.emit('npc:say', { obstacleId: c.id, character: 'corgi', text: CORGI_LINES.down });
      // its baton drops on the road: the only way for the player to get one
      ctx.app.bus.emit('pickup:spawn', { kind: 'weapon', weapon: 'baton', s: c.st.s, x: c.st.x });
      if (attacker !== ctx.playerId) return;
      downs += 1;
      const refund = ctx.fines();
      ctx.pay(FIGHT.bounty + refund);
      ctx.app.bus.emit('police:bounty', {
        riderId: ctx.playerId, obstacleId: c.id, bounty: FIGHT.bounty, refund, downs, pos: ctx.pos(c),
      });
    },
    update(realTime: number): void {
      if (!slowOn || realTime < slowEnd) return;
      slowOn = false;
      ctx.app.clock.setScale('police', 1, FIGHT.slowRamp);
    },
  };
}
