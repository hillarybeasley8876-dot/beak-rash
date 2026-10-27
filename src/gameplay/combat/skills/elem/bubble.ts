// pool.bubble — 泡泡护盾: a bubble around the caster stops the next punch (2.5 s); when it bursts it soaks
// everyone close by (water). The bubble is a shield, so only fists stop on it (SPEC §7).
import type { RiderState } from '../../../../core/types';
import type { CombatCtx } from '../../ctx';
import { addStatus, applyMods, removeStatus } from '../../statuses';
import { SHIELD_IMMUNE } from '../../tuning';
import { ShieldBubble } from '../../visuals/shield';
import { FlatRing } from '../../visuals/waves';
import { TimedSkill, type EndReason, type SkillImpl } from '../types';
import { elemHit } from './common';

const ID = 'pool.bubble';
export const BUBBLE = { dur: 2.5, splashRadius: 4, splashDamage: 8 } as const;

class Bubble extends TimedSkill {
  private off: () => void;
  private popped = false;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, BUBBLE.dur, false);
    addStatus(r, 'shield', BUBBLE.dur, SHIELD_IMMUNE, r.id, true);
    ctx.visuals.add(new ShieldBubble(ctx.visuals, r, BUBBLE.dur, '#9fe4ff'));
    // the punch that stopped on the bubble bursts it
    this.off = ctx.bus.on('combat:hit', (e) => {
      if (e.victim !== r.id || !e.blocked || this.popped) return;
      this.pop(ctx, r);
    });
  }

  /** The bubble bursts: the shield goes and the water splashes over the riders around. */
  private pop(ctx: CombatCtx, r: RiderState): void {
    this.popped = true;
    removeStatus(r, 'shield');
    applyMods(r);
    for (const o of ctx.session.riders) {
      if (o === r) continue;
      if (Math.hypot(o.s - r.s, o.x - r.x) > BUBBLE.splashRadius) continue;
      elemHit(ctx, r, o, ID, 'water', { damage: BUBBLE.splashDamage, speedLoss: 0.05 });
      ctx.session.app.fx.burst('splash', ctx.pos(o), { color: '#b6ecff' });
    }
    ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#b6ecff', from: 0.3, to: BUBBLE.splashRadius, dur: 0.4 }));
    ctx.session.app.fx.burst('splash', ctx.world(r.s, r.x, 1.1), { color: '#b6ecff' });
  }

  protected tick(): void {}

  protected override cleanup(reason: EndReason): void {
    this.off();
    if (reason !== 'done') return;
    const r = this.caster;
    removeStatus(r, 'shield');
    applyMods(r);
  }
}

export const bubble: SkillImpl = { id: ID, cast: (ctx, r) => new Bubble(ctx, r) };
