// xinxian.fresh — 五秒真香: for five seconds every pickup within reach is sucked in and eaten — and what the cat
// pulls in is its own (r7 SPEC §29): the suction is a hard yank that lands the food in the cat's mouth, because a
// pickup drifting slowly through the pack was picked up by whoever rode past it and the audit read that as "the
// skill collected nothing". Every bite makes it faster (up to two fifths more speed) and the five seconds open
// with a boost of their own, so the window is worth casting on a road with no food on it at all. A cat busy eating
// barges on through the rider in front instead of losing its speed to the bump (the contact rule wing.ts uses; see
// its note on the missing RiderMods.pushImmune). The five seconds are the point: the fresh one eats whatever is
// freshest.
import { clamp01 } from '../../../../core/math';
import type { RiderState } from '../../../../core/types';
import { BIKES } from '../../../../data/bikes';
import type { CombatCtx } from '../../ctx';
import { VacuumSpiral } from '../../visuals/bolts';
import { skillBoost } from '../common';
import { TimedSkill, type EndReason, type SkillImpl } from '../types';

const ID = 'xinxian.fresh';
export const FRESH = {
  dur: 5,         // s the fresh window lasts
  radius: 12,     // m of pickups that get sucked in
  spiral: 7,      // m the suction streak reaches
  pull: 24,       // 1/s the suction closes the gap (a yank, not a drift: the pack gets no look in)
  mouth: 2.2,     // m from the cat a pulled pickup is swallowed
  base: 0.15,     // the boost the five seconds open with, food or no food
  baseTime: 2,
  boost: 0.08,    // speed per bite
  boostTime: 3,
  maxBoost: 0.4,  // the cap (never more than +40 %)
} as const;

/** Sim's rider contact box (|ds| < 1.7, |dx| < 0.75) plus one substep of closing distance (wing.ts). */
const CONTACT = { ds: 1.85, dx: 0.85, dy: 1 } as const;

/** Would sim resolve a rear-end contact between `r` and `o` this substep? */
function rearEnding(r: RiderState, o: RiderState): boolean {
  const solid = (o.mode === 'racing' || o.mode === 'finished') && !o.mods.intangible && o.invuln <= 0 &&
    !o.statuses.some((st) => st.id === 'gulped' && st.time > 0);
  const ds = o.s - r.s;
  return solid && ds > 0 && ds < CONTACT.ds && Math.abs(o.x - r.x) < CONTACT.dx && Math.abs(o.y - r.y) < CONTACT.dy;
}

class Fresh extends TimedSkill {
  private eaten = 0;
  private preSpeed = 0;
  private contact = false;
  private off: () => void;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, FRESH.dur, false);
    ctx.visuals.add(new VacuumSpiral(ctx.visuals, r, FRESH.dur, FRESH.spiral));
    skillBoost(ctx, r, FRESH.baseTime, FRESH.base);
    this.off = ctx.bus.on('pickup:take', (e) => {
      if (e.riderId !== r.id) return;
      this.eaten++;
      skillBoost(ctx, r, FRESH.boostTime, Math.min(FRESH.maxBoost, this.eaten * FRESH.boost));
    });
  }

  /** The cat eats its way through the pack: a rear-end bump costs it nothing while the window is open. */
  override pre(): void {
    const r = this.caster;
    this.preSpeed = r.speed;
    this.contact = this.ctx.session.riders.some((o) => o !== r && rearEnding(r, o));
  }

  protected tick(dt: number): void {
    const r = this.caster;
    if (this.contact) {
      const brake = clamp01(this.ctx.session.controls.get(r.id)?.brake ?? 0);
      r.speed = Math.max(r.speed, this.preSpeed - BIKES[r.bike].brake * brake * dt); // its own brakes still bite
    }
    this.suck(dt);
  }

  /** Yank every pickup the cat can take within reach into its mouth, and swallow it there. */
  private suck(dt: number): void {
    const r = this.caster, p = this.ctx.pickups, k = 1 - Math.exp(-FRESH.pull * dt);
    for (let i = p.items.length - 1; i >= 0; i--) {
      const it = p.items[i];
      if (!it || it.vel || !p.accepts(r, it)) continue;
      const ds = it.s - r.s, dx = it.x - r.x;
      const d = Math.hypot(ds, dx);
      if (d > FRESH.radius && it.vacuumBy !== r.id) continue;
      it.vacuumBy = r.id;
      if (d <= FRESH.mouth) {
        p.take(r, it);   // a drop is spliced out at i: walking backwards stays correct
        continue;
      }
      it.s -= ds * k;
      it.x -= dx * k;
      it.s += r.speed * dt;   // the food keeps up with the cat on its way in
    }
  }

  protected override cleanup(reason: EndReason): void {
    this.off();
    if (reason !== 'dispose') announce(this.ctx, this.caster, this.eaten);
    this.ctx.pickups.releaseVacuum(this.caster);
  }
}

/** The window is over: what the cat got out of it. */
function announce(ctx: CombatCtx, r: RiderState, eaten: number): void {
  ctx.bus.emit('skill:result', {
    riderId: r.id, skillId: ID, text: eaten > 0 ? `吸到 ${eaten} 个` : '一口都没吃到', good: eaten > 0,
  });
}

export const fresh: SkillImpl = { id: ID, cast: (ctx, r) => new Fresh(ctx, r) };
