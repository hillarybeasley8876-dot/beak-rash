// Shared helpers for the Sunset Pass props (env-mountain).
import { Matrix4, type Color } from 'three';
import type { MeshBuf } from '../../geom';
import { box, trs } from '../../kit/shapes';

const wm = new Matrix4(), lm = new Matrix4();

/** Box of size (sx, sy, sz) centred at local (cx, cy, cz), turned ry, in the prop frame `base`. */
export function part(buf: MeshBuf, base: Matrix4, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color, ry = 0): void {
  wm.multiplyMatrices(base, trs(cx, cy, cz, ry, sx, sy, sz, lm));
  box(buf, wm, col);
}
