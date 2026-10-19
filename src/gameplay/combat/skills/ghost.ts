// pigeon.ghost — 放鸽子: 1.5 s invisible + intangible (and unable to attack), then reappears 25 m further
// ahead in a clear lane. Never moves a rider backwards, over the finish line, or after it has finished.
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { addStatus, applyMods, removeStatus } from '../statuses';
import { FlatRing } from '../visuals/waves';
import { clearLane } from './common';
import { TimedSkill, type EndReason, type SkillImpl } from './types';

const ID = 'pigeon.ghost';
export const GHOST = { dur: 1.5, jump: 25, finishGap: 5 } as const;

class Ghost extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, GHOST.dur, false);
    addStatus(r, 'invisible', GHOST.dur, 1, r.id, true);
    addStatus(r, 'intangible', GHOST.dur, 1, r.id, true);
    this.puff();
  }

  private puff(): void {
    const { ctx, caster: r } = this;
    ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#cfd6e0', from: 0.3, to: 2.2, dur: 0.35 }));
  }

  protected tick(): void {}

  protected override cleanup(reason: EndReason): void {
    const { ctx, caster: r } = this;
    removeStatus(r, 'invisible');
    removeStatus(r, 'intangible');
    applyMods(r);
    if (reason !== 'done' || r.mode !== 'racing' || r.finishTime !== null) return;
    const s = Math.max(r.s, Math.min(ctx.session.track.length - GHOST.finishGap, r.s + GHOST.jump));
    if (s <= r.s) return;
    r.x = clearLane(ctx, r, s, r.x);
    r.s = s;
    this.puff();
  }
}

export const ghost: SkillImpl = { id: ID, cast: (ctx, r) => new Ghost(ctx, r) };
