// Sunset Pass forests (env-mountain): roadside pines / firs / golden birches with a density per zone,
// boulders on rocky ground, and unoutlined far forests on the mountainsides.
import { zoneAt } from '../../layout/build';
import { boulder } from '../../scenery/props/nature';
import { birch, farPine, fir, pine } from '../../scenery/props/mountain-trees';
import type { Dress } from '../dress';
import { walk } from '../coast/nature';

/** Tree spacing (m) and reach beyond the edge per zone; 0 = no roadside trees. */
const DENSITY: Record<string, { spacing: number; u0: number; u1: number; birch: number }> = {
  start: { spacing: 0, u0: 0, u1: 0, birch: 0 },
  village: { spacing: 16, u0: 14, u1: 40, birch: 0.5 },
  pines: { spacing: 4.2, u0: 3.5, u1: 50, birch: 0.12 },
  hairpin: { spacing: 9, u0: 6, u1: 40, birch: 0.1 },
  leg: { spacing: 6, u0: 4.5, u1: 40, birch: 0.15 },
  cliff: { spacing: 9, u0: 4, u1: 40, birch: 0.05 },
  cutting: { spacing: 0, u0: 0, u1: 0, birch: 0 },
  portal: { spacing: 0, u0: 0, u1: 0, birch: 0 },
  bridgeExit: { spacing: 7, u0: 4, u1: 30, birch: 0 },
  summit: { spacing: 13, u0: 6, u1: 45, birch: 0 },
  crest: { spacing: 0, u0: 0, u1: 0, birch: 0 },
  descent: { spacing: 4.6, u0: 3.5, u1: 50, birch: 0.18 },
  chicane: { spacing: 7, u0: 4, u1: 36, birch: 0.2 },
  lake: { spacing: 14, u0: 6, u1: 40, birch: 0.7 },
  lakeside: { spacing: 18, u0: 5, u1: 30, birch: 0.8 },
  finish: { spacing: 0, u0: 0, u1: 0, birch: 0 },
};

/** True where the ground at the spot is too steep for a tree (rock faces, gorge walls). */
function steep(d: Dress, sp: ReturnType<Dress['place']['spot']>): boolean {
  return d.place.slopeRange(sp, 2, 2) > 1.5;
}

export function roadsideTrees(d: Dress, s0: number, s1: number): void {
  const { ctx, place, rng, b, field } = d;
  for (const side of [-1, 1] as const) {
    let s = s0;
    while (s < s1) {
      const zone = zoneAt(ctx.L, s) ?? 'pines';
      const z = DENSITY[zone] ?? DENSITY.pines;
      if (!z || z.spacing <= 0) { s += 8; continue; }
      s += z.spacing * rng.range(0.6, 1.4);
      const g = field.ground(s, side);
      if (g.detached || ctx.q.edgeKindAt(s, side) === 'tunnel') continue;
      const u = z.u0 + Math.pow(rng.next(), 1.4) * (z.u1 - z.u0);
      const sp = place.spot(s, side, u);
      if (sp.pos.y < 2.5 || steep(d, sp) || !place.free(sp.pos.x, sp.pos.z, 2.2)) continue;
      const buf = b.props.at(sp.pos.x, sp.pos.z);
      const roll = rng.next();
      if (roll < z.birch) birch(buf, sp.pos.x, sp.pos.y, sp.pos.z, rng, rng.range(0.9, 1.2));
      else if (roll < z.birch + (1 - z.birch) * 0.62) pine(buf, sp.pos.x, sp.pos.y, sp.pos.z, rng, rng.range(0.85, 1.25));
      else fir(buf, sp.pos.x, sp.pos.y, sp.pos.z, rng, rng.range(0.85, 1.2));
    }
  }
}

/** Boulders on rocky stretches: near the foot of walls and scattered on the slopes. */
export function boulders(d: Dress, s0: number, s1: number, every = 11): void {
  const { place, rng, b } = d;
  for (const side of [-1, 1] as const) {
    walk(rng, s0, s1, every, (s) => {
      if (d.field.ground(s, side).detached) return;
      const sp = place.spot(s, side, rng.range(1.5, 26));
      if (sp.pos.y < 1 || place.slopeRange(sp, 2, 2) > 2.5 || !place.free(sp.pos.x, sp.pos.z, 1.6)) return;
      const size = rng.range(0.7, 1.9);
      boulder(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y - size * 0.25, sp.pos.z, rng, size);
    });
  }
}

/** Unoutlined pine stands on the mountainsides 60–300 m from the road (patches from world noise). */
export function farForest(d: Dress, s0: number, s1: number): void {
  const { place, rng, b, field, ctx } = d;
  let n = 0;
  for (const side of [-1, 1] as const) {
    for (let s = s0; s < s1; s += 8) {
      const u = 60 + Math.pow(rng.next(), 1.2) * 240;
      const sp = place.spot(s + rng.range(-4, 4), side, u);
      const patch = field.noise.get(sp.pos.x / 120, sp.pos.z / 120);
      if (patch < -0.05 || rng.chance(0.25) || sp.pos.y < 4 || sp.pos.y > 230) continue;
      const count = rng.int(3, 7);
      for (let i = 0; i < count; i++) {
        const x = sp.pos.x + rng.range(-11, 11), z = sp.pos.z + rng.range(-11, 11);
        const y = ctx.groundWorld(x, z);
        if (y < 4 || y > 240 || place.onRoad(x, z, 8) || !place.claim(x, z, 2.4)) continue;
        // Skip cliffs: sample the slope over 6 m.
        const dy = Math.abs(ctx.groundWorld(x + 3, z) - ctx.groundWorld(x - 3, z)) + Math.abs(ctx.groundWorld(x, z + 3) - ctx.groundWorld(x, z - 3));
        if (dy > 7) continue;
        farPine(b.far.at(x, z), x, y, z, rng, rng.range(0.9, 1.4));
        n++;
      }
    }
  }
  console.info(`[mountain] far forest: ${n} trees`);
}
