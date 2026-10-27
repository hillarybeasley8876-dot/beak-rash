// Small visuals the elemental pool skills need (the shared waves / auras / shields cover the rest of them).
import { Mesh, MeshBasicMaterial, Quaternion, Vector3, type ColorRepresentation } from 'three';
import type { RiderState } from '../../../../core/types';
import { toonMesh } from '../../meshes/build';
import { frameQuat } from '../../visuals/frame';
import { Follower } from '../../visuals/follower';
import { Ribbon } from '../../visuals/ribbon';
import type { Visual, VisualSystem } from '../../visuals/visuals';

const SPIN = new Quaternion();
const AXIS_Y = new Vector3(0, 1, 0);
const OFF = new Vector3();
const TOP = new Vector3();
const BOT = new Vector3();
const BASE = new Vector3();
const QUAT = new Quaternion();
/** The lightning's zigzag (fixed, so every bolt of a cast looks the same). */
const ZIG = [0, 0.5, -0.35, 0.4, -0.2, 0.45, -0.3, 0.2, 0];

/** A bolt from the sky down to a point on the road (the thunder strike). */
export class Bolt implements Visual {
  private ribbon: Ribbon;
  private pts: Vector3[] = [];
  private t = 0;

  constructor(private vs: VisualSystem, private s: number, private x: number, color: ColorRepresentation, private dur = 0.4) {
    this.ribbon = new Ribbon(vs.materials, 9, color, true);
    vs.ctx.root.add(this.ribbon.mesh);
    for (let i = 0; i < 9; i++) this.pts.push(new Vector3());
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur) return false;
    const { ctx } = this.vs;
    ctx.world(this.s, this.x, 9, TOP);
    ctx.world(this.s, this.x, 0.2, BOT);
    const k = 1 - this.t / this.dur;
    for (let i = 0; i < this.pts.length; i++) {
      const u = i / (this.pts.length - 1);
      const p = this.pts[i] as Vector3;
      p.lerpVectors(TOP, BOT, u);
      p.x += (ZIG[i] ?? 0) * 0.5 * Math.sin(u * Math.PI);
    }
    this.ribbon.set(this.pts, () => 0.16 + 0.1 * k, () => 0.95 * k, this.vs.cameraPos);
    return true;
  }

  dispose(): void {
    this.ribbon.dispose();
  }
}

/** Where the whirlwind is right now (the skill owns it, the visual reads it). */
export interface WhirlState { s: number; x: number }

/** The tornado: flat arcs whirling around a point that races along the road. */
export class Whirl implements Visual {
  private arcs: Mesh[] = [];
  private t = 0;

  constructor(private vs: VisualSystem, private state: WhirlState, private dur: number) {
    for (let i = 0; i < 7; i++) {
      const m = new Mesh(vs.ctx.lib.get('aura:arc'), vs.materials.glow(i % 2 ? '#ffffff' : '#9fd8ff', 0.9));
      m.renderOrder = 3;
      vs.ctx.root.add(m);
      this.arcs.push(m);
    }
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur) return false;
    const { ctx } = this.vs;
    ctx.world(this.state.s, this.state.x, 0.1, BASE);
    frameQuat(ctx, this.state.s, QUAT);
    const fade = 1 - this.t / this.dur;
    this.arcs.forEach((m, i) => {
      const level = 0.3 + (i / this.arcs.length) * 3;
      m.position.copy(BASE);
      m.position.y += level;
      SPIN.setFromAxisAngle(AXIS_Y, this.t * 11 + i * 1.3);
      m.quaternion.copy(QUAT).multiply(SPIN); // upright rings: a funnel the camera can see
      const R = 1.25 - level * 0.18;
      m.scale.set(R, R * 1.3, 2.6);
      (m.material as MeshBasicMaterial).opacity = 0.9 * fade;
    });
    return true;
  }

  dispose(): void {
    for (const m of this.arcs) {
      m.removeFromParent();
      this.vs.materials.release(m.material as MeshBasicMaterial);
    }
  }
}

/** The 二踢脚 trailing the caster: a little red firecracker that hops along the road behind them. */
export class Crack extends Follower {
  private mesh: Mesh;

  constructor(vs: VisualSystem, r: RiderState, dur: number, private back: number) {
    super(vs, r, dur, 0.2);
    this.mesh = this.own(toonMesh(this.geo('elem:cracker'), 0.02));
  }

  protected place(): void {
    this.mesh.position.copy(this.pos).add(OFF.set(0, 0.14, this.back).applyQuaternion(this.quat));
    this.mesh.quaternion.copy(this.quat);
    this.mesh.position.y += Math.abs(Math.sin(this.t * 13)) * 0.14; // the hop
  }
}

/** A patch of fire left burning on the road (the rocket's line). */
export class Ember implements Visual {
  private mesh: Mesh;
  private t = 0;

  constructor(private vs: VisualSystem, private s: number, private x: number, private dur: number) {
    this.mesh = new Mesh(vs.ctx.lib.get('elem:flame'), vs.materials.glow('#ff8a20', 0.9, { additive: true }));
    this.mesh.renderOrder = 3;
    vs.ctx.root.add(this.mesh);
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur) return false;
    const { ctx } = this.vs;
    ctx.world(this.s, this.x, 0.05, BASE);
    this.mesh.position.copy(BASE);
    const k = this.t / this.dur;
    const flick = 0.8 + 0.2 * Math.sin(this.t * 22);
    this.mesh.scale.set(flick, flick * (1 + 0.2 * Math.sin(this.t * 17)), flick);
    this.mesh.rotation.y = this.t * 3;
    (this.mesh.material as MeshBasicMaterial).opacity = 0.9 * (1 - k * k);
    return true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.vs.materials.release(this.mesh.material as MeshBasicMaterial);
  }
}
