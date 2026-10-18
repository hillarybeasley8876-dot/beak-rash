// Bridge over the cove: deck slab with fascias, round piers down to the sea floor, and two red
// steel through-arches (P5 accent landmark) with hangers and top bracing.
import { Color, Matrix4, Vector3 } from 'three';
import type { TrackFeature } from '../../core/types';
import type { WorldCtx } from '../ctx';
import { frameOffset, rowsBetween, type MeshBuf } from '../geom';
import type { PropBatch } from '../kit/batch';
import { box, cylinder, trs } from '../kit/shapes';
import type { TerrainField } from '../terrain/field';

const COL = { deck: new Color('#d3d0c8'), under: new Color('#9e9b94'), stripe: new Color('#e5191c'), pier: new Color('#c9c5bb'), arch: new Color('#e3242b'), hanger: new Color('#2b2b31') };
const DECK_T = 1.5;
const APEX = 19;
/** End pylons sit this far inside the bridge ends (m along the road). */
const PYLON_AT = 0.6;

const A = new Vector3(), B = new Vector3(), C = new Vector3(), D = new Vector3(), N = new Vector3(), E = new Vector3();

function quad(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color, facing: Vector3): void {
  N.subVectors(b, a).cross(E.subVectors(c, a)).normalize();
  const flip = N.dot(facing) < 0;
  if (flip) N.negate();
  const i = buf.vert(a, N, col), j = buf.vert(b, N, col), k = buf.vert(c, N, col), l = buf.vert(d, N, col);
  if (flip) buf.quad(i, l, k, j); else buf.quad(i, j, k, l);
}

export function buildBridge(ctx: WorldCtx, batch: PropBatch, field: TerrainField, f: TrackFeature): void {
  const q = ctx.q;
  const fr = q.frameVis(f.s0);
  const out = new Vector3();
  // Deck slab: fascias + underside, just outside the parapets.
  for (const [sa, sb] of pairs(rowsBetween(f.s0 - 1, f.s1 + 1, 4))) {
    q.frameVis(sa, fr);
    const buf = batch.at(fr.pos.x, fr.pos.z);
    for (const side of [-1, 1] as const) {
      const x = side * (field.bound(sa, side) + 0.42);
      const facing = new Vector3(fr.right.x * side, 0, fr.right.z * side);
      q.toWorld(sa, x, 0.02, A); q.toWorld(sb, x, 0.02, B); q.toWorld(sb, x, -0.35, C); q.toWorld(sa, x, -0.35, D);
      quad(buf, A, B, C, D, COL.stripe, facing);
      q.toWorld(sa, x, -0.35, A); q.toWorld(sb, x, -0.35, B); q.toWorld(sb, x, -DECK_T, C); q.toWorld(sa, x, -DECK_T, D);
      quad(buf, A, B, C, D, COL.deck, facing);
    }
    const xl = -(field.bound(sa, -1) + 0.42), xr = field.bound(sa, 1) + 0.42;
    q.toWorld(sa, xl, -DECK_T, A); q.toWorld(sa, xr, -DECK_T, B); q.toWorld(sb, xr, -DECK_T, C); q.toWorld(sb, xl, -DECK_T, D);
    quad(buf, A, B, C, D, COL.under, E.set(0, -1, 0).clone());
  }
  // Piers every ~32 m: twin round columns from the sea floor to a cap beam under the deck.
  const m = new Matrix4();
  const n = Math.max(2, Math.round((f.s1 - f.s0) / 32));
  for (let i = 1; i < n; i++) {
    const s = f.s0 + ((f.s1 - f.s0) * i) / n;
    q.frameVis(s, fr);
    const ry = Math.atan2(fr.tangent.x, fr.tangent.z);
    const floor = Math.min(field.underRoad(s, fr.pos.y), -2) - 1;
    const top = fr.pos.y - DECK_T;
    for (const x of [-3.6, 3.6]) {
      frameOffset(fr, x, 0, out);
      cylinder(batch.at(out.x, out.z), trs(out.x, floor, out.z, 0, 1.1, top - floor, 1.1, m), COL.pier, 14, 1, 1, false);
    }
    frameOffset(fr, 0, -DECK_T - 0.6, out);
    box(batch.at(out.x, out.z), trs(out.x, out.y, out.z, ry, 10.5, 1.2, 2.2, m), COL.pier);
  }
  buildArches(ctx, batch, field, f);
  for (const [s, dir] of [[f.s0, -1], [f.s1, 1]] as Array<[number, -1 | 1]>) endPylons(ctx, batch, field, s, dir);
}

