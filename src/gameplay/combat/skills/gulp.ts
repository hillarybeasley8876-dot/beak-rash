// pelican.gulp — the pouch opens for 1.2 s: swallows waves and projectiles, vacuums pickups ≤ 4 m. The first rival in
// reach of the beak (ahead of or alongside the pelican) is caught: small ones (scale ≤ 0.85) are gulped
// (hidden 0.8 s, carried just behind the beak) then spat 15 m back — the 25 dmg lands at the spit, on screen;
// bigger ones get bitten (12 dmg + weapon knocked loose).
import { ROSTER } from '../../../data/roster';
import { lerp } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import { takeWeapon } from '../armory';
import { clampToRoad, others, targetable, type CombatCtx } from '../ctx';
import { credit } from '../damage';
import { addStatus, applyMods, removeStatus } from '../statuses';
import { VacuumSpiral } from '../visuals/bolts';
import { FlatRing } from '../visuals/waves';
import { skillHit } from './common';
import { swallowed } from './swallow';
import { TimedSkill, type EndReason, type SkillImpl } from './types';

const ID = 'pelican.gulp';
export const GULP = {
  open: 1.2, catchRadius: 2.5, reachBack: -0.5, reachAhead: 3, reachDx: 1.6, vacuum: 4, smallScale: 0.85,
  hold: 0.8, carryBack: 0.4, flight: 0.45, spitBack: 15, spitSide: 2.2, spitY: 1.5, arc: 3.2,
  spitDamage: 25, landStun: 0.5, biteDamage: 12,
} as const;

/** Nearest targetable rider in reach of the beak: ahead of or alongside the pelican, never well behind. */
export function inBeakReach(ctx: CombatCtx, r: RiderState): RiderState | undefined {
  return others(ctx, r, (o, ds, dx) => targetable(ctx, o) && ds >= GULP.reachBack && ds <= GULP.reachAhead &&
    Math.abs(dx) < GULP.reachDx && Math.abs(o.y - r.y) < 2)[0];
}

