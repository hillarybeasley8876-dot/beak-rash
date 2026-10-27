// A small solid prop that flies in track space (the pie, a duck, the boomerang fish): the skill moves it every
// tick (s, x, y), the visual turns it to the track frame, spins it and drops it when the skill stops it. The
// geometry is the session library's (shared, never disposed here); the toon + outline materials are cached per
// colour in render/toon.ts, so a cast creates no new material.
import { Mesh, Quaternion, Vector3, type BufferGeometry } from 'three';
import { toonMesh } from '../../meshes/build';
import { frameQuat } from '../../visuals/frame';
import type { Visual, VisualSystem } from '../../visuals/visuals';

const AXIS_Y = new Vector3(0, 1, 0);
const SPIN = new Quaternion();

export interface FlyerOpts {
  scale?: number;   // the prop's size (the geometries are modelled at about 1 m)
  spin?: number;    // rad/s about its own axis
  bob?: number;     // m of up-and-down wobble
}

/** One flying prop. `s`, `x` and `y` are its track-space position; the skill writes them every tick. */
export class Flyer implements Visual {
  readonly mesh: Mesh;
  s = 0;
  x = 0;
  y = 1.2;
  private t = 0;
  private dead = false;

  constructor(private vs: VisualSystem, geo: BufferGeometry, private o: FlyerOpts = {}) {
    this.mesh = toonMesh(geo, 0.02);
    this.mesh.scale.setScalar(o.scale ?? 1);
    this.mesh.renderOrder = 1;
    vs.ctx.root.add(this.mesh);
  }

  /** The prop is done (the skill hit something or ran out of time): the next update drops it. */
  stop(): void {
    this.dead = true;
  }

  update(dt: number): boolean {
    if (this.dead) return false;
    this.t += dt;
    const { ctx } = this.vs;
    ctx.world(this.s, this.x, this.y + (this.o.bob ? Math.sin(this.t * 12) * this.o.bob : 0), this.mesh.position);
    frameQuat(ctx, this.s, this.mesh.quaternion);
    if (this.o.spin) this.mesh.quaternion.multiply(SPIN.setFromAxisAngle(AXIS_Y, this.t * this.o.spin));
    return true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
  }
}
