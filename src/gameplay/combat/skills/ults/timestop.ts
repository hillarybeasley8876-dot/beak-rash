// ult.timestop — 时间暂停: everybody but the caster freezes for three seconds while the caster keeps riding and
// hits them as they stand still. The freeze is a hold, not a blow: it does no damage of its own, so the officers
// are left alone (a freeze must not knock them down). There is no impact moment either, so the ult announces
// itself with ult:start only.
//
// The runner holds an ult pressed in mid-air until the rider touches down (skills/runner.ts: the press fires on
// the landing). A time stop that starts on the landing is not a time stop — the world has to stop when the button
// goes down. So the skill watches the runner's held press (ready() is called every frame) and starts the freeze
// there; the riders are then put back on the very spot they occupied when the button went down.
import type { RiderState } from '../../../../core/types';
import type { CombatCtx } from '../../ctx';
import { addStatus, applyMods, removeStatus } from '../../statuses';
import { AuraDisc } from '../../visuals/auras';
import { FlatRing } from '../../visuals/waves';
import { skillBoost } from '../common';
import { TimedSkill, type EndReason, type SkillImpl } from '../types';

const ID = 'ult.timestop';
export const TIMESTOP = {
  dur: 3,        // s everybody else stands still
  radius: 40,    // m the freeze is announced over
  boost: 0.15,   // the caster keeps going
  boostTime: 3,
} as const;

/** A frozen rider and the spot it stands on. */
interface Held { r: RiderState; s: number; x: number; vx: number }

/** The freeze of one cast: who stands still and where. */
class Freeze {
  readonly held: Held[] = [];
  /** The combat time the press was seen (0 = the freeze started with the cast itself). */
  private seen = 0;
  private settled = true;

  constructor(ctx: CombatCtx, r: RiderState, seen: number, held: boolean) {
    this.seen = seen;
    this.settled = !held;
    for (const v of ctx.session.riders) {
      if (v === r || v.mode !== 'racing') continue;
      this.held.push({ r: v, s: v.s, x: v.x, vx: v.vx });
    }
  }

  /**
   * A press that the runner held is a frame old by the time the freeze starts: the riders covered that frame
   * before the world stopped, so they give the ground back.
   */
  private correct(ctx: CombatCtx): void {
    if (this.settled) return;
    const frame = ctx.time - this.seen;
    if (frame <= 0) return;
    this.settled = true;
    for (const h of this.held) {
      h.s -= h.r.speed * frame;
      h.x -= h.r.vx * frame;
    }
  }

  /** Hold the riders where they are and keep them there. */
  apply(ctx: CombatCtx, r: RiderState): void {
    this.correct(ctx);
    for (const h of this.held) {
      if (h.r.mode !== 'racing') continue;
      addStatus(h.r, 'halted', TIMESTOP.dur, 1, r.id, true);
      applyMods(h.r);
      h.r.s = h.s;
      h.r.x = h.x;
      h.r.vx = h.vx;
    }
  }

  /** The freeze is over: the riders get their legs back. */
  release(): void {
    for (const h of this.held) {
      removeStatus(h.r, 'halted');
      applyMods(h.r);
    }
    this.held.length = 0;
  }
}

/** A freeze waiting for its cast (the runner is still holding the press). */
const waiting = new WeakMap<CombatCtx, Freeze>();

/** The runner calls ready() every frame: that is where a held press shows up. */
function watch(ctx: CombatCtx, r: RiderState): void {
  const held = ctx.rd(r).skillBuf.some((b) => b.slot === 4);
  const freeze = waiting.get(ctx);
  if (freeze) {
    if (!held) {           // the press was dropped: the freeze goes with it
      freeze.release();
      waiting.delete(ctx);
      return;
    }
    freeze.apply(ctx, r);
    return;
  }
  if (!held) return;
  const fresh = new Freeze(ctx, r, ctx.time, true);
  waiting.set(ctx, fresh);
  fresh.apply(ctx, r);
}

class TimeStop extends TimedSkill {
  private freeze: Freeze;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, TIMESTOP.dur, true, 'ult');
    this.freeze = waiting.get(ctx) ?? new Freeze(ctx, r, ctx.time, false);
    waiting.delete(ctx);
    this.freeze.apply(ctx, r);
    skillBoost(ctx, r, TIMESTOP.boostTime, TIMESTOP.boost);
    ctx.visuals.add(new AuraDisc(ctx.visuals, r, TIMESTOP.radius, TIMESTOP.dur, '#9fe8ff', '#3fb8ff'));
    ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#bff0ff', from: 1, to: TIMESTOP.radius, dur: 0.9 }));
    ctx.bus.emit('ult:start', { riderId: r.id, skillId: ID });
  }

  protected tick(): void {
    this.freeze.apply(this.ctx, this.caster);
  }

  protected override cleanup(reason: EndReason): void {
    void reason;
    this.freeze.release();
  }
}

export const timestop: SkillImpl = {
  id: ID,
  ready: (ctx, r) => {
    watch(ctx, r);
    return true;
  },
  cast: (ctx, r) => new TimeStop(ctx, r),
};
