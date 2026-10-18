// Heavy-swing tell: a yellow-white glint flashes over a rival's raised weapon for the (telegraphed) windup,
// so a heavy coming at the player reads at a glance and can be answered with a counter hit.
import { Mesh, Quaternion, Vector3, type MeshBasicMaterial } from 'three';
import type { RiderState, Side } from '../../../core/types';
import type { Visual, VisualSystem } from './visuals';

const SPIN_AXIS = new Vector3(0, 0, 1);
const SPIN = new Quaternion();

export class HeavyTell implements Visual {
  private t = 0;
  private outer: Mesh;
  private core: Mesh;
  private at = new Vector3();

  constructor(private vs: VisualSystem, private r: RiderState, private side: Side, private dur: number) {
    const geo = vs.ctx.lib.get('tell:star');
    this.outer = new Mesh(geo, vs.materials.glow('#ffe600', 1, { additive: true }));
    this.core = new Mesh(geo, vs.materials.glow('#ffffff', 1, { additive: true }));
    for (const m of [this.outer, this.core]) {
      m.renderOrder = 4;
      m.frustumCulled = false;
      vs.ctx.root.add(m);
    }
    this.update(0);
  }

  /** Pops in, twinkles while the weapon is raised, shrinks away as the blow comes down. */
  update(dt: number): boolean {
    this.t += dt;
    const r = this.r, a = r.action;
    if (this.t >= this.dur || r.mode !== 'racing' || a?.kind !== 'heavy') return false;
    const u = this.t / this.dur;
    const k = Math.min(1, u / 0.15) * (u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25);
    const size = 0.5 * k * (1 + 0.15 * Math.sin(this.t * 40));
    this.vs.local(r, this.side * 0.55, 1.85, -0.1, this.at);
    SPIN.setFromAxisAngle(SPIN_AXIS, this.t * 5);
    const eye = this.vs.ctx.session.app.camera.quaternion;
    this.outer.position.copy(this.at);
    this.outer.quaternion.copy(eye).multiply(SPIN);
    this.outer.scale.set(size, size * 1.35, 1);
    this.core.position.copy(this.at);
    this.core.quaternion.copy(this.outer.quaternion);
    this.core.scale.set(size * 0.5, size * 0.7, 1);
    return true;
  }

  dispose(): void {
    for (const m of [this.outer, this.core]) {
      m.removeFromParent();
      this.vs.materials.release(m.material as MeshBasicMaterial);
    }
  }
}
