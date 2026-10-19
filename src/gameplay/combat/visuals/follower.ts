// Base for visuals that follow a rider (chill aura, OIIA swirl, doge shield): owns its meshes (shared library
// geometry, pooled materials), poses itself on the rider every frame and fades in and out over its duration.
import { Mesh, MeshBasicMaterial, Quaternion, Vector3, type BufferGeometry, type ColorRepresentation, type Material } from 'three';
import type { RiderState } from '../../../core/types';
import type { PropKey } from '../meshes/catalog';
import type { Visual, VisualSystem } from './visuals';

export abstract class Follower implements Visual {
  protected t = 0;
  protected pos = new Vector3();
  protected quat = new Quaternion();
  protected owned: Mesh[] = [];

  constructor(protected vs: VisualSystem, protected r: RiderState, protected dur: number, private fade = 0.25) {}

  protected own<T extends Mesh>(o: T): T {
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
  protected geo(key: PropKey): BufferGeometry {
    return this.vs.ctx.lib.get(key);
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
