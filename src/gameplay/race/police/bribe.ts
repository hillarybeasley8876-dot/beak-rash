// 「V我50」 — the bribe (SPEC §14). The player rings the bell next to an officer and offers 50
// race coins: at ★1–★2 the officer takes the money and lets the player go (no escape credit),
// at ★3 / with too few coins / for the third time this race it refuses.
import { clamp01 } from '../../../core/math';
import type { AppContext } from '../../../core/contracts';
import type { Rng } from '../../../core/rng';
import type { RiderState } from '../../../core/types';
import { CORGI_LINES } from '../../../data/police-lines';
import type { PoliceCorgi } from './corgi';
import { T } from './tuning';
import type { Wanted } from './wanted';

export type BribeVerdict = 'accepted' | 'noLevel' | 'noCoins' | 'tooMany' | 'noOfficer';

export interface BribeOffer {
  verdict: BribeVerdict;
  /** The officer that answered (null when nobody was in reach). */
  officer: PoliceCorgi | null;
  /** The line it said. */
  line: string;
}

/** What the officer makes of the offer. `dist` = the metres to the nearest officer (null = none). */
export function judgeBribe(level: number, coins: number, attempts: number, dist: number | null): BribeVerdict {
  if (dist === null || dist > T.reach) return 'noOfficer';
  if (level < 1 || level > 2) return 'noLevel';
  if (attempts >= T.maxBribes) return 'tooMany';
  if (coins < T.price) return 'noCoins';
  return 'accepted';
}

/** The line the officer answers with. */
export function bribeLine(verdict: BribeVerdict, rng: Rng): string {
  if (verdict === 'accepted') return rng.pick(CORGI_LINES.bribeYes);
  if (verdict === 'noLevel') return rng.pick(CORGI_LINES.bribeNoW3);
  if (verdict === 'noCoins') return rng.pick(CORGI_LINES.bribeNoCoins);
  if (verdict === 'tooMany') return rng.pick(CORGI_LINES.bribeNoThird);
  return '';
}

export interface BribeCtx {
  app: AppContext;
  player: RiderState;
  wanted: Wanted;
  /** The offer the officer made. */
  offer: BribeOffer;
  /** A line from an officer (rate limited per officer). */
  say(c: PoliceCorgi, text: string): void;
  /** The chase lets the player go (a let-go, not an escape). */
  letGo(): void;
  /** No new chase for a while (s). */
  coolFor(seconds: number): void;
  /** The stars changed: tell the world. */
  syncWanted(): void;
}

/** The answer to the bell: the money is taken and the chase lets the player go, or the officer refuses. */
export function takeBribe(ctx: BribeCtx): void {
  const { app, player, offer } = ctx;
  const accepted = offer.verdict === 'accepted';
  app.bus.emit('police:bribe', { riderId: player.id, obstacleId: offer.officer?.id ?? 0, amount: T.price, accepted });
  if (offer.officer) ctx.say(offer.officer, offer.line);
  if (accepted) {
    player.coins -= T.price;
    player.heat = T.heatAfter;
    ctx.coolFor(T.noChaseTime);
    ctx.wanted.reset();
    ctx.syncWanted();
    ctx.letGo();   // a let-go, not an escape: no 'lost' credit
    return;
  }
  player.heat = clamp01(player.heat + T.refuseHeat);
  ctx.wanted.refuse();
  ctx.syncWanted();
}
