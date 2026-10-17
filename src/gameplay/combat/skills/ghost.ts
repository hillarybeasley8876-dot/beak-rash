// pigeon.ghost — 放鸽子: 1.5 s invisible + intangible (and unable to attack), then reappears 25 m further
// ahead in a clear lane. Never moves a rider backwards, over the finish line, or after it has finished.
import type { RiderState } from '../../../core/types';
import { clampToRoad, type CombatCtx } from '../ctx';
import { addStatus, applyMods, removeStatus } from '../statuses';
import { FlatRing } from '../visuals/waves';
import { TimedSkill, type EndReason, type SkillImpl } from './types';

const ID = 'pigeon.ghost';
export const GHOST = { dur: 1.5, jump: 25, finishGap: 5, lanes: [0, 1.6, -1.6, 3.2, -3.2] } as const;
/** Clearance kept from traffic / obstacles and other riders at the reappearing spot. */
const CLEAR = { obstacleDs: 4, obstacleDx: 0.9, riderDs: 2.2, riderDx: 1 } as const;

/** First lateral offset near `x` at `s` with no solid obstacle or rider on it (falls back to x). */
function clearLane(ctx: CombatCtx, self: RiderState, s: number, x: number): number {
  const { obstacles, riders } = ctx.session;
  for (const dx of GHOST.lanes) {
    const cx = clampToRoad(ctx, s, x + dx, 1);
    const blocked = obstacles.some((o) => o.active && o.solid && Math.abs(o.s - s) < o.halfLength + CLEAR.obstacleDs &&
      Math.abs(o.x - cx) < o.halfWidth + CLEAR.obstacleDx) ||
      riders.some((o) => o !== self && o.mode !== 'crashed' && Math.abs(o.s - s) < CLEAR.riderDs && Math.abs(o.x - cx) < CLEAR.riderDx);
    if (!blocked) return cx;
  }
  return clampToRoad(ctx, s, x, 1);
}

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
