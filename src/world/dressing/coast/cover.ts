// Ground cover and olive terraces (coast). Cover: grass tufts, flower clumps and pebbles on grassy
// ground beyond the drivable edge, dense near the road and thinning out to ~45 m (never on sand,
// rock faces, water or another road part). Terraces: rows of olive trees behind dry-stone walls
// climbing the gentle land-side slopes between the villas.
import type { Vector3 } from 'three';
import { flowerClump, grassTuft, oliveTree, stoneWall } from '../../scenery/props/cover';
import { crag, LIMESTONE } from '../../scenery/props/rocks';
import { wallHeight } from '../../terrain/crag';
import type { Dress } from '../dress';
import { walk } from './nature';

/** Ground cover; quality=medium plants half as much (quality=low none: dressing/coast/index.ts). */
export function groundCover(d: Dress, s0: number, s1: number): void {
  const { place, rng, field, ctx, b } = d;
  const step = ctx.quality === 'high' ? 1.2 : 2.4;
  for (const side of [-1, 1] as const) {
    for (let s = s0; s < s1; s += step) {
      const g = field.ground(s, side);
      if (g.detached || (g.mat !== 'grass' && g.mat !== 'rock') || ctx.q.edgeKindAt(s, side) === 'tunnel') continue;
      const wall = wallHeight(g, field.edgeY(s, side), ctx.q.frameVis(s).pos.y) > 0 ? g.stepW + 0.8 : 0;
      for (let i = 0; i < 3; i++) {
        const sp = place.spot(s + rng.range(-0.6, 0.6), side, wall + 0.6 + Math.pow(rng.next(), 2.2) * 44);
        const { x, y, z } = sp.pos;
        if (y < 0.6 || place.slopeRange(sp, 1, 1) > 0.8 || place.onRoad(x, z, 0.5) || !place.claim(x, z, 0.2)) continue;
        const buf = b.cover.at(x, z), r = rng.next();
        if (r < 0.74) grassTuft(buf, x, y, z, rng, rng.range(0.35, 0.6));
        else if (r < 0.94) flowerClump(buf, x, y, z, rng);
        else {
          const sx = rng.range(0.15, 0.35), sy = rng.range(0.1, 0.22), sz = rng.range(0.15, 0.3);
          crag(buf, x, y - 0.05, z, sx, sy, sz, rng.range(0, 6.3), rng, rng.pick([...LIMESTONE]));
        }
      }
    }
  }
}

/** Olive terraces on the land side (right) between s0 and s1, in 36–60 m blocks. */
export function oliveTerraces(d: Dress, s0: number, s1: number): void {
  const { place, rng, b, field } = d;
  for (let s = s0 + rng.range(0, 20); s < s1 - 30; s += rng.range(55, 85)) {
    const g = field.ground(s, d.side(1));
    if (g.mat !== 'grass' || g.detached || !rng.chance(0.75)) continue;
    const len = Math.min(rng.range(36, 60), s1 - s);
    for (const u of [rng.range(12, 15), rng.range(21, 25), rng.range(30, 35)]) {
      let prev: Vector3 | null = null;
      for (let ss = s; ss <= s + len; ss += 4) {
        const sp = place.spot(ss, d.side(1), u - 1.4);
        const ok = sp.pos.y > 1 && !place.onRoad(sp.pos.x, sp.pos.z, 2) && place.claim(sp.pos.x, sp.pos.z, 0.5);
        if (ok && prev && Math.abs(sp.pos.y - prev.y) < 2.5) stoneWall(b.props.at(sp.pos.x, sp.pos.z), prev, sp.pos, 0.55);
        prev = ok ? sp.pos : null;
      }
      walk(rng, s, s + len, 5.5, (ss) => {
        const sp = place.spot(ss, d.side(1), u + rng.range(0.6, 2));
        if (sp.pos.y < 1 || place.slopeRange(sp, 2, 2) > 2.5 || !place.free(sp.pos.x, sp.pos.z, 1.5)) return;
        oliveTree(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, rng, rng.range(0.85, 1.15));
      });
    }
  }
}
