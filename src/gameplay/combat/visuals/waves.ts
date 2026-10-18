// Expanding ring visuals: cone sound waves (honk / whistle), puff rings (ghost, spit) and the SHOWTIME
// shockwave. Rings face along the track (cone waves) or lie flat on the road (puffs, shockwave).
import { DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Vector3, type BufferGeometry, type ColorRepresentation } from 'three';
import type { RiderState } from '../../../core/types';
import { frameQuat } from './frame';
import type { Visual, VisualSystem } from './visuals';

const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);

/** Unit ring / open cylinder shared through the session prop library. */
const ringGeo = (vs: VisualSystem): BufferGeometry => vs.ctx.lib.get('wave:ring');
const wallGeo = (vs: VisualSystem): BufferGeometry => vs.ctx.lib.get('wave:wall');

export interface ConeWaveOpts { color: ColorRepresentation; count: number; interval: number; speed: number; range: number; halfAngle: number; height: number }

/** Rings travelling forward from a rider, radius matching the gameplay cone (d · tan(halfAngle)). */
export class ConeWave implements Visual {
  private rings: Mesh[] = [];
  private t = 0;

  constructor(private vs: VisualSystem, private caster: RiderState, private o: ConeWaveOpts) {
    for (let i = 0; i < o.count; i++) {
      const m = new Mesh(ringGeo(vs), vs.materials.glow(o.color, 1, { side: DoubleSide }));
      m.visible = false;
      m.renderOrder = 3;
      vs.ctx.root.add(m);
      this.rings.push(m);
    }
  }

  update(dt: number): boolean {
    this.t += dt;
    const { ctx } = this.vs;
    let alive = false;
    this.rings.forEach((m, i) => {
      const age = this.t - i * this.o.interval;
      const d = 0.8 + age * this.o.speed;
      m.visible = age >= 0 && d < this.o.range;
      if (age < 0 || d < this.o.range) alive = true;
      if (!m.visible) return;
      const radius = Math.max(0.35, d * Math.tan(this.o.halfAngle));
      ctx.world(this.caster.s + d, this.caster.x, this.o.height, m.position);
      frameQuat(ctx, this.caster.s + d, m.quaternion);
      m.scale.set(radius, radius, radius);
      (m.material as MeshBasicMaterial).opacity = Math.pow(1 - d / this.o.range, 0.6);
    });
    return alive;
  }

  dispose(): void {
    for (const m of this.rings) {
      m.removeFromParent();
      this.vs.materials.release(m.material as MeshBasicMaterial);
    }
  }
}

/** One flat ring expanding at a fixed track point (puffs) — or the big SHOWTIME shockwave. */
export class FlatRing implements Visual {
  private ring: Mesh;
  private wall: Mesh | null = null;
  private t = 0;

  constructor(private vs: VisualSystem, s: number, x: number, private o: { color: ColorRepresentation; from: number; to: number; dur: number; wall?: ColorRepresentation; delay?: number }) {
    const { ctx } = vs;
    this.ring = new Mesh(ringGeo(vs), vs.materials.glow(o.color, 1, { side: DoubleSide }));
    ctx.world(s, x, 0.15, this.ring.position);
    frameQuat(ctx, s, this.ring.quaternion).multiply(FLAT);
    this.ring.visible = false;
    ctx.root.add(this.ring);
    if (o.wall) {
      this.wall = new Mesh(wallGeo(vs), vs.materials.glow(o.wall, 1, { side: DoubleSide }));
      this.wall.position.copy(this.ring.position);
      frameQuat(ctx, s, this.wall.quaternion);
      this.wall.visible = false;
      ctx.root.add(this.wall);
    }
  }

  update(dt: number): boolean {
    this.t += dt;
    const k = (this.t - (this.o.delay ?? 0)) / this.o.dur;
    const show = k >= 0 && k < 1;
    this.ring.visible = show;
    if (this.wall) this.wall.visible = show;
    if (!show) return k < 1;
    const ease = 1 - Math.pow(1 - k, 3);
    const r = this.o.from + (this.o.to - this.o.from) * ease;
    this.ring.scale.set(r, r, r * 0.6 + 1);
    (this.ring.material as MeshBasicMaterial).opacity = 1 - k * k;
    if (this.wall) {
      this.wall.scale.set(r * 0.98, 2.6 * (1 - k) + 0.2, r * 0.98);
      (this.wall.material as MeshBasicMaterial).opacity = 0.45 * (1 - k);
    }
    return true;
  }

  dispose(): void {
    for (const m of [this.ring, this.wall]) {
      if (!m) continue;
      m.removeFromParent();
      this.vs.materials.release(m.material as MeshBasicMaterial);
    }
  }
}
