// Continuous per-rider emitters: wheel kick-up by surface & speed, drift sparks by mini-turbo level,
// boost / slipstream wind lines. (Dizzy stars are drawn by actors, the wing-dash ribbons by combat.)
import { Vector3 } from 'three';
import type { RiderId, RiderState } from '../../core/types';
import type { FxContext } from '../context';
import type { FxPart } from '../system';
import type { Tracked } from './tracker';

const KICKUP: Partial<Record<RiderState['surface'], string>> = { grass: 'grass', sand: 'sand', dirt: 'dirt', water: 'splash', curb: 'dust' };
const NEAR = 90;
/** Size / count share of a rival's drift spark fan. */
const RIVAL_SPARKS = 0.6;

const contact = new Vector3();
const kick = new Vector3();

interface RiderFx { kick: number; spark: number; smoke: number; streak: number }

function driftLevel(charge: number): number {
  return charge >= 2 ? 3 : charge >= 1.2 ? 2 : charge >= 0.55 ? 1 : 0;
}

export class RiderEmitters implements FxPart {
  private readonly state = new Map<RiderId, RiderFx>();

  constructor(private readonly ctx: FxContext) {}

  private get(id: RiderId): RiderFx {
    let s = this.state.get(id);
    if (!s) {
      s = { kick: 0, spark: 0, smoke: 0, streak: 0 };
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
      }
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
    // The player's fan is the release timing cue; rivals' fans are thinner (several riders drift at once).
    const scale = r.isPlayer ? 1 : RIVAL_SPARKS;
    for (; fx.spark >= 1; fx.spark--) this.ctx.burst('driftSpark', contact, { level, vel: t.vel, dir: kick, scale });
    fx.smoke += 12 * dt;
    for (; fx.smoke >= 1; fx.smoke--) this.ctx.burst('driftSmoke', contact, { count: 1, vel: t.vel, dir: kick });
  }

  private streaks(r: RiderState, t: Tracked, fx: RiderFx, dt: number): void {
    const boosting = r.boostTime > 0;
    const drafting = r.isPlayer && r.draft > 0.5;
    if (!boosting && !drafting) return;
    const rate = boosting ? (r.isPlayer ? 40 : 10) : 14 * r.draft;
    fx.streak += rate * dt;
    for (; fx.streak >= 1; fx.streak--) {
      this.ctx.burst('streaks', t.pos, { count: 1, dir: t.fwd, color: boosting ? '#b3b3b3' : '#8c8c8c', scale: r.isPlayer ? 1 : 0.7 });
    }
  }
}
