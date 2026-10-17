// One instanced particle pool (one draw call): a ring buffer of spawn records in an interleaved
// instanced buffer. Only freshly written slots are uploaded each frame.
import {
  AdditiveBlending, DoubleSide, DynamicDrawUsage, InstancedBufferGeometry, InstancedInterleavedBuffer,
  InterleavedBufferAttribute, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, type IUniform, type Texture,
} from 'three';
import { ATLAS_COLS } from './atlas';
import { PARTICLE_FRAG, PARTICLE_VERT } from './shaders';

export const STRIDE = 32;

/** Mutable spawn record (reused by presets; never keep a reference). */
export interface ParticleSpec {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; delay: number;
  size0: number; size1: number; rot: number; spin: number;
  r0: number; g0: number; b0: number; r1: number; g1: number; b1: number;
  frame: number; mode: number; follow: number;
  drag: number; gravity: number; ground: number; k: number;
  fx: number; fy: number; fz: number; fk: number;
  additive: boolean;
  erode: boolean;          // thin out via rising alpha threshold instead of shrinking (rings)
  realtime: boolean;       // ages in real time: impact pops play out even in slow-mo / hit-stop
}

export function blankSpec(): ParticleSpec {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, delay: 0, size0: 0.2, size1: 0.2, rot: 0, spin: 0,
    r0: 1, g0: 1, b0: 1, r1: 1, g1: 1, b1: 1, frame: 0, mode: 0, follow: -1,
    drag: 0, gravity: 0, ground: -1e5, k: 0, fx: 0, fy: 0, fz: 0, fk: 0, additive: false, erode: false, realtime: false,
  };
}

export interface SharedUniforms { uTime: IUniform<number>; uTimeReal: IUniform<number>; uAnchors: IUniform<unknown> }

export class ParticlePool {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly capacity: number;
  private readonly data: Float32Array;
  private readonly buffer: InstancedInterleavedBuffer;
  private head = 0;
  private written = 0;      // slots written since the last flush (from writeStart)
  private writeStart = 0;
  private lastDeath = -1;
  private lastDeathReal = -1;

  constructor(capacity: number, additive: boolean, atlas: Texture, shared: SharedUniforms) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * STRIDE);
    // Park every slot in the past so nothing draws before it is written.
    for (let i = 0; i < capacity; i++) this.park(i);
    this.buffer = new InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buffer.setUsage(DynamicDrawUsage);
    const quad = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.setIndex(quad.getIndex());
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    ['aP', 'aV', 'aS', 'aCA', 'aCB', 'aX', 'aF', 'aT'].forEach((name, i) => {
      geo.setAttribute(name, new InterleavedBufferAttribute(this.buffer, 4, i * 4));
    });
    geo.instanceCount = capacity;
    const material = new ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: { uTime: shared.uTime, uTimeReal: shared.uTimeReal, uAnchors: shared.uAnchors, uAtlasCols: { value: ATLAS_COLS }, tAtlas: { value: atlas } },
      defines: additive ? { FX_ADDITIVE: '' } : {},
      transparent: additive,
      depthWrite: !additive,
      blending: additive ? AdditiveBlending : NormalBlending,
      side: DoubleSide,
    });
    material.name = additive ? 'fx.particles.add' : 'fx.particles.solid';
    this.mesh = new Mesh(geo, material);
    this.mesh.name = material.name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 5;
    this.mesh.visible = false;
  }

  /** Write one particle at sim clock `now` / real clock `nowReal`. */
  emit(p: ParticleSpec, now: number, nowReal: number): void {
    const slot = this.head;
    this.head = (this.head + 1) % this.capacity;
    if (this.written === 0) this.writeStart = slot;
    this.written = Math.min(this.capacity, this.written + 1);
    const d = this.data;
    const o = slot * STRIDE;
    const birth = now + p.delay;
    d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = birth;
    d[o + 4] = p.vx; d[o + 5] = p.vy; d[o + 6] = p.vz; d[o + 7] = p.life;
    d[o + 8] = p.size0; d[o + 9] = p.size1; d[o + 10] = p.rot; d[o + 11] = p.spin;
    d[o + 12] = p.r0; d[o + 13] = p.g0; d[o + 14] = p.b0; d[o + 15] = p.frame;
    d[o + 16] = p.r1; d[o + 17] = p.g1; d[o + 18] = p.b1; d[o + 19] = p.mode + 8 * (p.follow + 1) + (p.erode ? 256 : 0) + (p.realtime ? 512 : 0);
    d[o + 20] = p.drag; d[o + 21] = p.gravity; d[o + 22] = p.ground; d[o + 23] = p.k;
    d[o + 24] = p.fx; d[o + 25] = p.fy; d[o + 26] = p.fz; d[o + 27] = p.fk;
    d[o + 28] = nowReal + p.delay; d[o + 29] = 0; d[o + 30] = 0; d[o + 31] = 0;
    if (p.realtime) this.lastDeathReal = Math.max(this.lastDeathReal, nowReal + p.delay + p.life);
    else this.lastDeath = Math.max(this.lastDeath, birth + p.life);
  }

  /** Upload fresh slots and hide the mesh when everything is dead. */
  flush(now: number, nowReal: number): void {
    if (this.written > 0) {
      const end = this.writeStart + this.written;
      if (end <= this.capacity) this.buffer.addUpdateRange(this.writeStart * STRIDE, this.written * STRIDE);
      else {
        this.buffer.addUpdateRange(this.writeStart * STRIDE, (this.capacity - this.writeStart) * STRIDE);
        this.buffer.addUpdateRange(0, (end - this.capacity) * STRIDE);
      }
      this.buffer.needsUpdate = true;
      this.written = 0;
    }
    this.mesh.visible = now < this.lastDeath || nowReal < this.lastDeathReal;
  }

  /** Number of live particles (debug only: scans the pool). */
  alive(now: number, nowReal: number): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) {
      const o = i * STRIDE;
      const real = (this.data[o + 19] ?? 0) >= 512;
      const age = real ? nowReal - (this.data[o + 28] ?? 0) : now - (this.data[o + 3] ?? 0);
      if (age >= 0 && age < (this.data[o + 7] ?? 0)) n++;
    }
    return n;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) this.park(i);
    this.buffer.clearUpdateRanges();
    this.buffer.needsUpdate = true;
    this.written = 0;
    this.lastDeath = -1;
    this.lastDeathReal = -1;
    this.mesh.visible = false;
  }

  /** Put a slot's births far in the past (both domains) so it never draws. */
  private park(i: number): void {
    this.data[i * STRIDE + 3] = -1e6;
    this.data[i * STRIDE + 7] = 1e-3;
    this.data[i * STRIDE + 28] = -1e6;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}
