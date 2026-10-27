// The meme roster's own visuals (SPEC §24, job r6-skills-meme): the dropped banana peels, the crying cat's
// little rain cloud and the hamster's violin. Every mesh is a shared library geometry with the shared toon
// material (render/toon.ts caches it), so a cast never builds a material; each visual removes its meshes again.
import { Mesh, Quaternion, Vector3 } from 'three';
import type { RiderState } from '../../../../core/types';
import { toonMesh } from '../../meshes/build';
import { Follower } from '../../visuals/follower';
import { frameQuat } from '../../visuals/frame';
import type { Visual, VisualSystem } from '../../visuals/visuals';

const OFF = new Vector3();
const SPIN = new Quaternion();
const AXIS_Y = new Vector3(0, 1, 0);

/** Where a peel lies on the road and when it was dropped (s). */
export interface PeelSpot { s: number; x: number; at: number }

/** The banana peels on the road: they pop up where the caster dropped them and stay until they are run over. */
export class PeelField implements Visual {
  private meshes: Mesh[] = [];
  private t = 0;

  constructor(private vs: VisualSystem, private peels: readonly PeelSpot[], private dur: number) {
    for (const _ of peels) {
      const m = toonMesh(vs.ctx.lib.get('meme:peel'), 0.03);
      m.visible = false;
      vs.ctx.root.add(m);
      this.meshes.push(m);
    }
  }

  update(dt: number): boolean {
    this.t += dt;
    let alive = false;
    this.peels.forEach((p, i) => {
      const m = this.meshes[i];
      if (!m) return;
      const show = this.t >= p.at;
      m.visible = show;
      if (!show) return;
      alive = true;
      this.vs.ctx.world(p.s, p.x, 0.03, m.position);
      frameQuat(this.vs.ctx, p.s, m.quaternion);
      m.scale.setScalar(1 + 0.05 * Math.sin(this.t * 6 + i));
    });
    return alive && this.t < this.dur;
  }

  dispose(): void {
    for (const m of this.meshes) m.removeFromParent();
    this.meshes.length = 0;
  }
}

/** The crying cat's rain cloud: a little cloud over the rider with drops falling out of it. */
export class RainCloud extends Follower {
  private cloud: Mesh;
  private drops: Mesh[] = [];

  constructor(vs: VisualSystem, r: RiderState, dur: number, private radius: number) {
    super(vs, r, dur, 0.3);
    this.cloud = this.own(toonMesh(this.geo('meme:cloud'), 0.03));
    for (let i = 0; i < 8; i++) {
      const d = this.own(toonMesh(this.geo('meme:drop'), 0.01));
      d.visible = false;
      this.drops.push(d);
    }
  }

  protected place(): void {
    const e = this.env;
    this.cloud.position.copy(this.pos).add(OFF.set(0, 3.4, 0).applyQuaternion(this.quat));
    this.cloud.quaternion.copy(this.quat);
    this.cloud.scale.setScalar(this.radius * 0.13 * (0.9 + 0.1 * e));
    this.drops.forEach((d, i) => {
      const k = (this.t * 1.6 + i / this.drops.length) % 1;
      const a = (i / this.drops.length) * Math.PI * 2;
      const rad = this.radius * 0.45 * Math.sqrt((i + 0.5) / this.drops.length);
      d.position.copy(this.pos).add(OFF.set(Math.cos(a) * rad, 3.1 - k * 3, Math.sin(a) * rad).applyQuaternion(this.quat));
      d.quaternion.copy(this.quat);
      d.scale.set(1, 0.6 + 0.4 * e, 1);
      d.visible = e > 0.05;
    });
  }
}

/** The hamster's violin: it hovers at the rider's side and sways with the tune. */export class ViolinPlayer extends Follower {
  private violin: Mesh;

  constructor(vs: VisualSystem, r: RiderState, dur: number) {
    super(vs, r, dur, 0.25);
    this.violin = this.own(toonMesh(this.geo('meme:violin'), 0.03));
  }

  protected place(): void {
    const e = this.env;
    const sway = Math.sin(this.t * 4.2) * 0.16;
    this.violin.position.copy(this.pos).add(OFF.set(0.42, 1.15, -0.2).applyQuaternion(this.quat));
    SPIN.setFromAxisAngle(AXIS_Y, sway);
    this.violin.quaternion.copy(this.quat).multiply(SPIN).multiply(SPIN);
    this.violin.rotateX(-0.5 + Math.sin(this.t * 4.2) * 0.12);
    this.violin.scale.setScalar(0.8 + 0.2 * e);
  }
}

/** Pedro's bin: it spins beside him while he rummages in it. */
export class BinRummage extends Follower {
  private bin: Mesh;

  constructor(vs: VisualSystem, r: RiderState, dur: number) {
    super(vs, r, dur, 0.2);
    this.bin = this.own(toonMesh(this.geo('meme:bin'), 0.03));
  }

  protected place(): void {
    const e = this.env;
    this.bin.position.copy(this.pos).add(OFF.set(0.72, 0.5, -0.25).applyQuaternion(this.quat));
    SPIN.setFromAxisAngle(AXIS_Y, this.t * 7);
    this.bin.quaternion.copy(this.quat).multiply(SPIN);
    this.bin.scale.setScalar(0.8 + 0.2 * e);
  }
}
