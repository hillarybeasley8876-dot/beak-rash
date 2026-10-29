// Goji steam (枸杞保温杯, SPEC §29): green steam curls up around the rider with a few berries riding the swirl,
// so the thermos reads as a pick-me-up even at full HP. Everything is driven by the sim clock and the puff index —
// no random rolls, so the same cast always looks the same.
import { Mesh, MeshBasicMaterial, Vector3, type BufferGeometry, type Material } from 'three';
import { toonMesh } from '../../meshes/build';
import type { RiderState } from '../../../../core/types';
import type { Visual, VisualSystem } from '../../visuals/visuals';

export const STEAM_LOOK = {
  puffs: 6,        // green steam curls
  berries: 5,      // goji berries riding the swirl
  rise: 2.3,       // m the swirl climbs
  radius: 0.62,    // m around the rider
  spin: 3.4,       // rad/s of the swirl
  climb: 0.55,     // turns per second the curls rise
} as const;

export class GojiSteam implements Visual {
  private t = 0;
  private puffs: Mesh[] = [];
  private berries: Mesh[] = [];
  private at = new Vector3();
  private off = new Vector3();

  constructor(private vs: VisualSystem, private r: RiderState, private dur: number) {
    const disc = vs.ctx.lib.get('aura:disc');
    for (let i = 0; i < STEAM_LOOK.puffs; i++) this.puffs.push(this.glow(disc));
    const berry = vs.ctx.lib.get('gag:goji');
    for (let i = 0; i < STEAM_LOOK.berries; i++) {
      const m = toonMesh(berry, 0.02);
      m.renderOrder = 2;
      vs.ctx.root.add(m);
      this.berries.push(m);
    }
  }

  private glow(geo: BufferGeometry): Mesh {
    const m = new Mesh(geo, this.vs.materials.glow('#9be564', 0.5, { additive: true }));
    m.renderOrder = 3;
    m.frustumCulled = false;
    this.vs.ctx.root.add(m);
    return m;
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur || this.r.mode === 'crashed') return false;
    const L = STEAM_LOOK;
    const env = Math.max(0, Math.min(1, this.t / 0.2, (this.dur - this.t) / 0.35));
    this.vs.pose(this.r, this.at);
    const eye = this.vs.ctx.session.app.camera.quaternion;
    this.puffs.forEach((m, i) => {
      const k = (this.t * L.climb + i / L.puffs) % 1;
      m.position.copy(this.at).add(this.off.set(Math.cos(this.angle(i, L.puffs)) * L.radius * (0.5 + k), 0.3 + k * L.rise,
        Math.sin(this.angle(i, L.puffs)) * L.radius * (0.5 + k)));
      m.quaternion.copy(eye);
      const s = 0.22 + k * 0.6;
      m.scale.set(s, s, 1);
      (m.material as MeshBasicMaterial).opacity = 0.5 * env * Math.sin(Math.PI * k);
    });
    this.berries.forEach((m, i) => {
      const k = (this.t * L.climb * 0.8 + i / L.berries) % 1;
      m.position.copy(this.at).add(this.off.set(Math.cos(this.angle(i, L.berries)) * L.radius, 0.5 + k * L.rise * 0.8,
        Math.sin(this.angle(i, L.berries)) * L.radius));
      m.rotation.set(this.t * 3 + i, this.angle(i, L.berries), 0);
      m.visible = env > 0.05;
    });
    return true;
  }

  /** Swirl angle of element `i` of `n` right now. */
  private angle(i: number, n: number): number {
    return (i / n) * Math.PI * 2 + this.t * STEAM_LOOK.spin;
  }

  dispose(): void {
    for (const m of this.puffs) {
      m.removeFromParent();
      this.vs.materials.release(m.material as Material);
    }
    for (const m of this.berries) m.removeFromParent();   // toon materials are shared, never released here
  }
}
