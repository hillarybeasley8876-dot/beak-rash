// Visuals that follow a rider: chill aura disc, OIIA spin swirl (the doge shield lives in shield.ts).
import { Mesh, MeshBasicMaterial, Quaternion, Vector3, type ColorRepresentation } from 'three';
import type { RiderState } from '../../../core/types';
import { Follower } from './follower';
import { frameQuat } from './frame';
import type { VisualSystem } from './visuals';

const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const SPIN = new Quaternion();
const AXIS_Y = new Vector3(0, 1, 0);
const OFF = new Vector3();

/** Capybara CHILL ZONE: warm translucent disc + rim on the road, with calm ripples. */
export class AuraDisc extends Follower {
  private disc: Mesh;
  private rim: Mesh;
  private ripples: Mesh[] = [];

  constructor(vs: VisualSystem, r: RiderState, private radius: number, dur: number, color: ColorRepresentation, rimColor: ColorRepresentation) {
    super(vs, r, dur, 0.35);
    this.disc = this.own(new Mesh(this.geo('aura:disc'), this.mat(color, 0.16, true)));
    this.rim = this.own(new Mesh(this.geo('aura:rim'), this.mat(rimColor, 0.9)));
    const ripple = this.geo('aura:ripple');
    for (let i = 0; i < 3; i++) this.ripples.push(this.own(new Mesh(ripple, this.mat(rimColor, 0.5))));
    for (const m of [this.disc, this.rim, ...this.ripples]) m.renderOrder = 1;
  }

  protected place(): void {
    const e = this.env;
    const base = this.vs.ctx.world(this.r.s, this.r.x, 0.06, this.pos);
    const q = frameQuat(this.vs.ctx, this.r.s, this.quat).multiply(FLAT);
    const all = [this.disc, this.rim, ...this.ripples];
    all.forEach((m) => {
      m.position.copy(base);
      m.quaternion.copy(q);
    });
    const R = this.radius * (0.6 + 0.4 * e);
    this.disc.scale.setScalar(R);
    this.rim.scale.set(R, R, 1);
    (this.disc.material as MeshBasicMaterial).opacity = 0.16 * e;
    (this.rim.material as MeshBasicMaterial).opacity = 0.9 * e;
    this.ripples.forEach((m, i) => {
      const k = (this.t * 0.6 + i / 3) % 1;
      m.scale.set(R * k, R * k, 1);
      (m.material as MeshBasicMaterial).opacity = 0.55 * e * (1 - k);
    });
  }
}

/** OIIA spin: speed arcs whirling flat around the rider at two heights. */
export class SpinSwirl extends Follower {
  private arcs: Mesh[] = [];

  constructor(vs: VisualSystem, r: RiderState, private radius: number, dur: number, colors: [ColorRepresentation, ColorRepresentation]) {
    super(vs, r, dur, 0.12);
    for (let i = 0; i < 6; i++) {
      const arc = new Mesh(this.geo('aura:arc'), this.mat(colors[i % 2] as ColorRepresentation, 0.9));
      arc.renderOrder = 3;
      this.arcs.push(this.own(arc));
    }
  }

  protected place(): void {
    const e = this.env;
    this.arcs.forEach((m, i) => {
      const level = i < 3 ? 0.55 : 1.15;
      const R = this.radius * (i < 3 ? 0.95 : 0.75) * (0.7 + 0.3 * e);
      m.position.copy(this.pos).add(OFF.set(0, level, 0).applyQuaternion(this.quat));
      SPIN.setFromAxisAngle(AXIS_Y, this.t * 16 + (i % 3) * ((Math.PI * 2) / 3) + (i < 3 ? 0 : 0.6));
      m.quaternion.copy(this.quat).multiply(SPIN).multiply(FLAT);
      m.scale.set(R, R, 2.5);
      (m.material as MeshBasicMaterial).opacity = 0.9 * e;
    });
  }
}
