// Continuous per-rider emitters: wheel kick-up by surface & speed, drift sparks by mini-turbo level,
// boost / slipstream streaks, wing-dash trails, and dizzy stars while stunned.
import { Vector3 } from 'three';
import type { RiderId, RiderState } from '../../core/types';
import type { FxContext } from '../context';
import type { FxPart } from '../system';
import type { Tracked } from './tracker';

const KICKUP: Partial<Record<RiderState['surface'], string>> = { grass: 'grass', sand: 'sand', dirt: 'dirt', water: 'splash', curb: 'dust' };
const WING_TIME = 2.2;
const NEAR = 90;

const contact = new Vector3();
const kick = new Vector3();
const tip = new Vector3();
const dot = new Vector3();

interface RiderFx { kick: number; spark: number; smoke: number; streak: number; dizzyUntil: number; wingUntil: number; tips: [Vector3, Vector3] | null }

function driftLevel(charge: number): number {
  return charge >= 2 ? 3 : charge >= 1.2 ? 2 : charge >= 0.55 ? 1 : 0;
}

export class RiderEmitters implements FxPart {
  private readonly state = new Map<RiderId, RiderFx>();
  private readonly off: () => void;

  constructor(private readonly ctx: FxContext) {
    this.off = ctx.app.bus.on('skill:cast', (e) => {
      if (e.skillId === 'pelican.wing') this.get(e.riderId).wingUntil = ctx.particles.now + WING_TIME;
    });
  }

  private get(id: RiderId): RiderFx {
    let s = this.state.get(id);
    if (!s) {
      s = { kick: 0, spark: 0, smoke: 0, streak: 0, dizzyUntil: -1, wingUntil: -1, tips: null };
      this.state.set(id, s);
    }
    return s;
  }

  attach(): void {
    this.state.clear();
  }

  update(dtSim: number): void {
    const session = this.ctx.session();
    if (!session || dtSim <= 0) return;
    for (const r of session.riders) {
      const t = this.ctx.tracker.get(r.id);
      if (!t || t.dist > NEAR || r.mods.invisible || r.statuses.some((st) => st.id === 'gulped')) continue;
      const fx = this.get(r.id);
      if (r.mode === 'racing' || r.mode === 'finished') {
        if (!r.airborne) this.wheels(r, t, fx, dtSim);
        this.streaks(r, t, fx, dtSim);
        this.wings(t, fx);
      }
      this.dizzy(r, fx);
    }
  }

  private wheels(r: RiderState, t: Tracked, fx: RiderFx, dt: number): void {
    contact.copy(t.pos).addScaledVector(t.fwd, -0.55);
    contact.y = t.ground + 0.06;
    kick.copy(t.fwd).multiplyScalar(-1).addScaledVector(t.right, (r.x > 0 ? 1 : -1) * 0.2).setY(0.6);
    const preset = KICKUP[r.surface];
    if (preset && r.speed > 2) {
      fx.kick += (3 + r.speed * (preset === 'splash' ? 0.5 : 1.1)) * dt;
      for (; fx.kick >= 1; fx.kick--) {
        this.ctx.burst(preset, contact, { count: 1, vel: t.vel, ground: t.ground, dir: kick, scale: preset === 'splash' ? 0.45 : 0.9 });
      }
    }
    if (!r.drifting) return;
    const level = driftLevel(r.driftCharge);
    kick.addScaledVector(t.right, r.yaw > 0 ? -0.7 : 0.7);
    fx.spark += (level ? 34 : 14) * dt;
    for (; fx.spark >= 1; fx.spark--) this.ctx.burst('driftSpark', contact, { count: 1, level, vel: t.vel, dir: kick });
    fx.smoke += 7 * dt;
    for (; fx.smoke >= 1; fx.smoke--) this.ctx.burst('smoke', contact, { count: 1, vel: t.vel, scale: 0.5, dir: kick });
  }

  private streaks(r: RiderState, t: Tracked, fx: RiderFx, dt: number): void {
    const boosting = r.boostTime > 0;
    const drafting = r.isPlayer && r.draft > 0.5;
    if (!boosting && !drafting) return;
    const rate = boosting ? (r.isPlayer ? 46 : 12) : 14 * r.draft;
    fx.streak += rate * dt;
    for (; fx.streak >= 1; fx.streak--) {
      this.ctx.burst('streaks', t.pos, { count: 1, dir: t.fwd, color: boosting ? '#ffffff' : '#cfe8ff', scale: r.isPlayer ? 1 : 0.7 });
    }
  }

  private wings(t: Tracked, fx: RiderFx): void {
    if (fx.wingUntil < this.ctx.particles.now) {
      fx.tips = null;
      return;
    }
    const sides = [-1, 1] as const;
    if (!fx.tips) fx.tips = [new Vector3(), new Vector3()];
    sides.forEach((side, i) => {
      tip.copy(t.body).addScaledVector(t.right, side * 1.05).y += 0.15;
      const prev = fx.tips?.[i];
      if (!prev) return;
      const n = prev.lengthSq() === 0 ? 1 : Math.min(8, Math.ceil(prev.distanceTo(tip) / 0.12));
      for (let k = 1; k <= n; k++) {
        const p = prev.lengthSq() === 0 ? tip : dot.copy(prev).lerp(tip, k / n);
        this.ctx.burst('wingTrail', p, { dir: t.fwd });
      }
      prev.copy(tip);
    });
  }

  private dizzy(r: RiderState, fx: RiderFx): void {
    const stun = r.statuses.find((st) => st.id === 'stun');
    if (!stun || stun.time < 0.2 || fx.dizzyUntil > this.ctx.particles.now) return;
    fx.dizzyUntil = this.ctx.particles.now + stun.time;
    this.ctx.burst('dizzy', { x: 0, y: 0, z: 0 }, { follow: r.id, life: stun.time });
  }

  dispose(): void {
    this.off();
  }
}
