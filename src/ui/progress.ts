// Career ladder, grades and race rewards (coins, bests, unlocks) written to app.save.
// ui-screens credits the player's RaceResult.coins; race logic owns save.stats and gameplay/achievements
// saves its own unlocks (see status file).
import type { RaceConfig, RaceResult } from '../core/contracts';
import type { SaveStore } from '../core/save';
import type { TrackId } from '../core/types';
import { GRADES, type Grade } from '../data/memes';
import { TRACK_ORDER } from '../data/tracks';

export type Tier = 1 | 2 | 3;

export interface CareerEvent { index: number; tier: Tier; trackId: TrackId; key: string }

export const CAREER: CareerEvent[] = ([1, 2, 3] as Tier[]).flatMap((tier) =>
  TRACK_ORDER.map((trackId, i) => ({ index: (tier - 1) * TRACK_ORDER.length + i + 1, tier, trackId, key: `${tier}-${trackId}` })));

export const PLACE_BONUS = [500, 300, 200, 120, 80, 50, 30, 10];
export const KO_BONUS = 50;
export const UNLOCK_PLACE = 3;

export const isUnlocked = (save: SaveStore, ev: CareerEvent): boolean => ev.index <= save.data.career.unlocked;
export const bestPlace = (save: SaveStore, ev: CareerEvent): number | null => save.data.career.best[ev.key] ?? null;

export function careerEvent(config: RaceConfig | undefined): CareerEvent | null {
  if (!config || config.mode !== 'career') return null;
  return CAREER.find((e) => e.trackId === config.trackId && e.tier === config.level) ?? null;
}

export const ordinal = (n: number): string => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH';
  return `${n}${s}`;
};

/** S…D from place (relative to field size), KOs and wrecks; DNF is always D. */
export function gradeFor(r: RaceResult, field: number): Grade {
  const fallback: Grade = { grade: 'D', title: '咸鱼' };
  const pick = (g: Grade['grade']): Grade => GRADES.find((x) => x.grade === g) ?? fallback;
  if (r.time === null) return pick('D');
  const placeScore = field <= 1 ? 80 : (80 * (field - r.place)) / (field - 1);
  const score = placeScore + r.kos * 8 - r.wrecked * 6;
  return pick(score >= 92 ? 'S' : score >= 70 ? 'A' : score >= 45 ? 'B' : score >= 22 ? 'C' : 'D');
}

export interface Reward {
  coins: number;
  breakdown: Array<{ label: string; value: number }>;
  grade: Grade;
  /** Beat an existing career best. */
  newBest: boolean;
  /** First finish of this career event (no best yet). */
  firstFinish: boolean;
  unlocked: CareerEvent | null;
  balanceBefore: number;
  balanceAfter: number;
}

/** Breakdown per SPEC (place bonus + KOs + pickups) when it adds up; otherwise just the total. */
function breakdown(r: RaceResult): Reward['breakdown'] {
  const place = r.time === null ? 0 : PLACE_BONUS[r.place - 1] ?? 0;
  const kos = r.kos * KO_BONUS;
  const rest = r.coins - place - kos;
  if (rest < 0) return [{ label: '本场收入', value: r.coins }];
  const rows = [{ label: '名次奖励', value: place }, { label: `击倒 ×${r.kos}`, value: kos }];
  if (rest > 0) rows.push({ label: '路上捡的', value: rest });
  return rows;
}

const credited = new WeakMap<RaceResult[], Reward>();

/** Credit one race exactly once (re-mounting the results screen returns the first reward, never pays twice). */
export function applyRewards(save: SaveStore, config: RaceConfig | undefined, results: RaceResult[], persist: boolean): Reward {
  const cached = credited.get(results);
  if (cached) return cached;
  const me = results.find((r) => r.isPlayer);
  const before = save.data.coins;
  const ev = careerEvent(config);
  const reward: Reward = {
    coins: me?.coins ?? 0, breakdown: me ? breakdown(me) : [], grade: me ? gradeFor(me, results.length) : { grade: 'D', title: '咸鱼' },
    newBest: false, firstFinish: false, unlocked: null, balanceBefore: before, balanceAfter: before,
  };
  if (!me) return reward;
  const prevBest = ev ? bestPlace(save, ev) : null;
  const finished = me.time !== null;
  reward.firstFinish = Boolean(ev && finished && prevBest === null);
  reward.newBest = Boolean(ev && finished && prevBest !== null && me.place < prevBest);
  const next = ev && finished && me.place <= UNLOCK_PLACE ? CAREER[ev.index] ?? null : null;
  reward.unlocked = next && !isUnlocked(save, next) ? next : null;
  reward.balanceAfter = Math.max(0, before + reward.coins);
  if (!persist) return reward;
  credited.set(results, reward);
  save.update((d) => {
    d.coins = reward.balanceAfter;
    if (ev && (reward.newBest || reward.firstFinish)) d.career.best[ev.key] = me.place;
    if (reward.unlocked) d.career.unlocked = Math.max(d.career.unlocked, reward.unlocked.index);
  });
  return reward;
}
