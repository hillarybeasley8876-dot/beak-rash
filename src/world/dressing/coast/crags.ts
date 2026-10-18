// Craggy rock walls (coast): faceted limestone rocks, scrub and the odd pine along the top lip of
// every rising rock face (terrain/crag.ts), so the wall's silhouette breaks up against the sky.
import { bush, cypress, umbrellaPine } from '../../scenery/props/nature';
import { cragCluster } from '../../scenery/props/rocks';
import { wallHeight } from '../../terrain/crag';
import type { Dress } from '../dress';
import { walk } from './nature';

export function cragTops(d: Dress, s0: number, s1: number): void {
  const { place, rng, b, field, ctx } = d;
  for (const side of [-1, 1] as const) {
    walk(rng, s0, s1, 3.2, (s) => {
      if (ctx.q.edgeKindAt(s, side) === 'tunnel') return;
      const g = field.ground(s, side);
      if (wallHeight(g, field.edgeY(s, side), ctx.q.frameVis(s).pos.y) <= 0) return;
      const sp = place.spot(s, side, g.stepW + rng.range(1.0, 4.0));
      const { x, y, z } = sp.pos;
      if (!place.free(x, z, 0.9, 1.4)) return;
      const roll = rng.next();
      if (roll < 0.58) cragCluster(b.props.at(x, z), x, y - 0.25, z, rng.range(0.8, 1.8), rng);
      else if (roll < 0.88) bush(b.props.at(x, z), x, y, z, rng, rng.range(0.9, 1.5), rng.chance(0.3));
      else if (roll < 0.95) umbrellaPine(b.props.at(x, z), x, y, z, rng, rng.range(0.7, 0.95));
      else cypress(b.props.at(x, z), x, y, z, rng, rng.range(0.7, 0.9));
    });
  }
}

/** Rocky shore skirts where the land meets the cove at both ends of every bridge (no straight terrain cut). */
export function bridgeShores(d: Dress): void {
  const { place, rng, b, ctx } = d;
  for (const f of ctx.L.features) {
    if (f.kind !== 'bridge') continue;
    for (const [sEnd, dir] of [[f.s0, -1], [f.s1, 1]] as Array<[number, number]>) {
      for (const side of [-1, 1] as const) {
        for (let u = 1; u < 56; u += rng.range(1.6, 2.8)) {
          const sp = place.spot(sEnd + dir * rng.range(-6, 10), side, u);
          const { x, y, z } = sp.pos;
          if (y < -1.5 || y > 4 || !place.free(x, z, 1.2, 1.0)) continue;
          cragCluster(b.props.at(x, z), x, y - 0.5, z, rng.range(1.4, 3.2), rng);
        }
      }
    }
  }
}
