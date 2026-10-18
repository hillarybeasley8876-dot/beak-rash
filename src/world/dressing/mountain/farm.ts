// Sunset Pass farmland (env-mountain): tea terraces (hedge rows following the slope above the road)
// and a cow pasture behind a ranch fence (cows never stand on the drivable road).
import { Vector3 } from 'three';
import { cow } from '../../scenery/props/mountain-animals';
import { fence } from '../../scenery/props/mountain-deco';
import { teaBush } from '../../scenery/props/mountain-trees';
import type { Dress } from '../dress';

/** Hedge rows of tea every ~4 m up the slope on `side`, 3.2 m segments with small gaps. */
export function teaTerraces(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  let n = 0;
  for (let u = 5; u <= 44; u += 4.2) {
    for (let s = s0 + rng.range(0, 2); s < s1; s += 3.7) {
      const sp = place.spot(s, side, u + rng.range(-0.25, 0.25));
      if (place.slopeRange(sp, 1, 3) > 2.2 || !place.free(sp.pos.x, sp.pos.z, 1.1, 1.6)) continue;
      teaBush(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y - 0.1, sp.pos.z, rng, 3.2, sp.along);
      n++;
    }
  }
  console.info(`[mountain] tea terraces ${Math.round(s0)}-${Math.round(s1)}: ${n} hedges`);
}

/** Pasture on `side`: ranch fence along the road (+ end fences) and grazing cows behind it. */
export function cowPasture(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b, ctx } = d;
  const gy = (x: number, z: number): number => ctx.groundWorld(x, z);
  const fenceU = 3.6, backU = 30;
  const line: Vector3[] = [];
  for (let s = s0; s <= s1; s += 6) line.push(place.spot(s, side, fenceU).pos);
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as Vector3, c = line[i + 1] as Vector3;
    fence(b.props.at(a.x, a.z), a, c, gy);
  }
  for (const s of [s0, s1]) {
    const a = place.spot(s, side, fenceU).pos, c = place.spot(s, side, backU).pos;
    fence(b.props.at(a.x, a.z), a, c, gy);
  }
  let n = 0;
  for (let k = 0; k < 12 && n < 8; k++) {
    const sp = place.spot(rng.range(s0 + 8, s1 - 8), side, rng.range(fenceU + 4, backU - 4));
    if (place.slopeRange(sp, 2, 2) > 1.6 || !place.free(sp.pos.x, sp.pos.z, 2.2, 5)) continue;
    const grazing = rng.chance(0.6);
    // Watchers look at the road; grazers face along the slope.
    const yaw = grazing ? sp.along + rng.range(-1.2, 1.2) : sp.faceRoad + rng.range(-0.4, 0.4);
    cow(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y - 0.05, sp.pos.z, yaw, rng, grazing);
    n++;
  }
  console.info(`[mountain] pasture ${Math.round(s0)}-${Math.round(s1)}: ${n} cows`);
}
