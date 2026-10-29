// shiba.doge — 3 s doge shield: melee bounces back at the attacker (a ripple runs over the bubble); the bike is
// kicked to `launch` × its top speed at the cast and holds +15 % on top of that.
// r7 (SPEC §29): the shield is felt — the bubble wears the doge's face (the deal-with-it shades), the cast gains
// ≥ 8 m in 3.5 s, and the caster reads 「狗头护体 3s」. The metres come from the launch kick (the sloth.flash
// pattern), not from a bigger 'boost' status: the status strength is what the skill-boost stacking rules pin.
import { Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { smoothstep } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import { BIKES } from '../../../data/bikes';
import type { CombatCtx } from '../ctx';
import { addStatus } from '../statuses';
import { SHIELD_REFLECT } from '../tuning';
import { ShieldBubble, SHIELD_LOOK } from '../visuals/shield';
import type { VisualSystem } from '../visuals/visuals';
import { skillBoost } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'shiba.doge';
/**
 * `launch` × the bike's top speed is where the cast puts the rider: the shield alone was not felt (the audit gained
 * 3.5 m in 3.5 s). 1.45 leaves ~6 m/s of overspeed over the boosted top speed, which the overspeed drag spends over
 * the next ~1 s — that, plus the +15 % the status holds for 3 s, is the ≥ 8 m the r7 contract asks for, whether the
 * rider was already at top speed or still accelerating.
 */
export const DOGE = { dur: 3, boost: 0.15, launch: 1.45 } as const;
const DIR = new Vector3();
const FACE_AT = new Vector3();

/**
 * The face on the near side of the bubble: the pixel deal-with-it shades, a cream muzzle and a smirk, always turned
 * to the camera. The muzzle and the smirk glow additively, so the rider inside the bubble still reads through them.
 */
const FACE = {
  ink: '#241806', cream: '#fff3cf', lift: 0.8, size: 1.45, up: 0.42,
  shades: [[-0.32, 0.12, 0.22, 0.16], [0.32, 0.12, 0.22, 0.16], [0, 0.12, 0.14, 0.03]] as const,
  muzzle: [0, -0.2, 0.34, 0.22] as const, nose: [0, -0.08, 0.13, 0.09] as const, smirk: [0, -0.06, 0.42],
} as const;
const SMIRK_SPIN = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI * 1.225);

/** ShieldBubble with the doge's face inked on the side that faces the camera. */
class DogeBubble extends ShieldBubble {
  private muzzle: Mesh;
  private smirk: Mesh;
  private inks: Mesh[] = [];

  constructor(vs: VisualSystem, r: RiderState, dur: number, color: string) {
    super(vs, r, dur, color);
    const disc = this.geo('aura:disc');
    this.muzzle = this.own(new Mesh(disc, this.mat(FACE.cream, 0.5, true)));        // additive: the rider shows through
    this.smirk = this.own(new Mesh(this.geo('aura:arc'), this.mat(FACE.ink, 0.8, true)));
    for (const _ of [...FACE.shades, FACE.nose]) this.inks.push(this.own(new Mesh(disc, this.mat(FACE.ink, 0.95))));
    this.muzzle.renderOrder = 4; this.smirk.renderOrder = 5;   // the muzzle sits under the shades and the smirk
    for (const m of this.inks) m.renderOrder = 6;
  }

  protected override place(dt: number): void {
    super.place(dt);
    const L = SHIELD_LOOK;
    const centre = this.centre;
    const eye = this.vs.ctx.session.app.camera.quaternion;
    FACE_AT.copy(this.vs.cameraPos).sub(centre);
    const k = this.env * smoothstep(L.near, L.far, FACE_AT.length());
    FACE_AT.normalize();
    const at = (x: number, y: number, out: Vector3): Vector3 =>
      out.set(x * FACE.size, y * FACE.size + FACE.up, 0).applyQuaternion(eye)
        .addScaledVector(FACE_AT, L.radius * FACE.lift).add(centre);
    const inks = [...FACE.shades, FACE.nose];
    inks.forEach(([x, y, w, h], i) => {
      const m = this.inks[i] as Mesh;
      at(x, y, m.position);
      m.quaternion.copy(eye);
      m.scale.set(w * FACE.size, h * FACE.size, 1);
      m.visible = k > 0.001;
      (m.material as MeshBasicMaterial).opacity = 0.95 * k;
    });
    const [mx, my, mw, mh] = FACE.muzzle;
    at(mx, my, this.muzzle.position);
    this.muzzle.quaternion.copy(eye);
    this.muzzle.scale.set(mw * FACE.size, mh * FACE.size, 1);
    this.muzzle.visible = k > 0.001;
    (this.muzzle.material as MeshBasicMaterial).opacity = 0.5 * k;
    const [sx, sy, sr] = FACE.smirk;
    at(sx, sy, this.smirk.position);
    this.smirk.quaternion.copy(eye).multiply(SMIRK_SPIN);
    this.smirk.scale.setScalar(sr * FACE.size);
    this.smirk.visible = k > 0.001;
    (this.smirk.material as MeshBasicMaterial).opacity = 0.8 * k;
  }
}

class Doge extends TimedSkill {
  private off: () => void;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, DOGE.dur, false);
    addStatus(r, 'shield', DOGE.dur, SHIELD_REFLECT, r.id, true);
    skillBoost(ctx, r, DOGE.dur, DOGE.boost);
    r.speed = Math.max(r.speed, BIKES[r.bike].topSpeed * DOGE.launch);
    const bubble = ctx.visuals.add(new DogeBubble(ctx.visuals, r, DOGE.dur, '#ffd23f'));
    ctx.session.app.fx.burst('sparkle', ctx.pos(r, 1.1), { count: 14, color: '#ffd23f', scale: 0.7 });
    ctx.bus.emit('skill:result', { riderId: r.id, skillId: ID, text: `狗头护体 ${DOGE.dur}s`, good: true });
    // the blocked half of a reflect: the swing that met the shield (damage.ts reflect)
    this.off = ctx.bus.on('combat:hit', (e) => {
      if (e.victim !== r.id || !e.blocked) return;
      const a = ctx.session.rider(e.attacker);
      if (!a) return;
      const at = ctx.pos(a);
      bubble.bounce(DIR.set(at.x, at.y, at.z).sub(bubble.centre));
    });
  }

  protected tick(): void {}

  protected override cleanup(): void {
    this.off();
  }
}

export const doge: SkillImpl = { id: ID, cast: (ctx, r) => new Doge(ctx, r) };
