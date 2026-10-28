// Skill runner: loadouts, cast checks (cooldown / SP / state → skill:denied), press buffering (behind a swing,
// a hit stagger, the end of another skill, or the player's KO cinematic for SHOWTIME), running skills, crash
// interrupts and disposal. Slots: 1–3 = U/I/O, 4 = ult (P), read from RiderState.loadout (r6 SPEC §24: core fills
// it at spawn; rivals carry their signature skill in slot 1 and a pool skill in slot 2). Silenced riders cast nothing.
import { SKILLS } from '../../../data/skills';
import type { Controls, RiderState } from '../../../core/types';
import { active, finished, type CombatCtx } from '../ctx';
import { applyMods } from '../statuses';
import { PRESS_HOLD, SKILL_QUEUE, ULT_KO_LATCH } from '../tuning';
import { SKILL_IMPLS } from './registry';
import type { ActiveSkill, EndReason } from './types';

export const ULT_SLOT = 4;
type DenyReason = 'cooldown' | 'sp' | 'state';
/**
 * Why a cast can't happen now. 'busy' (mid-swing, hit stagger, another skill's lock about to end) is buffered
 * briefly (one press per slot); 'held' (SHOWTIME during the player's KO cinematic) waits for the cinematic;
 * 'target' (ready() refused) is denied as 'state' with the skill's no-target line.
 */
type Block = DenyReason | 'busy' | 'held' | 'target';
/** Seconds between two no-target lines from one rider. */
const LINE_GAP = 1.5;

export class SkillRunner {
  private running: ActiveSkill[] = [];
  private queued: Array<{ r: RiderState; slot: number }> = [];
  private lineAt = new Map<number, number>();
  /** Real time the player's running KO cinematic started (null = none). */
  private koCineAt: number | null = null;
  private offs: Array<() => void>;

  constructor(private ctx: CombatCtx) {
    this.offs = [ctx.bus.on('cine:ko', (e) => {
      if (e.phase === 'start') this.koCineAt = this.realTime;
      else if (e.phase === 'end') this.koCineAt = null;
    })];
  }

  private get realTime(): number {
    return this.ctx.session.app.clock.realTime;
  }

  /** A KO cinematic is on screen (SHOWTIME presses wait for it instead of cutting the money shot). */
  private get koCine(): boolean {
    // Online (SPEC §28) the cinematics are presentation: a cast must never wait for a real-time clock, or
    // the clients would cast at different ticks.
    if (this.ctx.session.config.online) return false;
    return this.koCineAt !== null && this.realTime - this.koCineAt < ULT_KO_LATCH;
  }

  /** Skill id in a slot for this rider (null = empty). */
  skillIn(r: RiderState, slot: number): string | null {
    if (slot === ULT_SLOT) return r.loadout.ult;
    return r.loadout.slots[slot - 1] ?? null;
  }

  /** Debug / tests: cast on the next preStep regardless of the rider's controller. */
  queue(r: RiderState, slot: number): void {
    this.queued.push({ r, slot });
  }

  /** Controller presses (slots 1–3, ult), after retrying a skill buffered behind a swing or stagger. */
  request(r: RiderState, c: Controls, dt: number): void {
    this.retry(r, dt);
    if (c.skill1) this.tryCast(r, 1);
    if (c.skill2) this.tryCast(r, 2);
    if (c.skill3) this.tryCast(r, 3);
    if (c.ult) this.tryCast(r, ULT_SLOT);
  }

  busy(r: RiderState): boolean {
    return this.running.some((a) => a.caster === r && a.exclusive);
  }

  /** Seconds until none of `r`'s running skills is exclusive any more. */
  private lockLeft(r: RiderState): number {
    let left = 0;
    for (const a of this.running) if (a.caster === r && a.exclusive) left = Math.max(left, a.lockLeft());
    return left;
  }

  /** Does `r` have a skill running that eats incoming waves / projectiles right now? */
  swallowing(r: RiderState): boolean {
    return this.running.some((a) => a.caster === r && a.swallows?.() === true);
  }

  /**
   * RiderState.ultTarget for every rider (the HUD greys SHOWTIME with it): would the rider's ult find victims if
   * cast now, i.e. its own ready() check (SHOWTIME: ult-aim.ts planUlt, no allocations). false without an ult.
   */
  updateUltTargets(): void {
    for (const r of this.ctx.session.riders) {
      const id = this.skillIn(r, ULT_SLOT);
      const impl = id ? SKILL_IMPLS[id] : undefined;
      r.ultTarget = impl !== undefined && (impl.ready?.(this.ctx, r) ?? true);
    }
  }

  find(r: RiderState, id: string): ActiveSkill | undefined {
    return this.running.find((a) => a.caster === r && a.id === id);
  }

  get count(): number {
    return this.running.length;
  }

  list(): Array<{ caster: number; id: string }> {
    return this.running.map((a) => ({ caster: a.caster.id, id: a.id }));
  }

