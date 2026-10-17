// Extrude a 2D cross-section (u outward from the drivable edge, y up) along one road edge.
// Flat-shaded faces (crisp toon bands), per-face colour by s, optional end caps.
import { Color, Vector3 } from 'three';
import type { WorldCtx } from '../ctx';
import { frameOffset, rowsBetween, type MeshBuf } from '../geom';
import type { PropBatch } from './batch';

export type Profile = Array<[number, number]>;

export interface EdgeRow { s: number; pos: Vector3; rh: Vector3; tan: Vector3 }

/** Road edge point (drivable bound) at s on `side`, with the horizontal outward and forward vectors. */
export function edgeRow(ctx: WorldCtx, s: number, side: -1 | 1, bound: (s: number, side: -1 | 1) => number): EdgeRow {
  const fr = ctx.q.frameVis(s);
  const pos = frameOffset(fr, side * bound(s, side), 0);
  const rh = new Vector3(fr.right.x, 0, fr.right.z).normalize().multiplyScalar(side);
  const tan = new Vector3(fr.tangent.x, 0, fr.tangent.z).normalize();
  return { s, pos, rh, tan };
}

const at = (r: EdgeRow, u: number, y: number, out: Vector3): Vector3 =>
  out.copy(r.pos).addScaledVector(r.rh, u).setY(r.pos.y + y);

const A = new Vector3(), B = new Vector3(), C = new Vector3(), D = new Vector3(), N = new Vector3(), G = new Vector3(), T = new Vector3();

function quad(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, d: Vector3, n: Vector3, col: Color): void {
  // Wind so the geometric normal agrees with the intended one.
  G.subVectors(b, a).cross(T.subVectors(c, a));
  const i0 = buf.vert(a, n, col), i1 = buf.vert(b, n, col), i2 = buf.vert(c, n, col), i3 = buf.vert(d, n, col);
  if (G.dot(n) >= 0) buf.quad(i0, i1, i2, i3);
  else buf.quad(i0, i3, i2, i1);
}

export interface ExtrudeOpts {
  step?: number;
  caps?: boolean;
  /** Close the profile (last point back to the first). */
  closed?: boolean;
}

export function extrudeEdge(
  ctx: WorldCtx, batch: PropBatch, side: -1 | 1, s0: number, s1: number, profile: Profile,
  bound: (s: number, side: -1 | 1) => number, colorAt: (face: number, s: number) => Color, opts: ExtrudeOpts = {},
): void {
  if (s1 - s0 < 0.2) return;
  const rows = rowsBetween(s0, s1, opts.step ?? 2).map((s) => edgeRow(ctx, s, side, bound));
  const nFaces = opts.closed ? profile.length : profile.length - 1;
  for (let r = 0; r < rows.length - 1; r++) {
    const ra = rows[r] as EdgeRow, rb = rows[r + 1] as EdgeRow;
    const buf = batch.at(ra.pos.x, ra.pos.z);
    const sMid = (ra.s + rb.s) / 2;
    for (let k = 0; k < nFaces; k++) {
      const [u0, y0] = profile[k] as [number, number];
      const [u1, y1] = profile[(k + 1) % profile.length] as [number, number];
      // Outward normal of the 2D face (profiles run front-bottom → top → back).
      const du = u1 - u0, dy = y1 - y0, len = Math.hypot(du, dy) || 1;
      N.copy(ra.rh).multiplyScalar(-dy / len).setY(du / len).normalize();
      quad(buf, at(ra, u0, y0, A), at(ra, u1, y1, B), at(rb, u1, y1, C), at(rb, u0, y0, D), N, colorAt(k, sMid));
    }
  }
  if (opts.caps === false) return;
  for (const [row, dir] of [[rows[0], -1], [rows[rows.length - 1], 1]] as Array<[EdgeRow, number]>) {
    const buf = batch.at(row.pos.x, row.pos.z);
    N.copy(row.tan).multiplyScalar(dir);
    let cu = 0, cy = 0;
    for (const [u, y] of profile) { cu += u; cy += y; }
    cu /= profile.length; cy /= profile.length;
    const col = colorAt(0, row.s);
    const centre = buf.vert(at(row, cu, cy, A), N, col);
    const ids = profile.map(([u, y]) => buf.vert(at(row, u, y, B), N, col));
    for (let k = 0; k < ids.length - (opts.closed ? 0 : 1); k++) {
      const i = ids[k] ?? 0, j = ids[(k + 1) % ids.length] ?? 0;
      at(row, profile[k]?.[0] ?? 0, profile[k]?.[1] ?? 0, C);
      at(row, profile[(k + 1) % profile.length]?.[0] ?? 0, profile[(k + 1) % profile.length]?.[1] ?? 0, D);
      G.subVectors(C, A).cross(T.subVectors(D, A));
      if (G.dot(N) >= 0) buf.tri(centre, i, j);
      else buf.tri(centre, j, i);
    }
  }
}
