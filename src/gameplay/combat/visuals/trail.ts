// Fading ribbon trail behind a moving point (torpedo, wing tips, belly slide, ult dive).
import { Vector3, type ColorRepresentation } from 'three';
import { Ribbon } from './ribbon';
import type { Visual, VisualSystem } from './visuals';

/** Sim seconds between new samples (a bit under 1/60 s, so frame jitter at 60 fps never skips one). */
const SAMPLE_GAP = 0.75 / 60;

export interface TrailOpts {
  color: ColorRepresentation;
  width: number;
  life: number;        // seconds each sample stays visible
  max?: number;
  alpha?: number;
  additive?: boolean;
  taper?: boolean;     // narrow toward the tail (default true)
}

export class Trail implements Visual {
  private pts: Vector3[] = [];
  private spare: Vector3[] = [];     // recycled samples (no allocation per sample once warmed up)
  private ages: number[] = [];
  private ribbon: Ribbon;
  private acc = 1;
  private stopped = false;
  private probe = new Vector3();

  /** `source` writes the current head position; return false to skip a sample. */
  constructor(private vs: VisualSystem, private source: (out: Vector3) => boolean, private o: TrailOpts) {
    this.ribbon = new Ribbon(vs.materials, o.max ?? 24, o.color, o.additive ?? false);
    vs.ctx.root.add(this.ribbon.mesh);
  }

  stop(): void {
    this.stopped = true;
  }

  update(dt: number): boolean {
    for (let i = 0; i < this.ages.length; i++) this.ages[i] = (this.ages[i] ?? 0) + dt;
    while (this.ages.length > 0 && (this.ages[this.ages.length - 1] ?? 0) > this.o.life) this.dropTail();
    this.acc += dt;
    if (!this.stopped && this.source(this.probe)) {
      if (this.acc >= SAMPLE_GAP || this.pts.length === 0) {
        this.acc = 0;
        this.pts.unshift((this.spare.pop() ?? new Vector3()).copy(this.probe));
        this.ages.unshift(0);
        if (this.pts.length > (this.o.max ?? 24)) this.dropTail();
      } else {
        this.pts[0]?.copy(this.probe);
      }
    }
    const alpha = this.o.alpha ?? 0.85;
    const taper = this.o.taper ?? true;
    this.ribbon.set(
      this.pts,
      (i, n) => this.o.width * (taper ? 1 - i / n : 1),
      (i) => alpha * Math.max(0, 1 - (this.ages[i] ?? 0) / this.o.life),
      this.vs.cameraPos,
    );
    return !(this.stopped && this.pts.length === 0);
  }

  private dropTail(): void {
    this.ages.pop();
    const p = this.pts.pop();
    if (p) this.spare.push(p);
  }

  dispose(): void {
    this.ribbon.dispose();
  }
}
