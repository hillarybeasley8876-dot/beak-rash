// Grid panel: a thin double-sided slab sampled on a (u, v) grid between two edge curves, with a rim. Used for
// feather panels whose vertex colours must form crisp bands (columns can be forced onto colour borders).
import { BufferAttribute, BufferGeometry } from 'three';

export interface PanelOpts {
  /** Columns along u and rows across v. */
  cols: number;
  rows: number;
  thick: number;
  /** u (0..1) positions that must coincide with a column (colour borders). */
  breaks?: readonly number[];
  /** Explicit row fractions across the panel (0..1, sorted); overrides the uniform `rows`. */
  rowAt?: readonly number[];
}

/**
 * Geometry in local (x = u·L, y = v, z = ±thick/2) between `bot(u)` and `top(u)` (u ∈ 0..1, v in metres).
 * Triangles wind counter-clockwise seen from +z on the front sheet.
 */
export function gridPanel(L: number, top: (u: number) => number, bot: (u: number) => number, o: PanelOpts): BufferGeometry {
  const us = new Set<number>();
  for (let i = 0; i <= o.cols; i++) us.add(i / o.cols);
  for (const b of o.breaks ?? []) us.add(Math.min(1, Math.max(0, b)));
  const cols = [...us].sort((a, b) => a - b);
  const rows = o.rowAt ?? Array.from({ length: o.rows + 1 }, (_, j) => j / o.rows);
  const C = cols.length, R = rows.length;
  const pos: number[] = [];
  for (const z of [o.thick / 2, -o.thick / 2]) {
    for (const u of cols) {
      const t = top(u), b = bot(u);
      for (const f of rows) pos.push(u * L, b + (t - b) * f, z);
    }
  }
  const idx: number[] = [];
  const at = (sheet: number, i: number, j: number): number => sheet * C * R + i * R + j;
  for (let i = 0; i < C - 1; i++) {
    for (let j = 0; j < R - 1; j++) {
      const a = at(0, i, j), b = at(0, i + 1, j), c = at(0, i + 1, j + 1), d = at(0, i, j + 1);
      idx.push(a, b, c, a, c, d);
      const a2 = at(1, i, j), b2 = at(1, i + 1, j), c2 = at(1, i + 1, j + 1), d2 = at(1, i, j + 1);
      idx.push(a2, c2, b2, a2, d2, c2);
    }
  }
  // Rim: bottom edge, top edge and both ends join the two sheets.
  const quad = (f0: number, f1: number, b0: number, b1: number): void => { idx.push(f0, b0, f1, f1, b0, b1); };
  for (let i = 0; i < C - 1; i++) {
    quad(at(0, i, 0), at(0, i + 1, 0), at(1, i, 0), at(1, i + 1, 0));
    quad(at(0, i + 1, R - 1), at(0, i, R - 1), at(1, i + 1, R - 1), at(1, i, R - 1));
  }
  for (let j = 0; j < R - 1; j++) {
    quad(at(0, 0, j + 1), at(0, 0, j), at(1, 0, j + 1), at(1, 0, j));
    quad(at(0, C - 1, j), at(0, C - 1, j + 1), at(1, C - 1, j), at(1, C - 1, j + 1));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
