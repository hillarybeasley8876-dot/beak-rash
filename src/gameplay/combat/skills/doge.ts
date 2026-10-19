// shiba.doge — 3 s doge shield: melee bounces back at the attacker (a ripple runs over the bubble); +15 % speed.
import { Vector3 } from 'three';
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { addStatus } from '../statuses';
import { SHIELD_REFLECT } from '../tuning';
import { ShieldBubble } from '../visuals/shield';
import { skillBoost } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'shiba.doge';
export const DOGE = { dur: 3, boost: 0.15 } as const;
const DIR = new Vector3();

class Doge extends TimedSkill {
  private off: () => void;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, DOGE.dur, false);
    addStatus(r, 'shield', DOGE.dur, SHIELD_REFLECT, r.id, true);
    skillBoost(ctx, r, DOGE.dur, DOGE.boost);
    const bubble = ctx.visuals.add(new ShieldBubble(ctx.visuals, r, DOGE.dur, '#ffd23f'));
    // the blocked half of a reflect: the swing that met the shield (damage.ts reflect)
    this.off = ctx.bus.on('combat:hit', (e) => {
      if (e.victim !== r.id || !e.blocked) return;
      const a = ctx.session.rider(e.attacker);
      if (!a) return;
      const at = ctx.pos(a);
      bubble.bounce(DIR.set(at.x, at.y, at.z).sub(bubble.centre));
    });
  }

  protected tick(): void {}

  protected override cleanup(): void {
    this.off();
  }
}

export const doge: SkillImpl = { id: ID, cast: (ctx, r) => new Doge(ctx, r) };
