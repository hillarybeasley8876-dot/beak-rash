// Cup and career clears (ui/progress.ts owns the ladder): a top-3 finish on a cup's last event clears the cup,
// all three cups clear the career. Decided at race:end from this race's result (the results screen writes the
// career save after it), plus any cup the save already shows cleared, so a save from before these achievements
// collects them at the end of its next race.
import type { RaceResult } from '../../core/contracts';
import type { AchievementId } from '../../data/achievements';
import { careerEvent, cupCleared, isCupFinal, UNLOCK_PLACE, type Tier } from '../../ui/progress';
import type { RuleCtx } from './facts';

const CUPS: ReadonlyArray<[Tier, AchievementId]> = [[1, 'cup1'], [2, 'cup2'], [3, 'cup3']];

export function careerRules(ctx: RuleCtx): Array<() => void> {
  const { bus, session, app } = ctx;

  /** The cup this race clears: the player finished a cup's last career event in the top 3. */
  const clearing = (results: RaceResult[]): Tier | null => {
    const me = results.find((r) => r.isPlayer);
    const ev = careerEvent(session.config);
    return ev && isCupFinal(ev) && me && me.time !== null && me.place <= UNLOCK_PLACE ? ev.tier : null;
  };

  return [
    bus.on('race:end', ({ results }) => {
      const now = clearing(results);
      const cleared = CUPS.filter(([tier]) => tier === now || cupCleared(app.save, tier));
      for (const [, id] of cleared) ctx.unlock(id);
      if (cleared.length === CUPS.length) ctx.unlock('career');
    }),
  ];
}
