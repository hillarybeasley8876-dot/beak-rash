// Sunset Pass sky life (env-mountain): picks sites for the wind turbines (highest far ridge points on
// the land side of the descent), the cable car across the descent valley, and balloons over the lake.
import { Vector3 } from 'three';
import { buildBalloons, type BalloonSite } from '../../env/mountain-balloons';
import { buildRopeway } from '../../env/mountain-ropeway';
import { buildTurbines, type TurbineSite } from '../../env/mountain-turbines';
import { sagAt } from '../../scenery/props/mountain-deco';
import type { Dress } from '../dress';

/** Highest points on `side` between s0..s1 at u 260–560 m, at least `gap` m apart. */
function ridgeSites(d: Dress, side: -1 | 1, s0: number, s1: number, count: number, gap: number): TurbineSite[] {
  const { place, ctx } = d;
  const cand: TurbineSite[] = [];
  for (let s = s0; s <= s1; s += 20) {
    for (const u of [260, 330, 400, 480, 560]) {
      const sp = place.spot(s, side, u);
      const y = ctx.groundWorld(sp.pos.x, sp.pos.z);
      if (!place.onRoad(sp.pos.x, sp.pos.z, 180)) cand.push({ x: sp.pos.x, y, z: sp.pos.z });
    }
  }
  cand.sort((a, b) => b.y - a.y);
  const out: TurbineSite[] = [];
  for (const c of cand) {
    if (out.length >= count) break;
    if (out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) > gap)) out.push(c);
  }
  return out;
}

export function turbines(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const sites = ridgeSites(d, side, s0, s1, 7, 120);
  if (!sites.length) return;
  // Rotors face the middle of the course so riders see the discs, not the edges.
  const fr = d.ctx.q.frameVis((s0 + s1) / 2);
  const cx = sites.reduce((a, s) => a + s.x, 0) / sites.length, cz = sites.reduce((a, s) => a + s.z, 0) / sites.length;
  const facing = new Vector3(fr.pos.x - cx, 0, fr.pos.z - cz).normalize();
  buildTurbines(d.ctx, (x, z) => d.b.far.at(x, z), sites, facing, d.rng);
}

/** Cable car crossing high over the road at s: valley station on `side`, mountain station opposite. */
export function cableCar(d: Dress, s: number, side: -1 | 1): void {
  const { place, ctx } = d;
  const lo = place.spot(s, side, 46), hi = place.spot(s + 35, side < 0 ? 1 : -1, 150);
  const a = lo.pos.clone().setY(ctx.groundWorld(lo.pos.x, lo.pos.z) + 13);
  const b = hi.pos.clone().setY(ctx.groundWorld(hi.pos.x, hi.pos.z) + 13);
  const sag = a.distanceTo(b) * 0.04;
  // Keep at least 16 m between the cable (gondolas hang 4.5 m) and anything below it.
  let worst = Infinity;
  const tmp = new Vector3();
  for (let i = 1; i < 40; i++) {
    const p = sagAt(a, b, i / 40, sag, tmp);
    worst = Math.min(worst, p.y - ctx.groundWorld(p.x, p.z));
  }
  if (worst < 16) {
    a.y += 16 - worst;
    b.y += 16 - worst;
  }
  place.claim(a.x, a.z, 9);
  place.claim(b.x, b.z, 9);
  buildRopeway(ctx, (x, z) => d.b.props.at(x, z), { a, b, sag }, d.rng);
}

/** Balloons over the water: one per [s, side], 160–420 m out, 55–130 m above the road there. */
export function balloons(d: Dress, at: Array<[number, -1 | 1]>): void {
  const { place, rng, ctx } = d;
  const sites: BalloonSite[] = at.map(([s, side]) => {
    const sp = place.spot(s, side, rng.range(160, 420));
    return { x: sp.pos.x, y: ctx.q.frameVis(s).pos.y + rng.range(55, 130), z: sp.pos.z };
  });
  buildBalloons(ctx, sites, rng);
}