class Gulp extends TimedSkill {
  private victim: RiderState | null = null;
  private phase: 'held' | 'flight' = 'held';
  private pt = 0;
  private caught = false;
  private closed = false;
  private from = { s: 0, x: 0 };
  private to = { s: 0, x: 0 };

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, GULP.open, true);
    ctx.visuals.add(new VacuumSpiral(ctx.visuals, r, GULP.open, GULP.vacuum));
  }

  /** The open pouch eats HONK / WHISTLE waves and projectiles (skills/swallow.ts). */
  swallows(): boolean {
    return this.t < GULP.open;
  }

  /** Busy while the pouch is open or holds a rival; the spit flight and landing run as a free tail. */
  override get exclusive(): boolean {
    return this.t < GULP.open || (this.victim !== null && this.phase === 'held');
  }

  override pre(): void {
    const v = this.victim;
    if (v && this.phase === 'held' && this.still(v)) this.carry(v);
  }

  override post(dt: number): boolean {
    const open = super.post(dt);
    return open || this.victim !== null;
  }

  protected tick(dt: number): void {
    const { ctx, caster: r } = this;
    if (this.t <= GULP.open) {
      if (ctx.projectiles.swallow(r, GULP.catchRadius) > 0) swallowed(ctx, r, 'scales');
      ctx.pickups.vacuum(r, GULP.vacuum, dt);
      if (!this.caught) this.tryCatch();
    } else this.closePouch();
    const v = this.victim;
    if (v && this.still(v)) this.advance(v, dt);
  }

  /** The pouch shut: pickups still in the stream go back to their rows. */
  private closePouch(): void {
    if (this.closed) return;
    this.closed = true;
    this.ctx.pickups.releaseVacuum(this.caster);
  }

  /** False (and the victim is let go) once something else, e.g. a crash, took the victim over. */
  private still(v: RiderState): boolean {
    if (v.mode === 'racing') return true;
    this.victim = null;
    return false;
  }

  private tryCatch(): void {
    const { ctx, caster: r } = this;
    const v = inBeakReach(ctx, r);
    if (!v) return;
    this.caught = true;
    if (ROSTER[v.character].scale > GULP.smallScale) {
      skillHit(ctx, r, v, ID, { damage: GULP.biteDamage, knock: 3, speedLoss: 0.08 });
      takeWeapon(ctx, r, v);
      return;
    }
    addStatus(v, 'gulped', GULP.hold + 0.2, 1, r.id, true);
    ctx.skills.interrupt(v);
    v.action = null;
    ctx.rd(v).buffered = null;
    credit(ctx, v, r, ID, 'none');
    applyMods(v);
    this.victim = v;
    this.phase = 'held';
    this.pt = 0;
    this.carry(v);
    ctx.session.app.fx.burst('feathers', ctx.pos(r, 1.4), { count: 16 });
  }

  /**
   * Hidden in the pouch: carried just behind the beak (never ahead of the pelican, never over the line) and
   * grounded, so sim drops any air episode of its own and adopts the spit flight as an external one.
   */
  private carry(v: RiderState): void {
    const r = this.caster;
    v.s = Math.min(r.s - GULP.carryBack, this.ctx.session.track.length - 1);
    v.x = r.x;
    v.y = v.vy = v.vx = 0;
    v.airborne = false;
    v.speed = r.speed;
  }

  private advance(v: RiderState, dt: number): void {
    this.pt += dt;
    if (this.phase === 'held') {
      this.carry(v);
      if (this.pt >= GULP.hold) this.spit(v);
      return;
    }
    const u = Math.min(1, this.pt / GULP.flight);
    this.fly(v, u);
    if (u >= 1) this.land(v);
  }

  /** PTOOEY: out of the pouch with the damage at the beak (on screen), then a high arc 15 m back. */
  private spit(v: RiderState): void {
    const { ctx, caster: r } = this;
    removeStatus(v, 'gulped');
    applyMods(v);
    skillHit(ctx, r, v, ID, { damage: GULP.spitDamage, heavy: true, impact: 'heavy' });
    ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#ffffff', from: 0.3, to: 2.4, dur: 0.35 }));
    if (v.hp <= 0) {
      this.victim = null; // knocked out at the beak: the KO crash takes over from here
      return;
    }
    addStatus(v, 'intangible', GULP.flight + 0.1, 1, r.id, true);
    applyMods(v);
    const len = ctx.session.track.length;
    const side = ctx.rng.chance(0.5) ? 1 : -1;
    const toS = Math.max(1, Math.min(len - 2, r.s + r.speed * GULP.flight - GULP.spitBack));
    this.from = { s: Math.min(r.s, len - 1), x: r.x };
    this.to = { s: toS, x: clampToRoad(ctx, toS, r.x + side * GULP.spitSide, 1.2) };
    this.phase = 'flight';
    this.pt = 0;
    this.fly(v, 0);
  }

  /** Flight pose at u ∈ [0, 1]; airborne throughout so sim treats it as an external flight (no landing bonus). */
  private fly(v: RiderState, u: number): void {
    v.s = lerp(this.from.s, this.to.s, u);
    v.x = lerp(this.from.x, this.to.x, u);
    v.y = GULP.spitY * (1 - u) + GULP.arc * Math.sin(Math.PI * u);
    v.vy = (-GULP.spitY + GULP.arc * Math.PI * Math.cos(Math.PI * u)) / GULP.flight;
    v.vx = 0;
    v.speed = 0;
    v.airborne = true;
  }

  private land(v: RiderState): void {
    const { ctx, caster: r } = this;
    v.y = v.vy = 0;
    v.airborne = false;
    v.speed = r.speed * 0.35;
    removeStatus(v, 'intangible');
    applyMods(v); // drop the flight's protection first, or the stun would be refused
    addStatus(v, 'stun', GULP.landStun, 1, r.id);
    applyMods(v);
    ctx.view(v)?.cue('stun');
    this.victim = null;
    ctx.visuals.add(new FlatRing(ctx.visuals, v.s, v.x, { color: '#ffe600', from: 0.4, to: 3, dur: 0.4 }));
  }

  protected override cleanup(reason: EndReason): void {
    if (reason !== 'dispose') this.closePouch();
    const v = this.victim;
    this.victim = null;
    if (!v || reason === 'dispose') return;
    removeStatus(v, 'gulped');
    removeStatus(v, 'intangible');
    applyMods(v);
    if (v.mode !== 'racing') return;
    if (this.phase === 'held') v.s = Math.max(1, Math.min(this.ctx.session.track.length - 1, this.caster.s - 2));
    v.y = v.vy = 0; // mid-flight victims drop where they are
    v.airborne = false;
  }
}

export const gulp: SkillImpl = { id: ID, cast: (ctx, r) => new Gulp(ctx, r) };
