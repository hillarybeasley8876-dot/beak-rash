// Sunset Pass verges (env-mountain): grass tufts, wildflower clumps and pebbles on the grass beside
// the road, so the slopes next to the asphalt are not bare lawn. Cheap clutter in the unoutlined,
// double-sided cover batch: no occupancy claims (it may sit at a tree's foot), density by quality.
import { Color } from 'three';
import { flowerClump, grassTuft } from '../../scenery/props/cover';
import { crag } from '../../scenery/props/rocks';
import type { Dress } from '../dress';

const PEBBLE = [new Color('#b9b0a4'), new Color('#9d958b'), new Color('#cfc6b8')] as const;
const SPACING = { low: 3.4, medium: 2.4, high: 1.9 } as const;

export function verges(d: Dress, s0: number, s1: number): void {
  const { ctx, place, rng, b, field } = d;
  let n = 0;
  for (const side of [-1, 1] as const) {
    for (let s = s0; s < s1; s += SPACING[ctx.quality] * rng.range(0.6, 1.4)) {
      const g = field.ground(s, side);
      if (g.detached || g.mat !== 'grass' || ctx.q.edgeKindAt(s, side) === 'tunnel') continue;
      const sp = place.spot(s, side, 0.3 + rng.next() ** 1.6 * 9);
      const { x, y, z } = sp.pos;
      if (y < 1.5 || place.slopeRange(sp, 1, 1) > 0.9 || place.onRoad(x, z, 0.3)) continue;
      const buf = b.cover.at(x, z);
      const roll = rng.next();
      if (roll < 0.6) grassTuft(buf, x, y, z, rng, rng.range(0.4, 0.75));
      else if (roll < 0.9) flowerClump(buf, x, y, z, rng);
      else {
        const r = rng.range(0.14, 0.32);
        crag(buf, x, y, z, r * 1.3, r * 0.7, r, rng.range(0, 6.3), rng, rng.pick([...PEBBLE]));
      }
      n++;
    }
  }
  ctx.log(`verges: ${n} tufts / flowers / pebbles`);
}
