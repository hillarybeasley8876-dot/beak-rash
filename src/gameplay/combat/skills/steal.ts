// seagull.steal — MINE!: the nearest rival within 9 m that HAS something (a weapon, or SP ≥ 5) hands it over — the
// weapon and up to 25 SP; a rider with nothing gets its fries snatched instead (+10 SP out of thin air). The gull's
// grab flies out to the victim and back carrying the loot (r7 SPEC §29).
import { Mesh, MeshBasicMaterial, Vector3 } from 'three';
import type { RiderState, WeaponId } from '../../../core/types';
import { WEAPONS } from '../../../data/weapons';
import { takeWeapon } from '../armory';
import type { CombatCtx } from '../ctx';
import { nudge } from '../feedback';
import type { PropKey } from '../meshes/catalog';
import { gainSp } from '../sp';
import { AuraDisc } from '../visuals/auras';
import { Tether } from '../visuals/bolts';
import type { Visual, VisualSystem } from '../visuals/visuals';
import { inRadius } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'seagull.steal';
export const STEAL = { radius: 9, sp: 25, fries: 10, rich: 5, dur: 0.6, mark: 0.7 } as const;
/** The snatch: out in `out` seconds, a beat at the victim, back in `back`; the loot is this big (m). */
const SNATCH = { out: 0.18, hold: 0.06, back: 0.24, size: 0.7, lift: 1.5, arc: 1.2 } as const;

/** Worth robbing: a weapon in hand, or enough SP to be worth the trip. */
const rich = (v: RiderState): boolean => v.weapon !== 'none' || v.sp >= STEAL.rich;

/** The nearest rider within reach that carries something; only when nobody does, the nearest one at all. */
function victimOf(ctx: CombatCtx, r: RiderState): RiderState | undefined {
  const near = inRadius(ctx, r, STEAL.radius);
  return near.find(rich) ?? near[0];
}

/**
 * The grab itself: the loot flies from the gull's beak to the victim and back, spinning, with a glow disc behind
 * it so it reads at 20 m. `loot` is the prop it carries (a weapon, or a coin for SP / fries).
 */
class Snatch implements Visual {
  private t = 0;
  private mesh: Mesh;
  private glow: Mesh;
  private from = new Vector3();
  private to = new Vector3();
  private at = new Vector3();

  constructor(private vs: VisualSystem, private r: RiderState, private v: RiderState, loot: PropKey) {
    this.mesh = new Mesh(vs.ctx.lib.get(loot), vs.materials.glow('#ffd23f', 1));
    this.glow = new Mesh(vs.ctx.lib.get('aura:disc'), vs.materials.glow('#fff0a8', 0.4, { additive: true }));
    this.mesh.renderOrder = 5;
    this.glow.renderOrder = 4;
    vs.ctx.root.add(this.mesh, this.glow);
  }

  update(dt: number): boolean {
    this.t += dt;
    const S = SNATCH;
    if (this.t >= S.out + S.hold + S.back) return false;
    const u = this.t < S.out ? this.t / S.out : this.t < S.out + S.hold ? 1 : 1 - (this.t - S.out - S.hold) / S.back;
    this.vs.local(this.r, 0, S.lift, -0.55, this.from);
    this.vs.local(this.v, 0, S.lift - 0.2, 0, this.to);
    this.at.copy(this.from).lerp(this.to, u);
    this.at.y += Math.sin(u * Math.PI) * S.arc;
    this.mesh.position.copy(this.at);
    this.mesh.rotation.set(this.t * 14, this.t * 9, this.t * 5);
    this.mesh.scale.setScalar(S.size);
    this.glow.position.copy(this.at);
    this.glow.quaternion.copy(this.vs.ctx.session.app.camera.quaternion);
    this.glow.scale.setScalar(S.size * (1.2 + 0.3 * Math.sin(this.t * 22)));
    return true;
  }

  dispose(): void {
    for (const m of [this.mesh, this.glow]) {
      m.removeFromParent();
      this.vs.materials.release(m.material as MeshBasicMaterial);
    }
  }
}

class Steal extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, STEAL.dur, false);
    const v = victimOf(ctx, r);
    if (!v) {
      ctx.bus.emit('skill:result', { riderId: r.id, skillId: ID, text: '抢了个寂寞', good: false });
      return;
    }
    const armed = v.weapon !== 'none' && r.weapon === 'none';
    const weapon: WeaponId = v.weapon;
    if (v.weapon !== 'none') takeWeapon(ctx, r, v);
    const sp = Math.min(STEAL.sp, v.sp);
    v.sp -= sp;
    gainSp(r, sp);
    // nothing on them at all: the gull comes away with the victim's fries anyway (SPEC §29 baseline)
    const fries = sp <= 0 && !armed;
    if (fries) gainSp(r, STEAL.fries);
    const loot: PropKey = armed && weapon !== 'none' ? `weapon:${weapon}` : 'pickup:coin';
    ctx.visuals.add(new Tether(ctx.visuals, r, v));
    ctx.visuals.add(new Snatch(ctx.visuals, r, v, loot));
    ctx.visuals.add(new AuraDisc(ctx.visuals, v, 2.2, STEAL.mark, '#ffd23f', '#ffb300'));
    ctx.visuals.add(new AuraDisc(ctx.visuals, r, 2.6, STEAL.mark, '#fff0a8', '#ffd23f'));
    ctx.session.app.fx.burst(fries ? 'fries' : 'sparkle', ctx.pos(v, 1.2), { count: 14, color: '#ffd23f', scale: 0.8 });
    ctx.session.app.fx.burst('coin', ctx.pos(r, 1.4), { count: 10, color: '#ffd23f' });
    ctx.bus.emit('skill:hit', { riderId: r.id, skillId: ID, victim: v.id, pos: ctx.pos(v) });
    ctx.bus.emit('skill:result', { riderId: r.id, skillId: ID, text: resultText(armed ? weapon : null, sp, fries), good: true });
    ctx.bus.emit('taunt', { riderId: r.id, text: 'MINE!', character: r.character });
    nudge(ctx, v, 0.12);
  }

  protected tick(): void {}
}

/** What the gull tells its rider it came away with. */
function resultText(weapon: WeaponId | null, sp: number, fries: boolean): string {
  if (fries) return `偷到薯条 +${STEAL.fries} SP`;
  const parts = [weapon ? `偷到 ${WEAPONS[weapon].name}` : '', sp > 0 ? `偷到 ${Math.round(sp)} SP` : ''];
  return parts.filter(Boolean).join(' ') || `偷到 ${STEAL.fries} SP`;
}

export const steal: SkillImpl = {
  id: ID,
  ready: (ctx, r) => victimOf(ctx, r) !== undefined,
  cast: (ctx, r) => new Steal(ctx, r),
};
