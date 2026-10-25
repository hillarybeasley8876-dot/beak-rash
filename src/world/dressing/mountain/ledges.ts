// Sunset Pass rock ledges (env-mountain): shelves of rock along the course lines of the rising rock walls
// (env/mountain-terrain-mat.ts shades the courses: a lit foot, the body, a dark crevice band and an ink
// line under the next course), so the wall's cross-section steps 3–5 times instead of reading as one
// flat plane. A shelf is a pale tread (moss with grass tufts on some runs), a sun-caught chamfer, a lip in
// its run's granite tone and a dark underside, all buried deep in the face and ink-outlined (rocks batch).
// Depth, thickness and the lip's lean wander row by row (chunky rock, not a plank); runs of 5–20 m with
// tapered ends; the lip always ≥ 0.45 m off the drivable edge and ≥ 3.8 m above it (riders and the chase
// camera pass underneath).
import { Color, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import type { PropBatch } from '../../kit/batch';
import { courseY, COURSE_H } from '../../env/mountain-terrain-mat';
import { flatAxes } from '../../env/mountain-frame';
import { grassTuft } from '../../scenery/props/cover';
import { GRANITE } from '../../scenery/props/mountain-granite';
import type { Dress } from '../dress';
import { faceProfile, uAtHeight, wallAt, type FacePt } from './crags';

const LEDGE = {
  row: 1.5,         // rows along s (m)
  minUp: 3.8,       // lowest shelf above the road edge (m)
  topGap: 1.4,      // shelves stay this far under the wall top (m)
  clear: 0.45,      // lip at least this far beyond the drivable edge (m)
  thick: [0.32, 0.56] as const,   // lip height range (m)
  bury: 1.1,        // tread and underside run this far into the face (hides the ribbon's bulges between rows)
  minWall: 6,       // walls lower than this get no shelves (m)
  reach: 27,        // faces are read this far beyond the edge (m)
} as const;
const COL = { tread: new Color('#d8b19a'), moss: new Color('#83a457'), bevel: new Color('#e2bca3'), under: new Color('#5d4250') } as const;

/** One shelf cross-section: tread back (buried), chamfer top, lip top, lip foot, underside back (buried). */
interface Section { a: Vector3; b: Vector3; m: Vector3; c: Vector3; d: Vector3; moss: boolean; lip: Color }

const n = new Vector3(), e1 = new Vector3(), e2 = new Vector3();

/** Flat-shaded quad a-b-c-d with its normal turned toward `facing`. */
function face(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color, facing: Vector3): void {
  n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
  const flip = n.dot(facing) < 0;
  if (flip) n.negate();
  const i = buf.vert(a, n, col), j = buf.vert(b, n, col), k = buf.vert(c, n, col), l = buf.vert(d, n, col);
  if (flip) buf.quad(i, l, k, j);
  else buf.quad(i, j, k, l);
}

/** Flat convex polygon (fan from pts[0]) with its normal turned toward `facing`. */
function poly(buf: MeshBuf, pts: Vector3[], col: Color, facing: Vector3): void {
  const [p0, p1, p2] = pts as [Vector3, Vector3, Vector3];
  n.crossVectors(e1.subVectors(p1, p0), e2.subVectors(p2, p0)).normalize();
  const flip = n.dot(facing) < 0;
  if (flip) n.negate();
  const ids = pts.map((pt) => buf.vert(pt, n, col));
  for (let i = 1; i + 1 < ids.length; i++) {
    const i0 = ids[0] ?? 0, i1 = ids[i] ?? 0, i2 = ids[i + 1] ?? 0;
    if (flip) buf.tri(i0, i2, i1);
    else buf.tri(i0, i1, i2);
  }
}

/** Shelf on course line k at s, or null (too low / high, outside a run, no room to the road). */
function section(d: Dress, rng: Rng, s: number, side: -1 | 1, k: number, prof: FacePt[], edgeY: number, top: number): Section | null {
  const { ctx, field } = d;
  const fr = ctx.q.frameVis(s), ax = flatAxes(fr), bound = field.bound(s, side);
  const at = (u: number, y: number): Vector3 => {
    const x = side * (bound + u);
    return new Vector3(fr.pos.x + ax.rx * x, y, fr.pos.z + ax.rz * x);
  };
  // The course line's height where it meets the face (its wobble read at the face itself).
  let y = courseY(k, fr.pos.x, fr.pos.z), u = 0;
  for (let it = 0; it < 2; it++) {
    const uf = uAtHeight(prof, y);
    if (uf === null) return null;
    u = uf;
    const p = at(u, 0);
    y = courseY(k, p.x, p.z);
  }
  if (y < edgeY + LEDGE.minUp || y > top - LEDGE.topGap) return null;
  // Runs and depth from noise along s (a different phase per course), tapering to nothing at run ends,
  // plus a little jitter per row so the lip line is ragged.
  const run = field.noise.get(s / 8 + k * 3.7, side * 5.3 + k), deep = field.noise.get(s / 3.5 + k * 1.9, 17.1 + side);
  const taper = Math.min(1, Math.max(0, (run + 0.15) / 0.25));
  const p = Math.min(u - LEDGE.clear, (0.42 + 0.5 * (0.5 + 0.5 * deep) + rng.range(-0.1, 0.1)) * taper);
  if (p < 0.16) return null;
  const t = rng.range(LEDGE.thick[0], LEDGE.thick[1]) * (0.5 + 0.5 * taper), lean = rng.range(0.75, 0.95);
  const back = (yy: number): number => Math.max(u, uAtHeight(prof, yy) ?? u) + LEDGE.bury;
  const tone = GRANITE[Math.abs(Math.floor(run * 3 + k)) % GRANITE.length] as Color;
  return {
    a: at(back(y + 0.05), y + 0.05),
    b: at(u - p + 0.1, y),
    m: at(u - p, y - t * 0.35),
    c: at(u - p * lean, y - t),
    d: at(back(y - t - p * 0.6), y - t - p * 0.6),
    moss: field.noise.get(s / 14 + k, 41.7 + side) > 0.15,
    lip: tone.clone().multiplyScalar(rng.range(0.94, 1.06)),
  };
}

/** Rock shelves on every rising rock wall in the ranges (both sides). Returns the shelf length built (m). */
export function rockLedges(d: Dress, rocks: PropBatch, ranges: Array<{ s0: number; s1: number }>): number {
  const { ctx, b } = d;
  const rng = d.rng.fork(0x1ed9);
  const up = new Vector3(0, 1, 0);
  let length = 0, tufts = 0;
  /** Cross-section cap at a run's start or end. */
  const cap = (sec: Section, facing: Vector3): void => poly(rocks.at(sec.b.x, sec.b.z), [sec.a, sec.b, sec.m, sec.c, sec.d], sec.lip, facing);
  for (const { s0, s1 } of ranges) {
    for (const side of [-1, 1] as const) {
      const prev = new Map<number, Section>();
      let along = new Vector3();
      for (let s = s0; s <= s1; s += LEDGE.row) {
        const w = wallAt(d, s, side);
        // Faces may stand back from the edge behind a bench (the cutting by the portal): read the profile far out.
        const prof = w.h >= LEDGE.minWall ? faceProfile(d, s, side, w.edgeY, w.h, LEDGE.reach) : null;
        const top = prof ? Math.max(...prof.map((pt) => pt.y)) : 0;
        const ax = flatAxes(ctx.q.frameVis(s));
        along = new Vector3(ax.tx, 0, ax.tz);
        const road = new Vector3(-side * ax.rx, 0, -side * ax.rz), down = new Vector3(road.x, -1, road.z);
        const k0 = Math.floor((w.edgeY + LEDGE.minUp - 2) / COURSE_H), k1 = Math.ceil((top + 2) / COURSE_H);
        const seen = new Set<number>();
        for (let k = k0; prof && k <= k1; k++) {
          const cur = section(d, rng, s, side, k, prof, w.edgeY, top);
          if (!cur) continue;
          seen.add(k);
          const last = prev.get(k);
          if (last) {
            const buf = rocks.at(cur.b.x, cur.b.z);
            face(buf, last.a, last.b, cur.b, cur.a, last.moss ? COL.moss : COL.tread, up);
            face(buf, last.b, last.m, cur.m, cur.b, COL.bevel, new Vector3(road.x, 1, road.z));
            face(buf, last.m, last.c, cur.c, cur.m, last.lip, road);
            face(buf, last.c, last.d, cur.d, cur.c, COL.under, down);
            length += cur.b.distanceTo(last.b);
          } else cap(cur, along.clone().negate());
          if (cur.moss && rng.chance(0.55)) {
            const tp = cur.b.clone().lerp(cur.a, rng.range(0.1, 0.3));
            grassTuft(b.cover.at(tp.x, tp.z), tp.x, tp.y, tp.z, rng, rng.range(0.3, 0.55));
            tufts++;
          }
          prev.set(k, cur);
        }
        // Close the runs that ended on this row.
        for (const [k, last] of prev) {
          if (seen.has(k)) continue;
          cap(last, along);
          prev.delete(k);
        }
      }
      for (const last of prev.values()) cap(last, along);
    }
  }
  ctx.log(`rock ledges: ${Math.round(length)} m of shelves, ${tufts} tufts`);
  return length;
}
