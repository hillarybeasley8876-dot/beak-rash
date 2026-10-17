// Skill plumbing: the implementation interface, a timed base class, and shared helpers for skill files.
import type { RiderState, Side } from '../../../core/types';
import type { CombatCtx } from '../ctx';

export type EndReason = 'done' | 'crash' | 'dispose';

export interface ActiveSkill {
  readonly id: string;
  readonly caster: RiderState;
  /** Blocks melee and other skills while running. */
  readonly exclusive: boolean;
  /** Before physics (e.g. holding a gulped rider in the pouch). */
  pre(dt: number): void;
  /** After physics; return false when finished. */
  post(dt: number): boolean;
  /** Always called exactly once (finished, caster crashed, or session disposed). */
  end(reason: EndReason): void;
}

export interface SkillImpl {
  readonly id: string;
  /** Extra precondition beyond cooldown / SP / state, e.g. a target in range. */
  ready?(ctx: CombatCtx, r: RiderState): boolean;
  cast(ctx: CombatCtx, r: RiderState): ActiveSkill;
}

/** Skill that runs for `duration` sim seconds; the caster plays its 'skill' action for `actionDur`. */
export abstract class TimedSkill implements ActiveSkill {
  protected t = 0;
  private actionDur: number;

  constructor(
    protected ctx: CombatCtx, readonly caster: RiderState, readonly id: string, protected duration: number,
    readonly exclusive: boolean, kind: 'skill' | 'ult' = 'skill',
  ) {
    this.actionDur = exclusive ? duration : Math.min(duration, 0.35);
    caster.action = { kind, side: 1, t: 0, dur: this.actionDur, weapon: caster.weapon, skillId: id, resolved: true };
  }

  pre(dt: number): void {
    void dt;
  }

  post(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.actionDur) this.releaseAction();
    this.tick(dt);
    return this.t < this.duration;
  }

  protected abstract tick(dt: number): void;

  end(reason: EndReason): void {
    this.releaseAction();
    this.cleanup(reason);
  }

  protected cleanup(reason: EndReason): void {
    void reason;
  }

  private releaseAction(): void {
    if (this.caster.action?.skillId === this.id) this.caster.action = null;
  }
}

/** Side of `v` relative to `a` (for combat:hit.side on skill hits). */
export const sideOf = (a: RiderState, v: RiderState): Side => (v.x >= a.x ? 1 : -1);

/** Angle (rad) of the offset (ds, dx) from straight ahead along the track. */
export const aheadAngle = (ds: number, dx: number): number => Math.atan2(Math.abs(dx), ds);
