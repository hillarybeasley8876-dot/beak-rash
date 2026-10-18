// Results flow helpers: demo data for ?screen=results, the "下一站" race, and leaving the finished race
// for a menu screen (a career race returns to the ladder, focused on the event that just opened up).
import type { RaceConfig, RaceResult } from '../../core/contracts';
import type { CharacterId } from '../../core/types';
import { RACER_POOL, ROSTER } from '../../data/roster';
import { TRACK_ORDER } from '../../data/tracks';
import { CAREER, careerEvent, isUnlocked } from '../progress';
import type { ScreenCtx } from '../screen';
import { remember } from './memory';

export const DEMO_ACHIEVEMENTS = ['first_ko', 'double', 'goose', 'perfect_start', 'drift3'];

export function demoResults(): RaceResult[] {
  const field: CharacterId[] = ['goose', 'pelican', ...RACER_POOL.filter((c) => c !== 'goose').slice(0, 6)];
  return field.map((character, i) => ({
    riderId: i, character, name: ROSTER[character].name, isPlayer: character === 'pelican', place: i + 1,
    time: i < 7 ? 151.37 + i * 2.91 + (i % 3) * 0.47 : null, kos: character === 'pelican' ? 2 : i % 3 === 0 ? 1 : 0,
    wrecked: i % 4 === 1 ? 1 : 0, coins: [500, 300, 200, 120, 80, 50, 30, 10][i]! + (character === 'pelican' ? 100 : 0),
  }));
}

/** The race to run after "下一站": next career event if unlocked, otherwise the next quick track. */
export function nextRace(ctx: ScreenCtx, config: RaceConfig | undefined): Partial<RaceConfig> | null {
  const ev = careerEvent(config);
  if (ev) {
    const next = CAREER[ev.index];
    return next && isUnlocked(ctx.app.save, next) ? { trackId: next.trackId, mode: 'career', level: next.tier } : null;
  }
  const i = TRACK_ORDER.indexOf(config?.trackId ?? 'coast');
  return { trackId: TRACK_ORDER[(i + 1) % TRACK_ORDER.length] ?? 'coast', mode: 'quick' };
}

/** quitRace ends the session and asks for the menu; a later go() to another screen wins (latest-wins router). */
export function leaveRace(ctx: ScreenCtx, config: RaceConfig | undefined, to: 'menu' | 'garage' | 'career'): void {
  const ev = careerEvent(config);
  if (to === 'career' && ev) {
    const next = CAREER[ev.index];
    remember('career', next && isUnlocked(ctx.app.save, next) ? ev.index : ev.index - 1);
  }
  ctx.app.bus.emit('flow:quitRace', {});
  if (to !== 'menu') ctx.go(to);
}
