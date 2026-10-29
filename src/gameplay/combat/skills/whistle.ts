// corgi.whistle — 哔——! The whole cone ahead (20 m, ±35°) hears it and flinches: slowed 25 % for 1.2 s, the bike
// rocking under them (r7 SPEC §29: in an ordinary race nobody is an offender, so the warning needs a baseline of its
// own — and a slow, so the HUD has a word for it: a rock alone has none).
// The offenders among them (heat, or a hit landed in the last 6 s) are fined as well: slowed 50 % for 2 s with a
// stop shake, and the corgi reads out how many it warned / fined.
import { DEG } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { nudge } from '../feedback';
import { ConeWave } from '../visuals/waves';
import { inCone, skillAffect } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'corgi.whistle';
export const WHISTLE = {
  range: 20, cone: 35 * DEG, warn: 1.2, warnSlow: 0.25,  // everyone in the cone: slowed, the bike rocks
  fine: 0.5, fineTime: 2, shake: 0.45, nudge: 0.3, recent: 6, // offenders: the fine, twice as long and harder
} as const;

class Whistle extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, 0.8, false);
    ctx.visuals.add(new ConeWave(ctx.visuals, r, { color: '#5aa9ff', count: 4, interval: 0.08, speed: 34, range: WHISTLE.range, halfAngle: WHISTLE.cone, height: 1.4 }));
    let warned = 0, fined = 0;
    for (const v of inCone(ctx, r, WHISTLE.range, WHISTLE.cone)) {
      const offender = offenderOf(ctx, v);
      const hit = offender
        ? skillAffect(ctx, r, v, ID, [['slow', WHISTLE.fineTime, WHISTLE.fine], ['wobble', WHISTLE.shake, 1]])
        : skillAffect(ctx, r, v, ID, [['slow', WHISTLE.warn, WHISTLE.warnSlow], ['wobble', WHISTLE.warn, 1]]);
      if (!hit) continue;
      if (!offender) { warned++; continue; }
      fined++;
      ctx.view(v)?.cue('stun');    // the bike rocks under the fine
      nudge(ctx, v, WHISTLE.nudge);
    }
    const text = fined > 0 ? `罚单 ×${fined}` : `警告 ×${warned}`;
    ctx.bus.emit('skill:result', { riderId: r.id, skillId: ID, text, good: warned + fined > 0 });
  }

  protected tick(): void {}
}

/** Wanted, or caught fighting in the last `recent` seconds. */
const offenderOf = (ctx: CombatCtx, v: RiderState): boolean => v.heat > 0.05 || ctx.now() - ctx.rd(v).lastAttack < WHISTLE.recent;

export const whistle: SkillImpl = { id: ID, cast: (ctx, r) => new Whistle(ctx, r) };
