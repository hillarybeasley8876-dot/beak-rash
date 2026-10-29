// Blink afterimages (SPEC §29 闪现): the rider's silhouette standing on the road where it passed, fading out over
// a few tenths. The shape is the session library's flat rider (gag:after); each one is a bright core inside a
// wider halo, both turned to the camera, so the jump leaves four readable ghosts along the road.
import { Mesh, MeshBasicMaterial, type BufferGeometry, type ColorRepresentation } from 'three';
import type { Visual, VisualSystem } from '../../visuals/visuals';

/** Life (s), halo width over the core, and how far each ghost shrinks before it is gone. */
export const AFTER_LOOK = { halo: 1.5, shrink: 0.35 } as const;

export interface AfterimageOpts {
  color?: ColorRepresentation;
  life?: number;   // s each ghost stays (default 0.4)
  size?: number;   // m across (default 1.1)
}

export class Afterimages implements Visual {
  private t = 0;
  private cores: Mesh[] = [];
  private halos: Mesh[] = [];

  /** `count` ghosts spread evenly between the track points (s0, x0) and (s1, x1), the ends left out. */
  constructor(private vs: VisualSystem, s0: number, x0: number, s1: number, x1: number, count: number, private o: AfterimageOpts = {}) {
    const geo = vs.ctx.lib.get('gag:after');
    const color = o.color ?? '#7ef9ff';
    for (let i = 0; i < count; i++) {
      const k = (i + 1) / (count + 1);
      const halo = this.add(geo, color, 0.55);
      const core = this.add(geo, '#ffffff', 0.9);
      vs.ctx.world(s0 + (s1 - s0) * k, x0 + (x1 - x0) * k, 0.06, core.position);
      halo.position.copy(core.position);
      this.cores.push(core);
      this.halos.push(halo);
    }
  }

  private add(geo: BufferGeometry, color: ColorRepresentation, opacity: number): Mesh {
    const m = new Mesh(geo, this.vs.materials.glow(color, opacity, { additive: true }));
    m.renderOrder = 3;
    m.frustumCulled = false;
    this.vs.ctx.root.add(m);
    return m;
  }

  update(dt: number): boolean {
    this.t += dt;
    const life = this.o.life ?? 0.4;
    if (this.t >= life) return false;
    const k = this.t / life;
    const size = (this.o.size ?? 1.1) * (1 - AFTER_LOOK.shrink * k);
    const eye = this.vs.ctx.session.app.camera.quaternion;
    this.cores.forEach((core, i) => {
      // the ghosts go out one after another, the one nearest the landing last
      const age = Math.max(0, Math.min(1, k * 1.6 - i * 0.15));
      const fade = 1 - age * age;
      const halo = this.halos[i] as Mesh;
      for (const [m, w, op] of [[core, 1, 0.9], [halo, AFTER_LOOK.halo, 0.55]] as const) {
        m.quaternion.copy(eye);
        m.scale.set(size * w, size * w, 1);
        (m.material as MeshBasicMaterial).opacity = op * fade;
      }
    });
    return true;
  }

  dispose(): void {
    for (const m of [...this.cores, ...this.halos]) {
      m.removeFromParent();
      this.vs.materials.release(m.material as MeshBasicMaterial);
    }
  }
}
