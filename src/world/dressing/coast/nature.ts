// Coast vegetation and rocks: palms (marks + beaches), umbrella pines / cypresses / bushes on the
// grassy hills, limestone rocks on cliff slopes and half-sunk along the rocky shore, island dressing.
import type { Rng } from '../../../core/rng';
import { bush, cypress, palm, umbrellaPine } from '../../scenery/props/nature';
import { cragCluster } from '../../scenery/props/rocks';
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

/** Flowering hedge bushes just behind the edge (bougainvillea-pink and yellow broom). */
export function hedges(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  walk(rng, s0, s1, 6, (s) => {
    if (!isGrass(d, s, side)) return;
    // Bush spheres reach ~1.85 × scale from the centre: keep every leaf ≥ 0.2 m beyond the bound.
    const scale = rng.range(0.75, 1.0);
    const sp = place.spot(s, side, 1.85 * scale + 0.2 + rng.range(0, 1.2));
    if (sp.pos.y < 0.6 || place.slopeRange(sp, 1.5, 1.5) > 1.2 || !place.free(sp.pos.x, sp.pos.z, 1.1, 0.9)) return;
    bush(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, rng, scale, rng.chance(0.75));
  });
}

/** Trees and bushes on grassy hillsides (both sides wherever the ground is grass). */
export function hillsides(d: Dress, s0: number, s1: number): void {
  const { place, rng, b } = d;
  for (const side of [-1, 1] as const) {
    walk(rng, s0, s1, 5, (s) => {
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
    cragCluster(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y - size * 0.3, sp.pos.z, size, rng);
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
      if (bump.mat === 'rock') cragCluster(b.props.at(x, z), x, p.y - 0.5, z, rng.range(1.5, 3.5), rng);
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
      if (field.ground(s, side).mat === 'sand') continue;   // the sea side has no forest
      const u = 50 + Math.pow(rng.next(), 1.3) * 230;
      const sp = place.spot(s + rng.range(-4, 4), side, u);
      if (sp.pos.y < 3) continue;
      const patch = field.noise.get(sp.pos.x / 140, sp.pos.z / 140);
      if (patch < 0.0 || rng.chance(0.3)) continue;
      // A small grove around the sample point.
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const x = sp.pos.x + rng.range(-9, 9), z = sp.pos.z + rng.range(-9, 9);
        // free() also keeps groves off other road parts (hairpins, the calanque's far leg).
        if (!place.free(x, z, 2.6)) continue;
        const y = d.ctx.groundWorld(x, z);
        if (y < 3) continue;
        const buf = b.far.at(x, z);
        if (rng.chance(0.6)) umbrellaPine(buf, x, y, z, rng, rng.range(1, 1.5));
        else cypress(buf, x, y, z, rng, rng.range(1, 1.4));
      }
    }
  }
}

/** Mid-ground (45–150 m out): bush clumps, limestone outcrops and cypress lines on the hills, so the
 *  slopes between the roadside cover and the far groves are not bare gradients (far batch, no outline). */
export function midGround(d: Dress, s0: number, s1: number): void {
  const { place, rng, b, field } = d;
  for (const side of [-1, 1] as const) {
    walk(rng, s0, s1, 9, (s) => {
      const sp = place.spot(s, side, rng.range(45, 150));
      const { x, y, z } = sp.pos;
      if (y < 2.5 || field.noise.get(x / 90, z / 90) < -0.3) return;
      const roll = rng.next(), steep = place.slopeRange(sp, 3, 3) > 2.4;
      if (steep || roll < 0.22) {
        if (place.free(x, z, 3)) cragCluster(b.far.at(x, z), x, y - 0.6, z, rng.range(2, 4), rng);
        return;
      }
      const line = roll > 0.7, yaw = rng.range(0, Math.PI * 2);
      for (let i = 0, n = rng.int(2, line ? 5 : 4); i < n; i++) {
        const px = line ? x + Math.cos(yaw) * i * 3.2 : x + rng.range(-4, 4);
        const pz = line ? z + Math.sin(yaw) * i * 3.2 : z + rng.range(-4, 4);
        if (!place.free(px, pz, 1.6)) continue;
        const py = d.ctx.groundWorld(px, pz);
        if (py < 2.5) continue;
        if (line) cypress(b.far.at(px, pz), px, py, pz, rng, rng.range(0.9, 1.25));
        else bush(b.far.at(px, pz), px, py, pz, rng, rng.range(1.3, 2.1), rng.chance(0.25));
      }
    });
  }
}
