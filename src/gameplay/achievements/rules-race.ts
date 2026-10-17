// Placing, finishing and "passed by a rival's skill" achievements.
import type { RaceResult } from '../../core/contracts';
import type { RiderId } from '../../core/types';
import type { PassWindow, RuleCtx } from './facts';

const PASS_GRACE = 1.0;     // s after the skill ends (the pigeon reappears ahead at the end)
const PHOTO_GAP = 0.3;      // s, winning margin for 一嘴之差
const BLOWOUT_GAP = 10;     // s, winning margin for 一骑绝尘
const VETERAN_RACES = 20;
const CAREER_KOS = 100;

const PASS_SKILLS: Record<string, PassWindow['achievement']> = { 'pigeon.ghost': 'pigeon', 'sloth.flash': 'sloth' };

export function raceRules(ctx: RuleCtx): Array<() => void> {
  const { bus, facts, session, player } = ctx;
  const field = (): number => session.riders.length;

  const markLast = (place: number): void => {
    if (session.phase === 'racing' && field() >= 4 && place >= field()) facts.wasLast = true;
  };

  /** Called on every place change: places are consistent once the last event of a batch arrives. */
  const checkPasses = (): void => {
    const t = ctx.now();
    facts.passes = facts.passes.filter((w) => {
      if (t > w.until) return false;
      const r = session.rider(w.rider);
      if (!r || !w.wasBehind || r.place >= player.place) return true;
      ctx.unlock(w.achievement);
      return false;
    });
  };

  const onFinish = (place: number): void => {
    ctx.sampleHp();
    if (place === 1) {
      ctx.unlock('first_win');
      if (facts.wasLast) ctx.unlock('comeback');
      if (facts.placeAtStretch !== null && facts.placeAtStretch > 1) ctx.unlock('clutch');
      if (player.bike === 'kidbike') ctx.unlock('kidbike');
      if (player.bike === 'erba') ctx.unlock('erba');
    }
    if (place <= 3) {
      ctx.unlock('podium');
      if (facts.wrecks >= 3) ctx.unlock('phoenix');
    }
    if (field() > 1 && place === field()) ctx.unlock('last_place');
    if (!facts.attacked) ctx.unlock('pacifist');
    if (!facts.hurt) ctx.unlock('untouched');
  };

  const onEnd = (results: RaceResult[]): void => {
    const me = results.find((r) => r.isPlayer);
    if (me && me.place === 1 && me.time !== null) {
      const second = results.find((r) => r.place === 2);
      const gap = second && second.time !== null ? second.time - me.time : Infinity;
      if (gap < PHOTO_GAP) ctx.unlock('photo_finish');
      if (gap >= BLOWOUT_GAP) ctx.unlock('blowout');
    }
    // race logic writes save.stats before it emits race:end.
    const { stats } = ctx.app.save.data;
    if (stats.races >= VETERAN_RACES) ctx.unlock('veteran');
    if (stats.kos >= CAREER_KOS) ctx.unlock('kos100');
  };

  const passWindow = (riderId: RiderId, skillId: string): void => {
    const achievement = PASS_SKILLS[skillId];
    const r = session.rider(riderId);
    if (!achievement || !r || ctx.isPlayer(riderId)) return;
    facts.passes.push({ rider: riderId, achievement, wasBehind: r.place > player.place, until: Infinity });
  };

  const closeWindow = (riderId: RiderId, skillId: string): void => {
    for (const w of facts.passes) {
      if (w.rider === riderId && w.achievement === PASS_SKILLS[skillId] && w.until === Infinity) w.until = ctx.now() + PASS_GRACE;
    }
  };

  facts.hp = player.hp;
  return [
    bus.on('race:start', () => {
      facts.started = true;
      markLast(player.place);
    }),
    bus.on('race:placeChange', ({ riderId, to }) => {
      if (ctx.isPlayer(riderId)) markLast(to);
      checkPasses();
    }),
    bus.on('race:finalStretch', ({ riderId }) => {
      if (ctx.isPlayer(riderId) && facts.placeAtStretch === null) facts.placeAtStretch = player.place;
    }),
    bus.on('race:finishLine', ({ riderId, place }) => {
      if (ctx.isPlayer(riderId)) onFinish(place);
    }),
    bus.on('race:end', ({ results }) => onEnd(results)),
    bus.on('skill:cast', ({ riderId, skillId }) => passWindow(riderId, skillId)),
    bus.on('skill:end', ({ riderId, skillId }) => closeWindow(riderId, skillId)),
  ];
}
