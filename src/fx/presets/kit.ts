// Shared helpers for particle presets: options, cosmetic RNG, random directions, count scaling.
import { Vector3 } from 'three';
import { Rng } from '../../core/rng';
import type { Vec3Like } from '../../core/types';
import type { Particles } from '../particles/system';
import type { ParticleSpec } from '../particles/pool';

export interface BurstOpts {
  count?: number;          // override the preset's base count
  color?: string;          // main tint (feathers, fur, confetti base…)
  dir?: Vec3Like;          // main direction (hit direction, travel direction)
  scale?: number;          // size/speed multiplier
  ground?: number;         // world Y of the road under the effect (debris lands there)
  vel?: Vec3Like;          // source velocity inherited by the particles (moving riders)
  follow?: number;         // anchor slot for rider-attached effects (spin swirls)
  level?: number;          // drift level / intensity tiers
  color2?: string;         // secondary tint
}

export interface Kit {
  readonly p: Particles;
  readonly rng: Rng;
  /** Final count: opts.count or base × scale × quality density, at least 1. */
  n(base: number, o: BurstOpts): number;
  /** Fresh spec positioned at pos (plus random jitter radius). */
  at(pos: Vec3Like, jitter?: number): ParticleSpec;
  /** Random unit vector into `out`, biased by `dir` with spread 0 (laser) .. 1 (sphere). */
  dir(out: Vector3, dir: Vec3Like | undefined, spread: number): Vector3;
  range(lo: number, hi: number): number;
}

export type Preset = (k: Kit, pos: Vec3Like, o: BurstOpts) => void;

const UP = new Vector3(0, 1, 0);
const tmp = new Vector3();

export function createKit(p: Particles, seed = 0xbea4): Kit {
  const rng = new Rng(seed);
  const kit: Kit = {
    p,
    rng,
    n: (base, o) => Math.max(1, Math.round(o.count ?? base * (o.scale ?? 1) ** 0.5 * p.density)),
    at: (pos, jitter = 0) => {
      const s = p.spec();
      s.x = pos.x + (jitter ? rng.range(-jitter, jitter) : 0);
      s.y = pos.y + (jitter ? rng.range(-jitter, jitter) : 0);
      s.z = pos.z + (jitter ? rng.range(-jitter, jitter) : 0);
      return s;
    },
    dir: (out, dir, spread) => {
      // Uniform sphere sample, then blend toward dir.
      const u = rng.range(-1, 1);
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(1 - u * u);
      out.set(r * Math.cos(a), u, r * Math.sin(a));
      const d = dir ? tmp.set(dir.x, dir.y, dir.z) : UP;
      if (d.lengthSq() < 1e-6) return out;
      tmp.copy(d).normalize();
      return out.multiplyScalar(spread).addScaledVector(tmp, 1 - spread).normalize();
    },
    range: (lo, hi) => rng.range(lo, hi),
  };
  return kit;
}

/** Carry the source's velocity (scaled) as the particle's frame velocity (not slowed by drag). */
export function inherit(s: ParticleSpec, o: BurstOpts, factor: number, damping = 0): void {
  if (!o.vel) return;
  s.fx = o.vel.x * factor;
  s.fy = o.vel.y * factor;
  s.fz = o.vel.z * factor;
  s.fk = damping;
}

/** Set spec velocity = dir × speed. */
export function launch(s: ParticleSpec, d: Vector3, speed: number): void {
  s.vx = d.x * speed;
  s.vy = d.y * speed;
  s.vz = d.z * speed;
}
