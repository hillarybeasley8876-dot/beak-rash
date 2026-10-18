// Sunset Pass rock walls (env-mountain). The cliff and cutting faces (LayoutDef.crags already pushes
// the ribbon into ledges and a jagged lip) get chunky faceted granite on top: columns stacked along
// the wall foot every 6–9 m, slabs resting on the face higher up, and a ragged crag line with the odd
// pine and tuft along the top lip, so the wall reads as rock masses instead of a painted plane.
import { Color } from 'three';
import { PropBatch } from '../../kit/batch';
import { pine } from '../../scenery/props/mountain-trees';
import { bush } from '../../scenery/props/nature';
import { crag } from '../../scenery/props/rocks';
import { wallHeight } from '../../terrain/crag';
import type { Dress } from '../dress';

// Same warm family as the graded wall (env/mountain-grade.ts PAL.rock), three values for flat toon tones.
const GRANITE = [new Color('#cf9f86'), new Color('#b4846f'), new Color('#93695f')] as const;

/** Height of the rising rock wall above the road edge at (s, side) (0 = none) and its run-in width. */
function wallAt(d: Dress, s: number, side: -1 | 1): { h: number; stepW: number; edgeY: number } {
  const edgeY = d.field.edgeY(s, side);
  if (d.ctx.q.edgeKindAt(s, side) === 'tunnel') return { h: 0, stepW: 0, edgeY };
  const g = d.field.ground(s, side);
  return { h: wallHeight(g, edgeY, d.ctx.q.frameVis(s).pos.y), stepW: g.stepW, edgeY };
}

const granite = (d: Dress): Color => d.rng.pick([...GRANITE]);

/** Columns at the foot and slabs on the face of every rising rock wall in [s0, s1]. */
function faceRocks(d: Dress, rocks: PropBatch, side: -1 | 1, s0: number, s1: number): number {
  const { place, rng } = d;
  let n = 0;
  for (let s = s0 + rng.range(0, 4); s < s1; s += rng.range(6, 9)) {
    const w = wallAt(d, s, side);
    if (w.h < 4) continue;
    // Column: 3–8 m tall, front 0.25 m beyond the drivable edge, back buried in the face.
    const sy = rng.range(1.8, Math.min(4.4, w.h * 0.32)), sz = rng.range(1.0, 1.5), sx = rng.range(1.7, 3.3);
    const sp = place.spot(s, side, 0.25 + sz * 0.95);
    crag(rocks.at(sp.pos.x, sp.pos.z), sp.pos.x, w.edgeY + sy * 0.42, sp.pos.z, sx, sy, sz, sp.faceRoad + rng.range(-0.18, 0.18), rng, granite(d));
    n++;
    if (!rng.chance(0.65)) continue;
    // Slab resting on the face above the column (the face leans back ~stepW over the wall height).
    const hy = rng.range(sy * 1.7, w.h * 0.82), ss = rng.range(1.2, 2.3);
    const p2 = place.spot(s + rng.range(-2.5, 2.5), side, 0.4 + w.stepW * (hy / w.h) + ss * 0.55);
    crag(rocks.at(p2.pos.x, p2.pos.z), p2.pos.x, w.edgeY + hy, p2.pos.z, ss * 1.45, ss, ss * 0.8, p2.faceRoad, rng, granite(d), false);
    n++;
  }
  return n;
}

/** Ragged crag line along the top lip: rock clusters, tufts and the odd small pine. */
function lipRocks(d: Dress, rocks: PropBatch, side: -1 | 1, s0: number, s1: number): number {
  const { place, rng, b } = d;
  let n = 0;
  for (let s = s0 + rng.range(0, 2); s < s1; s += rng.range(3, 5)) {
    const w = wallAt(d, s, side);
    if (w.h < 4) continue;
    const sp = place.spot(s, side, w.stepW + rng.range(0.6, 3.2));
    const { x, y, z } = sp.pos;
    if (!place.free(x, z, 0.9, 1.4)) continue;
    const buf = b.props.at(x, z);
    const roll = rng.next();
    if (roll < 0.62) {
      const r = rng.range(1.0, 2.2);
      crag(rocks.at(x, z), x, y + r * 0.2, z, r * rng.range(1.0, 1.5), r * rng.range(0.8, 1.3), r, rng.range(0, 6.3), rng, granite(d));
    } else if (roll < 0.86) bush(buf, x, y, z, rng, rng.range(0.7, 1.1), false);
    else pine(buf, x, y, z, rng, rng.range(0.55, 0.75));
    n++;
  }
  return n;
}

/**
 * Batch for the wall and portal rocks: outlined, but casting no shadow (their facets lie nearly
 * parallel to the low sun, so self-shadowing striped them with acne).
 */
export const rockBatch = (d: Dress): PropBatch => new PropBatch(d.ctx, 'mountain:rocks', { castShadow: false });

/** Rock dressing for every rising rock wall in the ranges (both sides; tunnels skipped). */
export function rockWalls(d: Dress, rocks: PropBatch, ranges: Array<{ s0: number; s1: number }>): void {
  let face = 0, lip = 0;
  for (const { s0, s1 } of ranges) {
    for (const side of [-1, 1] as const) {
      face += faceRocks(d, rocks, side, s0, s1);
      lip += lipRocks(d, rocks, side, s0, s1);
    }
  }
  d.ctx.log(`rock walls: ${face} face rocks, ${lip} lip props`);
}
