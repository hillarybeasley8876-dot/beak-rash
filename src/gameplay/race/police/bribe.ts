// 「V我50」 — the bribe (SPEC §14). The player rings the bell next to an officer and offers 50
// race coins: at ★1–★2 the officer takes the money and lets the player go (no escape credit),
// at ★3 / with too few coins / for the third time this race it refuses.
import type { Rng } from '../../../core/rng';
import { CORGI_LINES } from '../../../data/police-lines';
import { T } from './tuning';

export type BribeVerdict = 'accepted' | 'noLevel' | 'noCoins' | 'tooMany' | 'noOfficer';

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