  /** Buffered presses, oldest first: each casts once nothing blocks it, or is denied when its hold runs out. */
  private retry(r: RiderState, dt: number): void {
    const buf = this.ctx.rd(r).skillBuf;
    for (const b of buf.slice()) {
      const block = this.check(r, b.slot, this.skillIn(r, b.slot));
      if (block === 'held') continue; // waits for the KO cinematic to end, however long it runs
      b.age += dt;
      if (block === 'busy' && b.age <= b.hold) continue;
      buf.splice(buf.indexOf(b), 1);
      this.tryCast(r, b.slot, false); // casts now, or the final skill:denied
    }
  }

  tryCast(r: RiderState, slot: number, buffer = true): boolean {
    const id = this.skillIn(r, slot);
    const block = this.check(r, slot, id);
    const buf = this.ctx.rd(r).skillBuf;
    if ((block === 'busy' || block === 'held') && buffer) {
      const hold = this.busy(r) || (slot === ULT_SLOT && r.airborne) ? SKILL_QUEUE : PRESS_HOLD;
      const held = buf.find((b) => b.slot === slot);
      if (held) Object.assign(held, { age: 0, hold: Math.max(held.hold, hold) });
      else buf.push({ slot, age: 0, hold });
      return false;
    }
    if (block || !id) {
      if (block === 'target') this.sayNoTarget(r, id);
      const reason = block === 'cooldown' || block === 'sp' ? block : 'state';
      this.ctx.bus.emit('skill:denied', { riderId: r.id, slot, reason });
      return false;
    }
    const def = SKILLS[id];
    const impl = SKILL_IMPLS[id];
    if (!def || !impl) return false;
    if (slot !== ULT_SLOT) r.cooldowns[slot - 1] = def.cooldown;
    r.sp = Math.max(0, r.sp - def.spCost);
    if (def.spCost > 0) this.ctx.rd(r).spSpentAt = this.ctx.time; // fighting refills nothing for a while (sp.ts)
    r.invuln = 0; // casting gives up respawn protection
    if (r.action && r.action.kind !== 'skill' && r.action.kind !== 'ult') r.action = null;
    this.ctx.rd(r).buffered = null;
    const i = buf.findIndex((b) => b.slot === slot);
    if (i >= 0) buf.splice(i, 1);
    if (slot !== ULT_SLOT) {
      this.ctx.bus.emit('skill:cast', { riderId: r.id, skillId: id, slot });
      this.ctx.view(r)?.cue('skill', { skillId: id });
    }
    this.running.push(impl.cast(this.ctx, r));
    applyMods(r);
    return true;
  }

  /** The skill's no-target line (e.g. SHOWTIME's 无目标！), at most once per LINE_GAP s per rider. */
  private sayNoTarget(r: RiderState, id: string | null): void {
    const text = id ? SKILL_IMPLS[id]?.noTarget : undefined;
    if (!text || this.ctx.time - (this.lineAt.get(r.id) ?? -Infinity) < LINE_GAP) return;
    this.lineAt.set(r.id, this.ctx.time);
    this.ctx.bus.emit('taunt', { riderId: r.id, text, character: r.character });
  }

  private check(r: RiderState, slot: number, id: string | null): Block | null {
    if (!id || !SKILLS[id] || !SKILL_IMPLS[id]) return 'state';
    if (!active(r) || !r.mods.canAttack || r.mods.silenced) return 'state';
    if (slot !== ULT_SLOT && (r.cooldowns[slot - 1] ?? 0) > 0) return 'cooldown';
    if (r.sp < (SKILLS[id]?.spCost ?? 0)) return 'sp';
    if (this.busy(r)) return this.lockLeft(r) <= SKILL_QUEUE ? 'busy' : 'state';
    if (slot === ULT_SLOT && r.airborne) return 'busy'; // a hop / crest press fires on landing (SKILL_QUEUE hold)
    if (slot === ULT_SLOT && r.human && this.koCine) return 'held';
    const impl = SKILL_IMPLS[id];
    if (impl?.ready && !impl.ready(this.ctx, r)) return 'target';
    const a = r.action;
    if (a && (a.kind === 'hit' || a.kind === 'throw' || ((a.kind === 'attack' || a.kind === 'heavy') && !a.resolved))) return 'busy';
    return null;
  }

  pre(dt: number): void {
    for (const q of this.queued.splice(0)) this.tryCast(q.r, q.slot);
    for (const a of this.running) a.pre(dt);
  }

  post(dt: number): void {
    for (const a of this.running.slice()) {
      if (!this.running.includes(a)) continue;
      if (finished(a.caster)) this.finish(a, 'finish'); // past the line: no more hits, catches or debuffs
      else if (!a.post(dt)) this.finish(a, 'done');
    }
  }

  /** The caster crashed / was knocked out: stop everything it was doing. */
  interrupt(r: RiderState): void {
    for (const a of this.running.slice()) if (a.caster === r) this.finish(a, 'crash');
  }

  private finish(a: ActiveSkill, reason: EndReason): void {
    const i = this.running.indexOf(a);
    if (i < 0) return;
    this.running.splice(i, 1);
    a.end(reason);
    this.ctx.bus.emit('skill:end', { riderId: a.caster.id, skillId: a.id });
  }

  dispose(): void {
    for (const a of this.running.slice()) this.finish(a, 'dispose');
    this.queued.length = 0;
    for (const off of this.offs.splice(0)) off();
  }
}
