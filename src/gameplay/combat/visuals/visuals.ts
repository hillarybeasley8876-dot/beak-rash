// Skill / projectile visuals owned by combat: short-lived toon-ish meshes that live in sim time (they
// slow down with the KO slow-mo and freeze in hit-stop). fx adds particles on top via bus events.
import { Quaternion, Vector3 } from 'three';
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { MaterialPool } from './materials';

export interface Visual {
  /** Advance by `dt` sim seconds; return false when finished. */
  update(dt: number): boolean;
  dispose(): void;
}

export class VisualSystem {
  readonly materials = new MaterialPool();
  private list: Visual[] = [];
  private qTmp = new Quaternion();
  private vTmp = new Vector3();

  constructor(readonly ctx: CombatCtx) {
    this.materials.warmUp(ctx.root, this.renderedFrames);
  }

  /** Frames the renderer has drawn so far (drives the shader warm-up). */
  private get renderedFrames(): number {
    return this.ctx.session.app.renderer.info.render.frame;
  }

  add<T extends Visual>(v: T): T {
    this.list.push(v);
    return v;
  }

  update(dt: number): void {
    this.materials.tick(this.renderedFrames);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      if (v && !v.update(dt)) {
        v.dispose();
        this.list.splice(i, 1);
      }
    }
  }

  get count(): number {
    return this.list.length;
  }

  /** World pose of a rider (bike contact point + orientation). */
  pose(r: RiderState, outPos: Vector3, outQuat: Quaternion = this.qTmp): Quaternion {
    this.ctx.session.physics.pose(r, outPos, outQuat);
    return outQuat;
  }

  /** World point at rider-local offset (x right, y up, z back), following lean/yaw. */
  local(r: RiderState, x: number, y: number, z: number, out: Vector3): Vector3 {
    const q = this.pose(r, out);
    return out.add(this.vTmp.set(x, y, z).applyQuaternion(q));
  }

  get cameraPos(): Vector3 {
    return this.ctx.session.app.camera.position;
  }

  dispose(): void {
    for (const v of this.list) v.dispose();
    this.list.length = 0;
    this.materials.dispose();
  }
}
