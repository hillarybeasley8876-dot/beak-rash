// Career ladder, grades and race rewards (coins, bests, unlocks) written to app.save.
// ui-screens credits the player's RaceResult.coins; race logic owns save.stats and gameplay/achievements
// saves its own unlocks (see status file).
import type { RaceConfig, RaceResult } from '../core/contracts';
import type { SaveStore } from '../core/save';
import type { TrackId } from '../core/types';
import { GRADES, type Grade } from '../data/memes';
import { TRACK_ORDER } from '../data/tracks';
import { CUPS } from './copy';

export type Tier = 1 | 2 | 3;

export interface CareerEvent { index: number; tier: Tier; trackId: TrackId; key: string }

export const CAREER: CareerEvent[] = ([1, 2, 3] as Tier[]).flatMap((tier) =>
  TRACK_ORDER.map((trackId, i) => ({ index: (tier - 1) * TRACK_ORDER.length + i + 1, tier, trackId, key: `${tier}-${trackId}` })));

export const PLACE_BONUS = [500, 300, 200, 120, 80, 50, 30, 10];
export const KO_BONUS = 50;
export const UNLOCK_PLACE = 3;
/** One-time bonus for the first top-3 finish on a cup's last event (tier 3's is the career clear). */
export const CLEAR_BONUS: Record<Tier, number> = { 1: 300, 2: 600, 3: 1000 };

export const isUnlocked = (save: SaveStore, ev: CareerEvent): boolean => ev.index <= save.data.career.unlocked;
export const bestPlace = (save: SaveStore, ev: CareerEvent): number | null => save.data.career.best[ev.key] ?? null;

/** Last event of its cup: a top-3 finish there clears the cup. */
export const isCupFinal = (ev: CareerEvent): boolean => ev.index % TRACK_ORDER.length === 0;
/** Last event of the whole career. */
export const isCareerFinal = (ev: CareerEvent): boolean => ev.index === CAREER.length;
export const cupName = (tier: Tier): string => CUPS[tier - 1]?.cn ?? `TIER ${tier}`;

/** A cup is clear once its last event has a top-3 best. */
export function cupCleared(save: SaveStore, tier: Tier): boolean {
  const last = CAREER.find((e) => e.tier === tier && isCupFinal(e));
  const best = last ? bestPlace(save, last) : null;
  return best !== null && best <= UNLOCK_PLACE;
}

export const careerCleared = (save: SaveStore): boolean => ([1, 2, 3] as Tier[]).every((t) => cupCleared(save, t));

export function careerEvent(config: RaceConfig | undefined): CareerEvent | null {
  if (!config || config.mode !== 'career') return null;
  return CAREER.find((e) => e.trackId === config.trackId && e.tier === config.level) ?? null;
}

export const ordinal = (n: number): string => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH';
  return `${n}${s}`;
};

const KO_GRADE_CAP = 3; // KOs past this add nothing to the grade (SHOWTIME chains hand out 8-13 a race)

/** S…D from place (relative to field size), KOs (capped) and wrecks; DNF is always D. KOs lift a grade but never
 * buy one: S needs a top-2 finish, A the podium. */
export function gradeFor(r: RaceResult, field: number): Grade {
  const fallback: Grade = { grade: 'D', title: '咸鱼' };
  const pick = (g: Grade['grade']): Grade => GRADES.find((x) => x.grade === g) ?? fallback;
  if (r.time === null) return pick('D');
  const placeScore = field <= 1 ? 80 : (80 * (field - r.place)) / (field - 1);
  const score = placeScore + Math.min(r.kos, KO_GRADE_CAP) * 8 - r.wrecked * 6;
  if (score >= 92 && r.place <= 2) return pick('S');
  if (score >= 70 && r.place <= 3) return pick('A');
  return pick(score >= 45 ? 'B' : score >= 22 ? 'C' : 'D');
}

export interface Reward {
  coins: number;
  breakdown: Array<{ label: string; value: number }>;
  grade: Grade;
  /** The player's finishing place (null = DNF or no player). */
  place: number | null;
  /** Beat an existing career best. */
  newBest: boolean;
  /** First finish of this career event (no best yet). */
  firstFinish: boolean;
  unlocked: CareerEvent | null;
  /** Top-3 finish on a cup's last event: the cup (on tier 3 the whole career) is clear; first = bonus paid. */
  clear: { tier: Tier; career: boolean; first: boolean } | null;
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
    place: me && me.time !== null ? me.place : null,
    newBest: false, firstFinish: false, unlocked: null, clear: null, balanceBefore: before, balanceAfter: before,
  };
  if (!me) return reward;
  const prevBest = ev ? bestPlace(save, ev) : null;
  const finished = me.time !== null;
  reward.firstFinish = Boolean(ev && finished && prevBest === null);
  reward.newBest = Boolean(ev && finished && prevBest !== null && me.place < prevBest);
  const next = ev && finished && me.place <= UNLOCK_PLACE ? CAREER[ev.index] ?? null : null;
  reward.unlocked = next && !isUnlocked(save, next) ? next : null;
  if (ev && finished && me.place <= UNLOCK_PLACE && isCupFinal(ev)) {
    const first = prevBest === null || prevBest > UNLOCK_PLACE;
    reward.clear = { tier: ev.tier, career: isCareerFinal(ev), first };
    if (first) {
      reward.coins += CLEAR_BONUS[ev.tier];
      reward.breakdown.push({ label: `${cupName(ev.tier)}通关`, value: CLEAR_BONUS[ev.tier] });
    }
  }
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
