// Coast vegetation and rocks: palms (marks + beaches), umbrella pines / cypresses / bushes on the
// grassy hills, boulders on cliff slopes and half-sunk rocks along the rocky shore, island dressing.
import type { Rng } from '../../../core/rng';
import { boulder, bush, cypress, palm, umbrellaPine } from '../../scenery/props/nature';
import type { Dress } from '../dress';

/** Walk s0..s1 with a jittered spacing. */
export function walk(rng: Rng, s0: number, s1: number, spacing: number, fn: (s: number) => void): void {
  for (let s = s0 + rng.range(0, spacing); s < s1; s += spacing * rng.range(0.7, 1.3)) fn(s);
}

const isGrass = (d: Dress, s: number, side: -1 | 1): boolean => {
  const g = d.field.ground(s, side);
  return g.mat === 'grass' && !g.detached;
};

/** Palms along a mark range, u in [u0, u1] beyond the edge, on dry ground. */
export function palms(d: Dress, side: -1 | 1, s0: number, s1: number, u0 = 2.5, u1 = 12, spacing = 12): void {
  const { place, rng, b } = d;
  walk(rng, s0, s1, spacing, (s) => {
    const sp = place.spot(s, side, rng.range(u0, u1));
    if (sp.pos.y < 0.8 || place.slopeRange(sp, 1, 1) > 1.5) return;
    if (!place.free(sp.pos.x, sp.pos.z, 1.6)) return;
    palm(b.thin.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, rng, rng.range(0.9, 1.15));
  });
}

/** Trees and bushes on grassy hillsides (both sides wherever the ground is grass). */
export function hillsides(d: Dress, s0: number, s1: number): void {
  const { place, rng, b } = d;
  for (const side of [-1, 1] as const) {
    walk(rng, s0, s1, 7, (s) => {
      if (!isGrass(d, s, side)) return;
      const u = 4 + Math.pow(rng.next(), 1.6) * 42;
      const sp = place.spot(s, side, u);
      if (sp.pos.y < 1.5) return;
      // Steep faces are drawn as rock: keep trees off them.
      if (place.slopeRange(sp, 2, 2) > 1.6) return;
      const roll = rng.next();
      const r = roll < 0.45 ? 1.4 : 2.6;
      if (!place.free(sp.pos.x, sp.pos.z, r)) return;
      const buf = b.props.at(sp.pos.x, sp.pos.z);
      if (roll < 0.45) bush(buf, sp.pos.x, sp.pos.y, sp.pos.z, rng, rng.range(0.9, 1.4), rng.chance(0.35));
      else if (roll < 0.75) umbrellaPine(buf, sp.pos.x, sp.pos.y, sp.pos.z, rng, rng.range(0.9, 1.25));
      else cypress(buf, sp.pos.x, sp.pos.y, sp.pos.z, rng, rng.range(0.9, 1.2));
    });
  }
}

/** Boulders on rock slopes beyond the edge and half-sunk rocks where the shore meets the sea. */
export function rocks(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  walk(rng, s0, s1, 9, (s) => {
    const sp = place.spot(s, side, rng.range(3, 30));
    if (sp.pos.y > 12 && rng.chance(0.5)) return;
    if (!place.free(sp.pos.x, sp.pos.z, 1.8)) return;
    const size = sp.pos.y < 0.5 ? rng.range(1.2, 2.6) : rng.range(0.6, 1.6);
    boulder(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y - size * 0.3, sp.pos.z, rng, size);
  });
}

/** Palms and rocks on the landmark islands (bumps), placed by world position. */
export function islands(d: Dress): void {
  const { place, rng, b, field } = d;
  for (const bump of field.bumps) {
    const n = bump.mat === 'rock' ? 10 : 8;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2), r = bump.r * Math.sqrt(rng.next()) * 0.7;
      const x = bump.x + Math.cos(a) * r, z = bump.z + Math.sin(a) * r;
      const p = place.world(x, z);
      if (p.y < 0.6 || !place.claim(x, z, 2)) continue;
      if (bump.mat === 'rock') boulder(b.props.at(x, z), x, p.y - 0.5, z, rng, rng.range(1.5, 3.5));
      else if (bump.mat === 'grass' && rng.chance(0.75)) palm(b.thin.at(x, z), x, p.y, z, rng, rng.range(1, 1.3));
      else bush(b.props.at(x, z), x, p.y, z, rng, 1.3);
    }
  }
}

/** Forest patches on the far hills (beyond the near ribbon), density from world noise. */
export function farForest(d: Dress, s0: number, s1: number): void {
  const { place, rng, b, field } = d;
  for (const side of [-1, 1] as const) {
    for (let s = s0; s < s1; s += 9) {
      if (field.ground(s, side).mat === 'sand' && side < 0) continue;
      const u = 50 + Math.pow(rng.next(), 1.3) * 230;
      const sp = place.spot(s + rng.range(-4, 4), side, u);
      if (sp.pos.y < 3) continue;
      const patch = field.noise.get(sp.pos.x / 140, sp.pos.z / 140);
      if (patch < 0.0 || rng.chance(0.3)) continue;
      // A small grove around the sample point.
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const x = sp.pos.x + rng.range(-9, 9), z = sp.pos.z + rng.range(-9, 9);
        if (!place.claim(x, z, 2.6)) continue;
        const y = d.ctx.groundWorld(x, z);
        if (y < 3) continue;
        const buf = b.far.at(x, z);
        if (rng.chance(0.6)) umbrellaPine(buf, x, y, z, rng, rng.range(1, 1.5));
        else cypress(buf, x, y, z, rng, rng.range(1, 1.4));
      }
    }
  }
}
