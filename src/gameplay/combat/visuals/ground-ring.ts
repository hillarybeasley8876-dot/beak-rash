// SHOWTIME shockwave band hugging the road: a ring in track space (s, x) whose every point sits a few
// centimetres above the surface there, so on slopes, crests and banks it never floats up through the riders
// (a rigid flat ring rides at leg height a few metres away on a hill). The band also fades out around every
// rider it sweeps past, so it never tints the victims in the impact shot (they keep their own colours).
import { BufferAttribute, BufferGeometry, Color, Mesh, Vector3, type ColorRepresentation } from 'three';
import type { RiderState } from '../../../core/types';
import type { Visual, VisualSystem } from './visuals';

/** `source` = the rider the wave comes from (the band may run under it). */
export interface GroundRingOpts { color: ColorRepresentation; from: number; to: number; dur: number; delay?: number; source?: RiderState }

const SEGMENTS = 64;
/** Height above the road (m); band half-width: 7 % of the radius (the old torus band), at least 12 cm. */
const BAND = { lift: 0.05, width: 0.07, minWidth: 0.12 } as const;
/** Track-space distance (m) from a rider inside which the band is gone, and where it is back at full strength. */
const CLEAR = { gone: 1, full: 2.4 } as const;

export class GroundRing implements Visual {
  private mesh: Mesh;
  private geo = new BufferGeometry();
  private pos = new Float32Array((SEGMENTS + 1) * 2 * 3);
  private col = new Float32Array((SEGMENTS + 1) * 2 * 4);
  private color: Color;
  private p = new Vector3();
  private t = 0;

  constructor(private vs: VisualSystem, private s: number, private x: number, private o: GroundRingOpts) {
    this.color = new Color(o.color);
    const idx: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new BufferAttribute(this.col, 4));
    // the shared vertex-colour ribbon material (colour + alpha per vertex, double-sided, warmed up with the pool)
    this.mesh = new Mesh(this.geo, vs.materials.ribbon(false));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    vs.ctx.root.add(this.mesh);
  }

  /** 0 on top of a rider … 1 clear of every rider (track space). */
  private clearance(s: number, x: number): number {
    let d = Infinity;
    for (const r of this.vs.ctx.session.riders) if (r !== this.o.source) d = Math.min(d, Math.hypot(r.s - s, r.x - x));
    const k = Math.min(1, Math.max(0, (d - CLEAR.gone) / (CLEAR.full - CLEAR.gone)));
    return k * k * (3 - 2 * k);
  }

  update(dt: number): boolean {
    this.t += dt;
    const k = (this.t - (this.o.delay ?? 0)) / this.o.dur;
    const show = k >= 0 && k < 1;
    this.mesh.visible = show;
    if (!show) return k < 1;
    const r = this.o.from + (this.o.to - this.o.from) * (1 - Math.pow(1 - k, 3));
    const w = Math.max(BAND.minWidth, r * BAND.width), fade = 1 - k * k;
    const track = this.vs.ctx.session.track, end = track.length + (track.runoff ?? 0);
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      for (let e = 0; e < 2; e++) {
        const rad = e === 0 ? r - w : r + w, v = i * 2 + e;
        const s = Math.min(end, Math.max(0, this.s + rad * c)), x = this.x + rad * sn;
        track.toWorld(s, x, BAND.lift, this.p);
        this.pos[v * 3] = this.p.x;
        this.pos[v * 3 + 1] = this.p.y;
        this.pos[v * 3 + 2] = this.p.z;
        this.col[v * 4] = this.color.r;
        this.col[v * 4 + 1] = this.color.g;
        this.col[v * 4 + 2] = this.color.b;
        this.col[v * 4 + 3] = fade * this.clearance(s, x);
      }
    }
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('color') as BufferAttribute).needsUpdate = true;
    return true;
  }

  /** The shared ribbon material stays with the pool. */
  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
  }
}
