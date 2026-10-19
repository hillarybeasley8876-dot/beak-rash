// Doge shield: a smooth rim-lit bubble (rim.ts) around the shiba with a few twinkling glints; a bounced hit sends a
// ripple ring over the shell and flares the glints. Fades out as the camera comes close, so it never fogs the screen.
import { Mesh, MeshBasicMaterial, Quaternion, Vector3, type ColorRepresentation } from 'three';
import { smoothstep } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import { Follower } from './follower';
import type { RimMaterial } from './rim';
import type { VisualSystem } from './visuals';

/** Radius (m), centre height over the bike, camera fade (0 nearer than `near`, full from `far`), ripple time (s). */
export const SHIELD_LOOK = { radius: 1, lift: 0.95, near: 2.5, far: 5, ripple: 0.4 } as const;
/** Glint directions on the shell (object space). */
const GLINTS = [new Vector3(0.6, 0.55, -0.58), new Vector3(-0.7, 0.2, 0.68), new Vector3(0.15, -0.3, 0.94)].map((v) => v.normalize());
const AXIS_Y = new Vector3(0, 1, 0);
const SPIN = new Quaternion();
const INV = new Quaternion();
const OFF = new Vector3();
const CENTRE = new Vector3();

export class ShieldBubble extends Follower {
  private shell: Mesh;
  private rim: RimMaterial;
  private glints: Mesh[];
  private ripple = 1; // progress 0..1 (1 = idle)

  constructor(vs: VisualSystem, r: RiderState, dur: number, color: ColorRepresentation) {
    super(vs, r, dur, 0.2);
    this.rim = vs.materials.rim(color, 0);
    this.shell = this.own(new Mesh(this.geo('aura:shell'), this.rim));
    this.shell.renderOrder = 2;
    const star = this.geo('tell:star');
    this.glints = GLINTS.map(() => {
      const m = this.own(new Mesh(star, this.mat('#fff6c8', 0, true)));
      m.renderOrder = 3;
      return m;
    });
  }

  /** A hit bounced off: a ripple runs over the shell from `dir` (world space, from the shiba's centre). */
  bounce(dir: Vector3): void {
    INV.copy(this.shell.quaternion).invert();
    this.rim.uniforms.uHit.value.copy(dir).applyQuaternion(INV).normalize();
    this.ripple = 0;
  }

  /** World centre of the bubble (valid after the first update). */
  get centre(): Vector3 {
    return this.shell.position;
  }

  protected place(dt: number): void {
    const L = SHIELD_LOOK;
    this.ripple = Math.min(1, this.ripple + dt / L.ripple);
    const centre = CENTRE.copy(this.pos).add(OFF.set(0, L.lift, 0).applyQuaternion(this.quat));
    const k = this.env * smoothstep(L.near, L.far, centre.distanceTo(this.vs.cameraPos));
    const s = L.radius * (0.85 + 0.15 * this.env) * (1 + Math.sin(this.t * 9) * 0.03);
    SPIN.setFromAxisAngle(AXIS_Y, this.t * 0.8);
    this.shell.position.copy(centre);
    this.shell.quaternion.copy(this.quat).multiply(SPIN);
    this.shell.scale.setScalar(s);
    this.shell.visible = k > 0.001;
    this.rim.uniforms.uOpacity.value = k;
    this.rim.uniforms.uRipple.value = this.ripple;
    const flare = 1 - this.ripple;
    const eye = this.vs.ctx.session.app.camera.quaternion;
    this.glints.forEach((m, i) => {
      const tw = 0.5 + 0.5 * Math.sin(this.t * 7 + i * 2.1);
      const size = 0.13 * (0.6 + 0.6 * tw + 1.4 * flare);
      m.position.copy(GLINTS[i] as Vector3).applyQuaternion(this.shell.quaternion).multiplyScalar(s * 1.02).add(centre);
      m.quaternion.copy(eye);
      m.scale.set(size, size * 1.35, 1);
      m.visible = this.shell.visible;
      (m.material as MeshBasicMaterial).opacity = k * Math.min(1, 0.35 + 0.65 * tw + flare);
    });
  }
}
