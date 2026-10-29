// A glint at a fixed track point: the camera-facing star the heavy-swing tell uses, popping open and shrinking
// away (the boomerang's turn, the blink's two ends). Nothing moves it — the skill places it once.
import { Mesh, MeshBasicMaterial, Quaternion, Vector3, type ColorRepresentation } from 'three';
import type { Visual, VisualSystem } from '../../visuals/visuals';

const SPIN_AXIS = new Vector3(0, 0, 1);
const SPIN = new Quaternion();

/** Star size (m at the peak) and spin (rad/s) — the look, shared by every glint. */
export const GLINT_LOOK = { spin: 4 } as const;

export interface GlintOpts {
  color?: ColorRepresentation;
  size?: number;   // m across at the peak (default 1.4)
  dur?: number;    // s (default 0.35)
  delay?: number;  // s before it shows
}

export class Glint implements Visual {
  private t = 0;
  private star: Mesh;
  private at = new Vector3();

  constructor(private vs: VisualSystem, s: number, x: number, y: number, private o: GlintOpts = {}) {
    this.star = new Mesh(vs.ctx.lib.get('tell:star'), vs.materials.glow(o.color ?? '#ffffff', 1, { additive: true }));
    this.star.renderOrder = 4;
    this.star.frustumCulled = false;
    this.star.visible = false;
    vs.ctx.world(s, x, y, this.at);
    this.star.position.copy(this.at);
    vs.ctx.root.add(this.star);
  }

  /** Pops open in the first fifth of its life, then shrinks away. */
  update(dt: number): boolean {
    this.t += dt;
    const dur = this.o.dur ?? 0.35;
    const k = (this.t - (this.o.delay ?? 0)) / dur;
    if (k >= 1) return false;
    const show = k >= 0;
    this.star.visible = show;
    if (!show) return true;
    const grow = Math.min(1, k / 0.2);
    const size = (this.o.size ?? 1.4) * grow * (1 - k * k);
    SPIN.setFromAxisAngle(SPIN_AXIS, this.t * GLINT_LOOK.spin);
    this.star.quaternion.copy(this.vs.ctx.session.app.camera.quaternion).multiply(SPIN);
    this.star.scale.set(size, size * 1.3, 1);
    (this.star.material as MeshBasicMaterial).opacity = Math.min(1, 1.4 * (1 - k));
    return true;
  }

  dispose(): void {
    this.star.removeFromParent();
    this.vs.materials.release(this.star.material as MeshBasicMaterial);
  }
}
