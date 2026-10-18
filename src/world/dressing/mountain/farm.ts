// Sunset Pass farmland (env-mountain): tea terraces (hedge rows following the slope above the road)
// and a cow pasture behind a ranch fence (cows never stand on the drivable road).
import { Color, Matrix4, Vector3 } from 'three';
import { PropBatch } from '../../kit/batch';
import { box, cone, cylinder, trs } from '../../kit/shapes';
import { OUTLINE } from '../../mats';
import { fan } from '../../scenery/props/event';
import { cow } from '../../scenery/props/mountain-animals';
import { fence } from '../../scenery/props/mountain-deco';
import { teaBush } from '../../scenery/props/mountain-trees';
import type { Dress } from '../dress';

const EARTH = new Color('#8a6a4f'), STONE = new Color('#a59a8c'), HAT = new Color('#e8c76a'), WICKER = new Color('#a77a45');
const m = new Matrix4();

/**
 * Tea terraces on `side`: hedge rows every ~4.2 m up the slope (5.6 m segments with small gaps, thin
 * outlines), each standing on an earth riser strip so the slope reads as contour steps; a few pickers
 * in straw hats with baskets for scale.
 */
export function teaTerraces(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng } = d;
  // Own batch: thin outlines, no shadow pass (hundreds of hedges seen from the legs above cost ~30k shadow tris),
  // small cells so the distance LOD drops the hulls of far rows.
  const tea = new PropBatch(d.ctx, 'mountain:tea', { outline: OUTLINE.small, castShadow: false, cell: 80 });
  let n = 0;
  for (let u = 5; u <= 44; u += 4.2) {
    for (let s = s0 + rng.range(0, 2); s < s1; s += 6) {
      const sp = place.spot(s, side, u + rng.range(-0.25, 0.25));
      if (place.slopeRange(sp, 1, 5) > 2.6 || !place.free(sp.pos.x, sp.pos.z, 1.1, 1.6)) continue;
      const { x, y, z } = sp.pos;
      // Long axis (local X) along the contour, i.e. along the road.
      const yaw = sp.along + Math.PI / 2;
      teaBush(tea.at(x, z), x, y - 0.1, z, rng, 5.6, yaw);
      // Riser on the downhill side of the row: an earth band from the hedge foot down into the slope.
      const rx = x - Math.sin(sp.faceRoad), rz = z - Math.cos(sp.faceRoad);
      box(tea.at(rx, rz), trs(rx, y - 0.55, rz, yaw, 5.9, 1.3, 0.4, m), rng.chance(0.3) ? STONE : EARTH);
      n++;
      if (rng.chance(0.025)) picker(d, sp.s + 2.5, side, u - 1.6);
    }
  }
  tea.finish();
  d.ctx.log(`tea terraces ${Math.round(s0)}-${Math.round(s1)}: ${n} hedges`);
}

/** Tea picker between two rows: a bobbing figure in a straw cone hat, a wicker basket at its feet. */
function picker(d: Dress, s: number, side: -1 | 1, u: number): void {
  const { place, rng, b } = d;
  const sp = place.spot(s, side, u);
  const { x, y, z } = sp.pos;
  if (!place.free(x, z, 0.7, 1.4)) return;
  fan(b.crowd.at(x, z), x, y, z, sp.faceRoad + rng.range(-0.6, 0.6), rng);
  cone(b.props.at(x, z), trs(x, y + 1.18, z, 0, 0.42, 0.26, 0.42, m), HAT, 10);
  cylinder(b.props.at(x, z), trs(x + 0.55, y - 0.05, z + 0.3, 0, 0.26, 0.42, 0.26, m), WICKER, 8, 0.85, 1);
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
  d.ctx.log(`pasture ${Math.round(s0)}-${Math.round(s1)}: ${n} cows`);
}
