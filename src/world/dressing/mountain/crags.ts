// Sunset Pass rock walls (env-mountain). The cliff and cutting faces (LayoutDef.crags already pushes
// the ribbon into ledges and a jagged lip) get chunky bevelled granite on top: columns stacked along
// the wall foot every 6–9 m, slabs resting on the face higher up, and a ragged crag line with the odd
// pine and tuft along the top lip, so the wall reads as rock masses instead of a painted plane.
import { Color } from 'three';
import { PropBatch } from '../../kit/batch';
import { pine } from '../../scenery/props/mountain-trees';
import { bush } from '../../scenery/props/nature';
import { bevelRock, GRANITE } from '../../scenery/props/mountain-granite';
import { cragOffset, wallHeight, type CragOffset } from '../../terrain/crag';
import { NEAR_U } from '../../terrain/near';
import type { Dress } from '../dress';


/** Height of the rising rock wall above the road edge at (s, side) (0 = none) and its run-in width. */
function wallAt(d: Dress, s: number, side: -1 | 1): { h: number; stepW: number; edgeY: number } {
  const edgeY = d.field.edgeY(s, side);
  if (d.ctx.q.edgeKindAt(s, side) === 'tunnel') return { h: 0, stepW: 0, edgeY };
  const g = d.field.ground(s, side);
  return { h: wallHeight(g, edgeY, d.ctx.q.frameVis(s).pos.y), stepW: g.stepW, edgeY };
}

const granite = (d: Dress): Color => d.rng.pick([...GRANITE]);

interface FacePt { u: number; y: number }
const OFF: CragOffset = { out: 0, up: 0 };

/**
 * Rendered wall cross-section at s: (metres beyond the edge, height) at every near-ribbon column out
 * to 12 m, with the crag push-back that terrain/near.ts applies to the face bands (ground() alone
 * reads the un-pushed face, which stands up to ~5 m nearer the road than the rendered one).
 */
function faceProfile(d: Dress, s: number, side: -1 | 1, edgeY: number, wallH: number): FacePt[] {
  const g = d.field.ground(s, side), bound = d.field.bound(s, side);
  const pts: FacePt[] = [{ u: 0, y: edgeY }];
  for (let c = 1; c < NEAR_U.length && (NEAR_U[c] ?? 99) <= 12; c++) {
    const u = NEAR_U[c] ?? 0;
    const y = d.ctx.ground(s, side * (bound + u));
    cragOffset(d.field.noise, s, c, u, y - edgeY, g, wallH, OFF);
    pts.push({ u: u + OFF.out, y });
  }
  return pts;
}

/** Where the face first reaches height y (metres beyond the edge), or null when the ground stays below y. */
function uAtHeight(pts: FacePt[], y: number): number | null {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as FacePt, b = pts[i] as FacePt;
    if (b.y >= y) return a.u + (b.u - a.u) * Math.min(1, Math.max(0, (y - a.y) / Math.max(1e-6, b.y - a.y)));
  }
  return null;
}

interface FaceStats { columns: number; slabs: number; skipped: number; floating: number }

/** Columns at the foot and slabs on the face of every rising rock wall in [s0, s1]. */
function faceRocks(d: Dress, rocks: PropBatch, side: -1 | 1, s0: number, s1: number, st: FaceStats): void {
  const { place, rng, ctx } = d;
  for (let s = s0 + rng.range(0, 4); s < s1; s += rng.range(6, 9)) {
    const w = wallAt(d, s, side);
    if (w.h < 4) continue;
    // The rendered wall can be lower than the ground def says (relief, leg blend, bends): size by it.
    const prof = faceProfile(d, s, side, w.edgeY, w.h);
    const realH = Math.max(...prof.filter((p) => p.u <= w.stepW + 6).map((p) => p.y)) - w.edgeY;
    if (realH < 4) continue;
    // Column: 3–8 m tall, front 0.25 m beyond the drivable edge, back buried in the face.
    const sy = rng.range(1.8, Math.max(1.8, Math.min(4.4, realH * 0.32))), sz = rng.range(1.0, 1.5), sx = rng.range(1.7, 3.3);
    const sp = place.spot(s, side, 0.25 + sz * 0.95);
    bevelRock(rocks.at(sp.pos.x, sp.pos.z), sp.pos.x, w.edgeY + sy * 0.42, sp.pos.z, sx, sy, sz, sp.faceRoad + rng.range(-0.18, 0.18), rng, granite(d));
    st.columns++;
    if (!rng.chance(0.65)) continue;
    // Slab wedged into the face above the column: centre where the rendered face reaches its height,
    // back third buried; skipped where the face never gets that high (it would hang in the sky).
    const ss = rng.range(1.2, 2.3), y = w.edgeY + rng.range(sy * 1.7, Math.max(sy * 1.7, realH * 0.82));
    const s2 = s + rng.range(-2.5, 2.5);
    const uf = uAtHeight(faceProfile(d, s2, side, w.edgeY, w.h), y);
    if (uf === null || uf > w.stepW + 8) { st.skipped++; continue; }
    const p2 = place.spot(s2, side, uf + ss * 0.15);
    if (ctx.groundWorld(p2.pos.x, p2.pos.z) < y - ss * 0.5 - 0.3) st.floating++;
    bevelRock(rocks.at(p2.pos.x, p2.pos.z), p2.pos.x, y, p2.pos.z, ss * 1.45, ss, ss * 0.8, p2.faceRoad, rng, granite(d), false);
    st.slabs++;
  }
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
      bevelRock(rocks.at(x, z), x, y + r * 0.2, z, r * rng.range(1.0, 1.5), r * rng.range(0.8, 1.3), r, rng.range(0, 6.3), rng, granite(d));
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
  const st: FaceStats = { columns: 0, slabs: 0, skipped: 0, floating: 0 };
  let lip = 0;
  for (const { s0, s1 } of ranges) {
    for (const side of [-1, 1] as const) {
      faceRocks(d, rocks, side, s0, s1, st);
      lip += lipRocks(d, rocks, side, s0, s1);
    }
  }
  d.ctx.log(`rock walls: ${st.columns} columns, ${st.slabs} slabs (${st.skipped} skipped: face too low), ${lip} lip props`);
  if (st.floating) console.warn(`[mountain] ${st.floating} wall slabs sit > 0.3 m above the ground`);
}
