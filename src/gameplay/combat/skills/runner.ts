// Skill runner: loadouts, cast checks (cooldown / SP / state → skill:denied), running skills, crash
// interrupts and disposal. Slots: 1–3 = U/I/O (rivals fire their 'sig' skill from slot 1), 4 = ult (P).
import { PLAYER_SKILLS, PLAYER_ULT, SKILLS } from '../../../data/skills';
import { ROSTER } from '../../../data/roster';
import type { Controls, RiderState } from '../../../core/types';
import { active, finished, type CombatCtx } from '../ctx';
import { applyMods } from '../statuses';
import { PRESS_HOLD } from '../tuning';
import { SKILL_IMPLS } from './registry';
import type { ActiveSkill, EndReason } from './types';

export const ULT_SLOT = 4;
type DenyReason = 'cooldown' | 'sp' | 'state';
/** Why a cast can't happen now; 'busy' (mid-swing / hit stagger) is buffered briefly (one press per slot) instead. */
type Block = DenyReason | 'busy';

export class SkillRunner {
  private running: ActiveSkill[] = [];
  private queued: Array<{ r: RiderState; slot: number }> = [];

  constructor(private ctx: CombatCtx) {}

  /** Skill id in a slot for this rider (null = empty). */
  skillIn(r: RiderState, slot: number): string | null {
    if (r.character === 'pelican') return slot === ULT_SLOT ? PLAYER_ULT : PLAYER_SKILLS[slot - 1] ?? null;
    return slot === 1 ? ROSTER[r.character].skill : null;
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

  /** Does `r` have a skill running that eats incoming waves / projectiles right now? */
  swallowing(r: RiderState): boolean {
    return this.running.some((a) => a.caster === r && a.swallows?.() === true);
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
      b.age += dt;
      if (b.age <= PRESS_HOLD && this.check(r, b.slot, this.skillIn(r, b.slot)) === 'busy') continue;
      buf.splice(buf.indexOf(b), 1);
      this.tryCast(r, b.slot, false); // casts now, or the final skill:denied
    }
  }

  tryCast(r: RiderState, slot: number, buffer = true): boolean {
    const id = this.skillIn(r, slot);
    const block = this.check(r, slot, id);
    const buf = this.ctx.rd(r).skillBuf;
    if (block === 'busy' && buffer) {
      const held = buf.find((b) => b.slot === slot);
      if (held) held.age = 0;
      else buf.push({ slot, age: 0 });
      return false;
    }
    if (block || !id) {
      this.ctx.bus.emit('skill:denied', { riderId: r.id, slot, reason: !block || block === 'busy' ? 'state' : block });
      return false;
    }
    const def = SKILLS[id];
    const impl = SKILL_IMPLS[id];
    if (!def || !impl) return false;
    if (slot !== ULT_SLOT) r.cooldowns[slot - 1] = def.cooldown;
    r.sp = Math.max(0, r.sp - def.spCost);
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

  private check(r: RiderState, slot: number, id: string | null): Block | null {
    if (!id || !SKILLS[id] || !SKILL_IMPLS[id]) return 'state';
    if (!active(r) || !r.mods.canAttack || this.busy(r) || (r.airborne && slot === ULT_SLOT)) return 'state';
    if (slot !== ULT_SLOT && (r.cooldowns[slot - 1] ?? 0) > 0) return 'cooldown';
    if (r.sp < (SKILLS[id]?.spCost ?? 0)) return 'sp';
    const impl = SKILL_IMPLS[id];
    if (impl?.ready && !impl.ready(this.ctx, r)) return 'state';
    const a = r.action;
    if (a && (a.kind === 'hit' || ((a.kind === 'attack' || a.kind === 'heavy') && !a.resolved))) return 'busy';
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
  }
}
