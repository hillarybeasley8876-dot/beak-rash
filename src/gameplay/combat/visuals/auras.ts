// Visuals that follow a rider: chill aura disc, doge shield bubble, OIIA spin swirl.
import {
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Quaternion, Vector3, type BufferGeometry, type ColorRepresentation,
  type Material,
} from 'three';
import type { RiderState } from '../../../core/types';
import { frameQuat } from './frame';
import type { Visual, VisualSystem } from './visuals';

const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const SPIN = new Quaternion();
const AXIS_Y = new Vector3(0, 1, 0);
const OFF = new Vector3();

type AuraProp = 'disc' | 'rim' | 'ripple' | 'shell' | 'wire' | 'arc';

/** Base: owns meshes (shared geometry, pooled materials), follows a rider, fades in and out over `dur`. */
abstract class Follower implements Visual {
  protected t = 0;
  protected pos = new Vector3();
  protected quat = new Quaternion();
  protected owned: Array<Mesh | LineSegments> = [];

  constructor(protected vs: VisualSystem, protected r: RiderState, protected dur: number, private fade = 0.25) {}

  protected own<T extends Mesh | LineSegments>(o: T): T {
    this.owned.push(o);
    this.vs.ctx.root.add(o);
    return o;
  }

  /** 0..1 envelope (fade in, hold, fade out). */
  protected get env(): number {
    return Math.max(0, Math.min(1, this.t / this.fade, (this.dur - this.t) / this.fade));
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur || this.r.mode === 'crashed') return false;
    this.vs.pose(this.r, this.pos, this.quat);
    this.place(dt);
    return true;
  }

  protected abstract place(dt: number): void;

  /** Unit-size geometry shared through the session prop library (never disposed by the visual). */
  protected geo(key: AuraProp): BufferGeometry {
    return this.vs.ctx.lib.get(`aura:${key}`);
  }

  /** Pooled tinted material for one of this visual's meshes (returned to the pool on dispose). */
  protected mat(color: ColorRepresentation, opacity: number, additive = false): MeshBasicMaterial {
    return this.vs.materials.glow(color, opacity, { additive });
  }

  dispose(): void {
    for (const o of this.owned) {
      o.removeFromParent();
      this.vs.materials.release(o.material as Material);
    }
  }
}

/** Capybara CHILL ZONE: warm translucent disc + rim on the road, with calm ripples. */
export class AuraDisc extends Follower {
  private disc: Mesh;
  private rim: Mesh;
  private ripples: Mesh[] = [];

  constructor(vs: VisualSystem, r: RiderState, private radius: number, dur: number, color: ColorRepresentation, rimColor: ColorRepresentation) {
    super(vs, r, dur, 0.35);
    this.disc = this.own(new Mesh(this.geo('disc'), this.mat(color, 0.16, true)));
    this.rim = this.own(new Mesh(this.geo('rim'), this.mat(rimColor, 0.9)));
    const ripple = this.geo('ripple');
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

/** Doge shield: golden faceted bubble + white wire, slowly turning and pulsing. */
export class ShieldBubble extends Follower {
  private shell: Mesh;
  private wire: LineSegments;

  constructor(vs: VisualSystem, r: RiderState, dur: number, color: ColorRepresentation) {
    super(vs, r, dur, 0.2);
    this.shell = this.own(new Mesh(this.geo('shell'), this.mat(color, 0.22)));
    this.wire = this.own(new LineSegments(this.geo('wire'), vs.materials.line('#fff6c8', 0.8)));
    this.shell.renderOrder = this.wire.renderOrder = 2;
  }

  protected place(): void {
    const e = this.env;
    const up = OFF.set(0, 1.05, 0).applyQuaternion(this.quat);
    const s = (0.85 + 0.15 * e) * (1 + Math.sin(this.t * 9) * 0.035);
    SPIN.setFromAxisAngle(AXIS_Y, this.t * 0.8);
    for (const m of [this.shell, this.wire]) {
      m.position.copy(this.pos).add(up);
      m.quaternion.copy(this.quat).multiply(SPIN);
      m.scale.setScalar(s);
    }
    (this.shell.material as MeshBasicMaterial).opacity = 0.24 * e;
    (this.wire.material as LineBasicMaterial).opacity = 0.8 * e;
  }
}

/** OIIA spin: speed arcs whirling flat around the rider at two heights. */
export class SpinSwirl extends Follower {
  private arcs: Mesh[] = [];

  constructor(vs: VisualSystem, r: RiderState, private radius: number, dur: number, colors: [ColorRepresentation, ColorRepresentation]) {
    super(vs, r, dur, 0.12);
    for (let i = 0; i < 6; i++) {
      const arc = new Mesh(this.geo('arc'), this.mat(colors[i % 2] as ColorRepresentation, 0.9));
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
