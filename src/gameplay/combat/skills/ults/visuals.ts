// The shared ults' own visuals (SPEC §24, job r6-skills-meme): the falling meteor, the lightning bolt and the
// storm's cloud lid. Every mesh is a shared library geometry with the shared toon material, so a cast never
// builds a material; each visual removes its meshes again when it ends.
import { Mesh, Quaternion, Vector3, type ColorRepresentation } from 'three';
import type { RiderState } from '../../../../core/types';
import { toonMesh } from '../../meshes/build';
import { Follower } from '../../visuals/follower';
import { frameQuat } from '../../visuals/frame';
import { Ribbon } from '../../visuals/ribbon';
import type { Visual, VisualSystem } from '../../visuals/visuals';

const AXIS_X = new Vector3(1, 0, 0);
const OFF = new Vector3();
const SPIN = new Quaternion();
/** m the meteor falls from. */
const START = 12;

/** A meteor dropping onto one spot of the road: it falls, it lands, it is gone. */
export class MeteorFall implements Visual {
  private mesh: Mesh;
  private t = 0;

  /** `spot` is where the meteor is heading (track space); it is read every frame, so it tracks the caster. */
  constructor(private vs: VisualSystem, private spot: () => { s: number; x: number }, private dur: number) {
    this.mesh = toonMesh(vs.ctx.lib.get('ult:meteor'), 0.04);
    this.mesh.name = 'visual:meteor';
    this.mesh.visible = false;
    vs.ctx.root.add(this.mesh);
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur) {
      this.mesh.visible = false;
      return false;
    }
    const k = this.t / this.dur;
    const at = this.spot();
    this.mesh.visible = true;
    this.vs.ctx.world(at.s, at.x, START * (1 - k * k), this.mesh.position);
    frameQuat(this.vs.ctx, at.s, this.mesh.quaternion);
    this.mesh.quaternion.multiply(SPIN.setFromAxisAngle(AXIS_X, -Math.PI / 2)); // nose down, tail up
    this.mesh.scale.setScalar(1.5 + 0.9 * k);
    return true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
  }
}

/** A lightning bolt from the sky onto one spot of the road. */
export class BoltStrike implements Visual {
  private ribbon: Ribbon;
  private pts: Vector3[] = [];
  private t = 0;

  constructor(private vs: VisualSystem, private s: number, private x: number, private dur: number, color: ColorRepresentation) {
    this.ribbon = new Ribbon(vs.materials, 12, color, true);
    vs.ctx.root.add(this.ribbon.mesh);
    for (let i = 0; i < 12; i++) this.pts.push(new Vector3());
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur) return false;
    const k = 1 - this.t / this.dur;
    for (let i = 0; i < this.pts.length; i++) {
      const u = i / (this.pts.length - 1);
      const j = i === 0 || i === this.pts.length - 1 ? 0 : Math.sin(u * 11 + this.s * 0.7) * 1.3;
      this.vs.ctx.world(this.s + j * 0.5, this.x + j, 22 * (1 - u), this.pts[i] as Vector3);
    }
    this.ribbon.set(this.pts, () => 0.8, () => k * (0.6 + 0.4 * Math.abs(Math.sin(this.t * 40))), this.vs.cameraPos);
    return true;
  }

  dispose(): void {
    this.ribbon.dispose();
  }
}

/** The storm's cloud lid over the road ahead of the caster, with the rain shaft under it. */
export class StormVeil extends Follower {
  private lid: Mesh;
  private shaft: Mesh;

  constructor(vs: VisualSystem, r: RiderState, dur: number, private reach: number) {
    super(vs, r, dur, 0.3);
    this.lid = this.own(toonMesh(this.geo('ult:storm'), 0.05));
    // the rain shaft is a soft translucent cylinder: a pooled glow material (the toon one is shared).
    this.shaft = this.own(new Mesh(this.geo('ult:rain'), this.mat('#6f8fc0', 0.3, true)));
  }

  protected place(): void {
    const e = this.env;
    const ahead = this.reach * 0.5;
    this.lid.position.copy(this.pos).add(OFF.set(0, 7, -ahead).applyQuaternion(this.quat));
    this.lid.quaternion.copy(this.quat);
    this.lid.scale.set(this.reach * 0.14, 1.4, 1);
    this.shaft.position.copy(this.pos).add(OFF.set(0, 3.2, -ahead).applyQuaternion(this.quat));
    this.shaft.quaternion.copy(this.quat);
    this.shaft.scale.set(this.reach * 0.1, 6, this.reach * 0.1);
    this.shaft.visible = e > 0.05;
  }
}
