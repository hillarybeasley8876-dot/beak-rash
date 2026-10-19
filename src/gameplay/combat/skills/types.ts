// Skill plumbing: the implementation interface, a timed base class, and shared helpers for skill files.
import type { RiderState, Side } from '../../../core/types';
import type { CombatCtx } from '../ctx';

/** finish = the caster crossed the line: movement and visuals wind down, nothing scores any more. */
export type EndReason = 'done' | 'crash' | 'finish' | 'dispose';

export interface ActiveSkill {
  readonly id: string;
  readonly caster: RiderState;
  /** Blocks melee and other skills while true (may change as the skill runs, e.g. Big Gulp's pouch). */
  readonly exclusive: boolean;
  /** Seconds until `exclusive` turns false at the latest (0 when not exclusive); presses queue behind a short lock. */
  lockLeft(): number;
  /** Before physics (e.g. holding a gulped rider in the pouch). */
  pre(dt: number): void;
  /** After physics; return false when finished. */
  post(dt: number): boolean;
  /** True while the caster swallows incoming waves and projectiles (Big Gulp's open pouch). */
  swallows?(): boolean;
  /** Always called exactly once (done, caster crashed or finished the race, or session disposed). */
  end(reason: EndReason): void;
}

export interface SkillImpl {
  readonly id: string;
  /** Extra precondition beyond cooldown / SP / state, e.g. a target in range. */
  ready?(ctx: CombatCtx, r: RiderState): boolean;
  /** Line the caster shouts when ready() refuses the cast (e.g. SHOWTIME's 无目标！). */
  readonly noTarget?: string;
  cast(ctx: CombatCtx, r: RiderState): ActiveSkill;
}

/**
 * Skill that runs for `duration` sim seconds; the caster plays its 'skill' action for `actionDur`. A `lockout`
 * skill is exclusive (and holds its action) for the whole duration; others only strike a 0.35 s cast pose.
 */
export abstract class TimedSkill implements ActiveSkill {
  protected t = 0;
  private actionDur: number;

  constructor(
    protected ctx: CombatCtx, readonly caster: RiderState, readonly id: string, protected duration: number,
    private readonly lockout: boolean, kind: 'skill' | 'ult' = 'skill',
  ) {
    this.actionDur = lockout ? duration : Math.min(duration, 0.35);
    caster.action = { kind, side: 1, t: 0, dur: this.actionDur, weapon: caster.weapon, skillId: id, resolved: true };
  }

  get exclusive(): boolean {
    return this.lockout;
  }

  lockLeft(): number {
    return this.lockout ? Math.max(0, this.duration - this.t) : 0;
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
