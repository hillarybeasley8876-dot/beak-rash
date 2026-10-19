// The particle system: two pools (solid comic sprites with ink outlines + additive glows/sparks),
// a sim-time particle clock (slow-mo and hit-stop slow particles too) plus a real-time clock for
// impact pops that must read instantly, and 16 follow anchors.
import { Color, Group, Vector3 } from 'three';
import { particleAtlas } from './atlas';
import { ParticlePool, blankSpec, type ParticleSpec, type SharedUniforms } from './pool';
import type { Quality } from '../../core/types';

export const ANCHOR_SLOTS = 16;

const CAPACITY: Record<Quality, { solid: number; add: number; density: number }> = {
  low: { solid: 900, add: 500, density: 0.5 },
  medium: { solid: 1600, add: 800, density: 0.8 },
  high: { solid: 2000, add: 1000, density: 1 },
};

const tmpA = new Color();
const tmpB = new Color();

export class Particles {
  readonly group = new Group();
  /** Count multiplier for presets (quality). */
  readonly density: number;
  private readonly solid: ParticlePool;
  private readonly add: ParticlePool;
  private readonly anchors: Vector3[] = Array.from({ length: ANCHOR_SLOTS }, () => new Vector3());
  private readonly shared: SharedUniforms;
  private readonly scratch = blankSpec();
  private clock = 0;
  private clockReal = 0;

  constructor(quality: Quality) {
    const cap = CAPACITY[quality];
    this.density = cap.density;
    this.shared = { uTime: { value: 0 }, uTimeReal: { value: 0 }, uAnchors: { value: this.anchors }, uCull: { value: new Vector3() } };
    const atlas = particleAtlas();
    this.solid = new ParticlePool(cap.solid, false, atlas, this.shared);
    this.add = new ParticlePool(cap.add, true, atlas, this.shared);
    this.group.name = 'fx.particles';
    this.group.add(this.solid.mesh, this.add.mesh);
  }

  /** Particle clock (sim seconds). */
  get now(): number {
    return this.clock;
  }

  /** Particle real clock (seconds since the last clear); marks for cull(). */
  get nowReal(): number {
    return this.clockReal;
  }

  /** Fade out (0.1 s, from now) every particle born since `fromReal` (KO debris on the cinematic hand-back). */
  cull(fromReal: number): void {
    this.shared.uCull.value.set(fromReal, this.clockReal, this.clockReal);
  }

  /** A blank spec to fill in and pass to emit() (shared scratch object). */
  spec(): ParticleSpec {
    return Object.assign(this.scratch, BLANK);
  }

  /** Set both colours of the scratch spec from CSS colour strings (start → end over life). */
  colors(p: ParticleSpec, a: string, b: string = a): ParticleSpec {
    tmpA.set(a);
    tmpB.set(b);
    p.r0 = tmpA.r; p.g0 = tmpA.g; p.b0 = tmpA.b;
    p.r1 = tmpB.r; p.g1 = tmpB.g; p.b1 = tmpB.b;
    return p;
  }

  emit(p: ParticleSpec): void {
    (p.additive ? this.add : this.solid).emit(p, this.clock, this.clockReal);
  }

  setAnchor(slot: number, v: Vector3): void {
    this.anchors[slot % ANCHOR_SLOTS]?.copy(v);
  }

  update(dtSim: number, dtReal: number): void {
    this.clock += Math.max(0, dtSim);
    this.clockReal += Math.max(0, dtReal);
    this.shared.uTime.value = this.clock;
    this.shared.uTimeReal.value = this.clockReal;
    this.solid.flush(this.clock, this.clockReal);
    this.add.flush(this.clock, this.clockReal);
  }

  alive(): { solid: number; add: number } {
    return { solid: this.solid.alive(this.clock, this.clockReal), add: this.add.alive(this.clock, this.clockReal) };
  }

  /** Compile both pool programs on the next frames (race intro) instead of at the first burst. */
  warm(): void {
    this.solid.warm();
    this.add.warm();
  }

  clear(): void {
    this.solid.clear();
    this.add.clear();
    this.clock = this.clockReal = 0;
    this.shared.uTime.value = this.shared.uTimeReal.value = 0;
    this.shared.uCull.value.set(0, 0, 0);
  }

  dispose(): void {
    this.solid.dispose();
    this.add.dispose();
    this.group.removeFromParent();
  }
}

const BLANK: Readonly<ParticleSpec> = Object.freeze(blankSpec());
