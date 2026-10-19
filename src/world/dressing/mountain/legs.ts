// Sunset Pass switchback legs (env-mountain): the straights between the hairpins were wide bare grass
// slopes. Every 20–30 m each side now has something to read at speed: boulder clusters and scree fans
// on the cut (uphill) slope, a split-rail fence and a trail signpost per leg, and prayer-flag lines
// strung down the fall-away beyond the rail with boulders below it.
import { Color } from 'three';
import type { PropBatch } from '../../kit/batch';
import { grassTuft } from '../../scenery/props/cover';
import { bevelRock, GRANITE } from '../../scenery/props/mountain-granite';
import { fence } from '../../scenery/props/mountain-deco';
import { crag } from '../../scenery/props/rocks';
import type { Dress } from '../dress';
import { prayerFlagLine } from './landmarks';
import { scenicSign } from './signage';
import { zones } from './util';

const SCREE = [new Color('#c2b2a2'), new Color('#a89585'), new Color('#d3c4b2')] as const;
/** One trail signpost per leg (in leg order): brown scenic board, title / subtitle / English. */
const LEG_SIGNS = [['前方还有 两个回头弯', 'TWO MORE HAIRPINS'], ['最后一弯 鹈鹕加油', 'ONE MORE BEND!']] as const;
export const LEG_TEXTS = LEG_SIGNS.flat();

/** A big half-buried bevelled boulder with 1–2 smaller ones and grass at its foot. */
function boulderCluster(d: Dress, rocks: PropBatch, s: number, side: -1 | 1, u: number): boolean {
  const { place, rng, ctx, b } = d;
  const sp = place.spot(s, side, u);
  const r = rng.range(1.0, 1.7);
  if (!place.free(sp.pos.x, sp.pos.z, r * 1.5)) return false;
  const pile = [{ dx: 0, dz: 0, r }];
  for (let i = rng.int(1, 2); i > 0; i--) {
    const a = rng.range(0, 6.3), dd = r * rng.range(1.0, 1.5);
    pile.push({ dx: Math.cos(a) * dd, dz: Math.sin(a) * dd, r: r * rng.range(0.35, 0.6) });
  }
  for (const p of pile) {
    const x = sp.pos.x + p.dx, z = sp.pos.z + p.dz, y = ctx.groundWorld(x, z);
    bevelRock(rocks.at(x, z), x, y + p.r * 0.2, z, p.r * rng.range(1.0, 1.35), p.r * rng.range(0.7, 0.95), p.r, rng.range(0, 6.3), rng, rng.pick([...GRANITE]));
    const ta = rng.range(0, 6.3), tx = x + Math.cos(ta) * p.r * 1.1, tz = z + Math.sin(ta) * p.r * 1.1;
    grassTuft(b.cover.at(tx, tz), tx, ctx.groundWorld(tx, tz), tz, rng, rng.range(0.45, 0.7));
  }
  return true;
}

/** Scree fan: a rock outcrop up the slope shedding a widening fan of stones toward the road. */
function screeFan(d: Dress, rocks: PropBatch, s: number, side: -1 | 1): boolean {
  const { place, rng, b } = d;
  const top = place.spot(s, side, rng.range(7, 10));
  const r = rng.range(1.1, 1.6);
  if (!place.free(top.pos.x, top.pos.z, r * 1.4)) return false;
  bevelRock(rocks.at(top.pos.x, top.pos.z), top.pos.x, top.pos.y + r * 0.15, top.pos.z, r * 1.3, r, r, top.faceRoad, rng, rng.pick([...GRANITE]));
  for (let i = 0; i < 16; i++) {
    const t = Math.pow(rng.next(), 0.7);
    const p = place.spot(s + (rng.next() - 0.5) * (1.5 + t * 7), side, top.u - r - t * (top.u - r - 1.6));
    if (place.onRoad(p.pos.x, p.pos.z, 0.4)) continue;
    const q = rng.range(0.16, 0.34) * (1.25 - t * 0.5);
    crag(b.cover.at(p.pos.x, p.pos.z), p.pos.x, p.pos.y, p.pos.z, q * 1.3, q * 0.6, q, rng.range(0, 6.3), rng, rng.pick([...SCREE]));
  }
  return true;
}

/** Split-rail fence on the uphill shoulder over [s0, s1], posts on the ground. */
function shoulderFence(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, ctx } = d;
  const a = place.spot(s0, side, 3.2), c = place.spot(s1, side, 3.2);
  const mid = place.spot((s0 + s1) / 2, side, 3.2);
  for (const sp of [a, mid, c]) place.claim(sp.pos.x, sp.pos.z, 0.6);
  const gy = (x: number, z: number): number => ctx.groundWorld(x, z);
  fence(d.b.props.at(mid.pos.x, mid.pos.z), a.pos, mid.pos, gy);
  fence(d.b.props.at(mid.pos.x, mid.pos.z), mid.pos, c.pos, gy);
}

/** Dressing for every 'leg' zone: uphill rocks / scree / fence / signpost, downhill flags and boulders. */
export function switchbackLegs(d: Dress, rocks: PropBatch): void {
  const { ctx, field, rng } = d;
  let items = 0;
  zones(ctx, 'leg').forEach(({ s0, s1 }, i) => {
    const mid = (s0 + s1) / 2;
    for (const side of [-1, 1] as const) {
      const uphill = field.ground(mid, side).step > 0;
      if (uphill) {
        const sign = LEG_SIGNS[i % LEG_SIGNS.length];
        if (sign) scenicSign(d, s0 + 34, side, sign[0], sign[1]);
        shoulderFence(d, side, s0 + 44, s0 + 68);
      } else {
        prayerFlagLine(d, side, s0 + 18, s1 - 40);
      }
      let k = 0;
      for (let s = s0 + rng.range(6, 12); s < s1 - 6; s += rng.range(20, 30)) {
        const ok = uphill && k % 2 === 1 ? screeFan(d, rocks, s, side) : boulderCluster(d, rocks, s, side, uphill ? rng.range(2.6, 6) : rng.range(3.5, 8));
        if (ok) items++;
        k++;
      }
    }
  });
  ctx.log(`switchback legs: ${items} boulder clusters / scree fans`);
}