/**
 * Concrete pylons at the bridge ends, just outside the drivable bound: they close the seam between the
 * parapet start and the neighbouring rock / shore, and hold the arch ribs' feet.
 */
function endPylons(ctx: WorldCtx, batch: PropBatch, field: TerrainField, s: number, dir: -1 | 1): void {
  const m = new Matrix4(), p = new Vector3();
  const sc = s - dir * PYLON_AT;
  const fr = ctx.q.frameVis(sc);
  const ry = Math.atan2(fr.tangent.x, fr.tangent.z);
  for (const side of [-1, 1] as const) {
    const b = Math.max(field.bound(s - 2, side), field.bound(s, side), field.bound(s + 2, side));
    ctx.q.toWorld(sc, side * (b + 0.06 + 0.8), 0, p);
    const buf = batch.at(p.x, p.z);
    box(buf, trs(p.x, p.y - 0.6, p.z, ry, 1.6, 5.2, 2.6, m), COL.pier);
    box(buf, trs(p.x, p.y + 2.15, p.z, ry, 1.7, 0.3, 2.7, m), COL.stripe);
  }
}

function pairs(rows: number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < rows.length - 1; i++) out.push([rows[i] ?? 0, rows[i + 1] ?? 0]);
  return out;
}

function buildArches(ctx: WorldCtx, batch: PropBatch, field: TerrainField, f: TrackFeature): void {
  const q = ctx.q;
  // The ribs spring from the end pylons (see endPylons).
  const sA = f.s0 + PYLON_AT, sB = f.s1 - PYLON_AT, span = sB - sA;
  const W = 0.8, Dp = 1.3, SEG = 28;
  const xOf = (s: number, side: -1 | 1): number => side * (field.bound(s, side) + 1.0);
  const h = (t: number): number => 4 * APEX * t * (1 - t) + 1.2;
  const m = new Matrix4();
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < SEG; i++) {
      const t0 = i / SEG, t1 = (i + 1) / SEG;
      const s0 = sA + span * t0, s1 = sA + span * t1;
      // Rib cross-section corners: (lateral ±W/2, vertical ±Dp/2) at both ends.
      const corners = (s: number, t: number): Vector3[] => {
        const x = xOf(s, side), y = h(t);
        return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => q.toWorld(s, x + (a ?? 0) * W * 0.5, y + (b ?? 0) * Dp * 0.5, new Vector3()));
      };
      const c0 = corners(s0, t0), c1 = corners(s1, t1);
      const mid = q.toWorld((s0 + s1) / 2, xOf((s0 + s1) / 2, side), h((t0 + t1) / 2), new Vector3());
      const buf = batch.at(mid.x, mid.z);
      for (let k = 0; k < 4; k++) {
        const a = c0[k] as Vector3, b = c0[(k + 1) % 4] as Vector3, c = c1[(k + 1) % 4] as Vector3, d = c1[k] as Vector3;
        const facing = new Vector3().addVectors(a, b).multiplyScalar(0.5).sub(mid);
        quad(buf, a, b, c, d, COL.arch, facing);
      }
    }
    // Hangers every 8 m from the parapet top to the rib.
    for (let s = sA + 8; s < sB - 4; s += 8) {
      const t = (s - sA) / span;
      const p0 = q.toWorld(s, xOf(s, side), 1.2, new Vector3());
      const len = h(t) - Dp * 0.5 - 1.2;
      if (len < 1) continue;
      box(batch.at(p0.x, p0.z), trs(p0.x, p0.y + len / 2, p0.z, 0, 0.12, len, 0.12, m), COL.hanger);
    }
  }
  // Top bracing between the arches.
  for (const t of [0.32, 0.5, 0.68]) {
    const s = sA + span * t;
    const fr = q.frameVis(s);
    const y = h(t) - 0.2;
    const pL = q.toWorld(s, xOf(s, -1), y, new Vector3()), pR = q.toWorld(s, xOf(s, 1), y, new Vector3());
    const c = pL.clone().add(pR).multiplyScalar(0.5);
    const ry = Math.atan2(fr.tangent.x, fr.tangent.z);
    box(batch.at(c.x, c.z), trs(c.x, c.y, c.z, ry, pL.distanceTo(pR), 0.7, 0.7, m), COL.arch);
  }
}
