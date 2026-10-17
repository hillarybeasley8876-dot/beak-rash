// Ribbon-based rider effects: sloth lightning, seagull grab tether, Big Gulp vacuum spiral.
import { Vector3, type ColorRepresentation } from 'three';
import { Rng } from '../../../core/rng';
import type { RiderState } from '../../../core/types';
import { Ribbon } from './ribbon';
import type { Visual, VisualSystem } from './visuals';

const cosmetic = new Rng(0x5eedbeef);

abstract class RibbonSet implements Visual {
  protected t = 0;
  protected ribbons: Ribbon[] = [];
  /** Per-ribbon point buffers, reused every step (no allocation while drawing). */
  protected pts: Vector3[][] = [];

  constructor(protected vs: VisualSystem, protected r: RiderState, protected dur: number, count: number, color: ColorRepresentation, max: number, additive: boolean) {
    for (let i = 0; i < count; i++) {
      const rb = new Ribbon(vs.materials, max, color, additive);
      vs.ctx.root.add(rb.mesh);
      this.ribbons.push(rb);
      this.pts.push(Array.from({ length: max }, () => new Vector3()));
    }
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur || this.r.mode === 'crashed') return false;
    this.draw(dt);
    return true;
  }

  protected abstract draw(dt: number): void;

  /** Rider-local point → world, written into `out`. */
  protected at(x: number, y: number, z: number, out: Vector3): Vector3 {
    return this.vs.local(this.r, x, y, z, out);
  }



  dispose(): void {
    for (const rb of this.ribbons) rb.dispose();
  }
}

/** Sloth FLASH: crackling yellow zigzags around the rider, re-rolled every 60 ms. */
export class Lightning extends RibbonSet {
  private shapes: Array<Array<[number, number, number]>> = [];
  private reroll = 0;

  constructor(vs: VisualSystem, r: RiderState, dur: number) {
    super(vs, r, dur, 6, '#ffe600', 8, true);
  }

  protected draw(dt: number): void {
    this.reroll -= dt;
    if (this.reroll <= 0 || this.shapes.length === 0) {
      this.reroll = 0.06;
      this.shapes = this.ribbons.map((_, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        let x = side * cosmetic.range(0.4, 0.9), y = cosmetic.range(0.3, 2.1), z = cosmetic.range(-0.8, 0.3);
        const pts: Array<[number, number, number]> = [];
        for (let k = 0; k < 7; k++) {
          pts.push([x, y, z]);
          x += side * cosmetic.range(-0.08, 0.2);
          y += cosmetic.range(-0.3, 0.3);
          z += cosmetic.range(0.2, 0.45);
        }
        return pts;
      });
    }
    const flicker = 0.6 + 0.4 * Math.abs(Math.sin(this.t * 47));
    this.ribbons.forEach((rb, i) => {
      const shape = this.shapes[i] ?? [];
      const pts = this.pts[i] ?? [];
      for (let k = 0; k < shape.length && k < pts.length; k++) {
        const [x, y, z] = shape[k] as [number, number, number];
        this.at(x, y, z, pts[k] as Vector3);
      }
      rb.set(pts, (k, n) => 0.16 * (1 - k / (n + 1)) + 0.04, (k, n) => flicker * (1 - k / (n + 2)), this.vs.cameraPos, shape.length);
    });
  }
}

/** Seagull MINE!: a yellow grab line shoots to the victim and snaps back. */
export class Tether extends RibbonSet {
  private from = new Vector3();
  private to = new Vector3();

  constructor(vs: VisualSystem, r: RiderState, private victim: RiderState) {
    super(vs, r, 0.42, 1, '#ffd23f', 12, false);
  }

  protected draw(): void {
    const from = this.at(0, 1.55, -0.55, this.from);
    const to = this.vs.local(this.victim, 0, 1.2, 0, this.to);
    const reach = this.t < 0.14 ? this.t / 0.14 : Math.max(0, 1 - (this.t - 0.22) / 0.2);
    const pts = this.pts[0] ?? [];
    for (let k = 0; k < 12; k++) {
      const u = (k / 11) * reach;
      const p = pts[11 - k]; // head (victim end) first
      if (!p) continue;
      p.copy(from).lerp(to, u);
      p.y += Math.sin(u * Math.PI) * 0.35;
    }
    this.ribbons[0]?.set(pts, (i, n) => 0.24 * (0.5 + 0.5 * (1 - i / n)), () => 0.95, this.vs.cameraPos);
  }
}

/** Big Gulp: three white streams spiralling into the beak. */
export class VacuumSpiral extends RibbonSet {
  constructor(vs: VisualSystem, r: RiderState, dur: number, private radius: number) {
    super(vs, r, dur, 3, '#ffffff', 16, false);
  }

  protected draw(): void {
    const env = Math.min(1, this.t / 0.15, (this.dur - this.t) / 0.2);
    this.ribbons.forEach((rb, i) => {
      const pts = this.pts[i] ?? [];
      for (let k = 0; k < 16; k++) {
        const u = k / 15;
        const rad = this.radius * 0.85 * (1 - u) + 0.12;
        const a = i * ((Math.PI * 2) / 3) + u * Math.PI * 3 - this.t * 9;
        const p = pts[15 - k]; // head (beak end) first
        if (p) this.at(Math.cos(a) * rad, 1.45 + Math.sin(a) * rad * 0.55, -0.55 - (1 - u) * this.radius * 1.1, p);
      }
      rb.set(pts, (k, n) => 0.12 * (1 - k / n) + 0.02, (k, n) => 0.75 * env * (0.3 + 0.7 * (1 - k / n)), this.vs.cameraPos);
    });
  }
}
