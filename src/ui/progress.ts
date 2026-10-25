// Career ladder, grades and race rewards (coins, bests, unlocks) written to app.save.
// ui-screens credits the player's RaceResult.coins; race logic owns save.stats and gameplay/achievements
// saves its own unlocks (see status file).
import type { RaceConfig, RaceResult } from '../core/contracts';
import type { SaveStore } from '../core/save';
import type { TrackId, Weather } from '../core/types';
import { GRADES, type Grade } from '../data/memes';
import { TRACK_ORDER, TRACK_WEATHER } from '../data/tracks';
import { CUPS } from './copy';

export type Tier = 1 | 2 | 3;

/** One rung of the ladder: a track in a weather, forward or reversed, on the authored layout or a seeded route. */
export interface CareerEvent {
  index: number; tier: Tier; trackId: TrackId; key: string;
  weather: Weather; reverse: boolean; route: number;
}

/** Cup 3's seeded routes (fixed seeds: every player races the same route). */
const CUP3_ROUTES: Partial<Record<TrackId, number>> = { city: 4821, watertown: 1337 };

/** The ladder: 3 cups × 5 tracks. Cup 1 = every track in its own weather, forward, the authored layout.
 *  Cup 2 = every track in one of its other weathers. Cup 3 = reversed or on a fixed seeded route. */
export const CAREER: CareerEvent[] = ([1, 2, 3] as Tier[]).flatMap((tier) =>
  TRACK_ORDER.map((trackId, i) => {
    const own = TRACK_WEATHER[trackId][0] ?? 'clear';
    const weather = tier === 1 ? own : (TRACK_WEATHER[trackId][1] ?? own);
    const route = tier === 3 ? (CUP3_ROUTES[trackId] ?? 0) : 0;
    return {
      index: (tier - 1) * TRACK_ORDER.length + i + 1, tier, trackId, key: `${tier}-${trackId}`,
      weather, reverse: tier === 3 && route === 0, route,
    };
  }));

export const PLACE_BONUS = [500, 300, 200, 120, 80, 50, 30, 10];
export const KO_BONUS = 50;
export const UNLOCK_PLACE = 3;
/** One-time bonus for the first top-3 finish on a cup's last event (tier 3's is the career clear). */
export const CLEAR_BONUS: Record<Tier, number> = { 1: 300, 2: 600, 3: 1000 };

export const bestPlace = (save: SaveStore, ev: CareerEvent): number | null => save.data.career.best[ev.key] ?? null;

/** An event is open when it is the first one, when it has a best place of its own, or when the event
 *  before it has a top-3 best. The rule reads the best places, so a save from the three-track career
 *  keeps its progress when the ladder grows to five tracks. */
export const isUnlocked = (save: SaveStore, ev: CareerEvent): boolean => {
  if (ev.index <= 1) return true;
  if (bestPlace(save, ev) !== null) return true;
  const prev = CAREER[ev.index - 2];
  const prevBest = prev ? bestPlace(save, prev) : null;
  return prevBest !== null && prevBest <= UNLOCK_PLACE;
};

/** The highest open event index — the ladder's "unlocked" counter, still written to the save. */
export const highestOpen = (save: SaveStore): number => {
  let last = 1;
  for (const ev of CAREER) if (isUnlocked(save, ev)) last = Math.max(last, ev.index);
  return last;
};

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

const KO_GRADE_CAP = 3;  // KOs past this add nothing to the grade (SHOWTIME chains hand out 8-13 a race)
const LEAD_POINTS = 4;   // grade points per second of lead over 2nd place: a clean, dominant win reaches S too
const LEAD_CAP = 12;     // … up to a 3 s lead

/** S…D from place (relative to field size), KOs (capped), the winning margin and wrecks; DNF is always D.
 *  KOs lift a grade but never buy one: S needs a win (with KOs or a clear lead), a win is at least A, and
 *  A otherwise needs the podium. `results` = the whole field (its 2nd place gives the winning margin). */
export function gradeFor(r: RaceResult, results: readonly RaceResult[]): Grade {
  const fallback: Grade = { grade: 'D', title: '咸鱼' };
  const pick = (g: Grade['grade']): Grade => GRADES.find((x) => x.grade === g) ?? fallback;
  if (r.time === null) return pick('D');
  const field = results.length;
  const placeScore = field <= 1 ? 80 : (80 * (field - r.place)) / (field - 1);
  // Winning margin over 2nd place (a 2nd place that never finished counts as the full bonus).
  const second = r.place === 1 ? results.find((x) => x.place === 2) : undefined;
  const margin = !second ? 0 : second.time === null ? Infinity : Math.max(0, second.time - r.time);
  const score = placeScore + Math.min(r.kos, KO_GRADE_CAP) * 8 + Math.min(LEAD_CAP, margin * LEAD_POINTS) - r.wrecked * 6;
  if (r.place === 1) return pick(score >= 92 ? 'S' : 'A');
  if (score >= 65 && r.place <= 3) return pick('A');
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
    coins: me?.coins ?? 0, breakdown: me ? breakdown(me) : [], grade: me ? gradeFor(me, results) : { grade: 'D', title: '咸鱼' },
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
    // The counter follows the ladder's own rule (the new best may have opened the next event).
    d.career.unlocked = Math.max(d.career.unlocked, highestOpen(save));
  });
  return reward;
}
