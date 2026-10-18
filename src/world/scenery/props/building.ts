// Buildings: white villas with terracotta hip roofs, blue shutters, flower boxes and chimneys.
// Local frame: origin at the front-centre ground point, front faces −Z (toward the road).
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
export const BPAL = {
  walls: [C('#f7f2e7'), C('#f4ead6'), C('#f9f4ec'), C('#f2e2cf'), C('#f6d3cf'), C('#f1d9a6'), C('#f7ecbf')],
  plinth: C('#cdbea4'), roof: C('#d65f37'), roofDark: C('#a8432a'), roofAlt: C('#e07a3e'),
  shutter: [C('#2f7fc1'), C('#2a9d8f'), C('#e5191c')], glass: C('#203047'), door: C('#8a5a3c'),
  flower: C('#ff5fa2'), leaf: C('#4f9a3a'), chimney: C('#e8dcc8'),
  bougain: [C('#d6247a'), C('#ff4fa0')], rail: C('#fbfaf6'), wood: C('#a8744a'),
};

const P: Vector3[] = Array.from({ length: 6 }, () => new Vector3());
const N = new Vector3(), E1 = new Vector3(), E2 = new Vector3();

/** Flat convex polygon through matrix `m`; points listed clockwise as seen from outside. */
export function poly(buf: MeshBuf, m: Matrix4, pts: Array<[number, number, number]>, col: Color): void {
  const ws = pts.slice().reverse().map(([x, y, z], i) => (P[i] as Vector3).set(x, y, z).applyMatrix4(m));
  E1.subVectors(ws[1] as Vector3, ws[0] as Vector3);
  E2.subVectors(ws[2] as Vector3, ws[0] as Vector3);
  N.crossVectors(E1, E2).normalize();
  const ids = ws.map((p) => buf.vert(p, N, col));
  for (let i = 1; i < ids.length - 1; i++) buf.tri(ids[0] ?? 0, ids[i] ?? 0, ids[i + 1] ?? 0);
}

/** Hip roof over a w × d footprint (centred at the origin, eaves at y0). */
export function hipRoof(buf: MeshBuf, m: Matrix4, w: number, d: number, y0: number, rise: number, col: Color, under: Color): void {
  const W = w / 2 + 0.45, D = d / 2 + 0.45;
  const alongX = W >= D;
  const r = alongX ? W - D : D - W;
  const top = y0 + rise;
  if (alongX) {
    poly(buf, m, [[-W, y0, -D], [W, y0, -D], [r, top, 0], [-r, top, 0]], col);
    poly(buf, m, [[W, y0, D], [-W, y0, D], [-r, top, 0], [r, top, 0]], col);
    poly(buf, m, [[-W, y0, D], [-W, y0, -D], [-r, top, 0]], col);
    poly(buf, m, [[W, y0, -D], [W, y0, D], [r, top, 0]], col);
  } else {
    poly(buf, m, [[-W, y0, -D], [W, y0, -D], [0, top, -r]], col);
    poly(buf, m, [[W, y0, D], [-W, y0, D], [0, top, r]], col);
    poly(buf, m, [[-W, y0, D], [-W, y0, -D], [0, top, -r], [0, top, r]], col);
    poly(buf, m, [[W, y0, -D], [W, y0, D], [0, top, r], [0, top, -r]], col);
  }
  poly(buf, m, [[-W, y0, -D], [-W, y0, D], [W, y0, D], [W, y0, -D]], under);
}

const lm = new Matrix4(), wm = new Matrix4();

/** Box in the building's local frame (centre cx,cy,cz; size sx,sy,sz). */
function lbox(buf: MeshBuf, base: Matrix4, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color): void {
  wm.multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, lm));
  box(buf, wm, col);
}

export interface VillaOpts {
  floors?: number; w?: number; d?: number; sink?: number;
  /** No wing / balcony / bougainvillea (e.g. the lighthouse keeper's cottage next to the tower). */
  plain?: boolean;
}

/** White villa. (x, y, z) = ground at the front centre; ry turns local −Z toward the road. */
export function villa(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng, o: VillaOpts = {}): void {
  const floors = o.floors ?? rng.int(1, 2);
  const w = o.w ?? rng.range(6, 9), d = o.d ?? rng.range(5, 7), fh = 3.1;
  const h = floors * fh, sink = o.sink ?? 2.5;
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  const wall = rng.pick(BPAL.walls), shutter = rng.pick(BPAL.shutter);
  lbox(buf, base, 0, -sink / 2 + 0.2, d / 2, w + 0.2, sink + 0.4, d + 0.2, BPAL.plinth);
  lbox(buf, base, 0, h / 2 + 0.2, d / 2, w, h, d, wall);
  hipRoof(buf, new Matrix4().multiplyMatrices(base, trs(0, 0, d / 2, 0, 1, 1, 1, lm)), w, d, h + 0.2, rng.range(1.4, 2.2),
    rng.chance(0.7) ? BPAL.roof : BPAL.roofAlt, BPAL.roofDark);
  // Windows with shutters on the front and back; door on the front.
  const cols = Math.max(2, Math.floor(w / 2.4));
  for (let f = 0; f < floors; f++) {
    const wy = 0.2 + f * fh + 1.7;
    for (let i = 0; i < cols; i++) {
      const wx = -w / 2 + (w / cols) * (i + 0.5);
      if (f === 0 && i === Math.floor(cols / 2)) {
        lbox(buf, base, wx, 1.2, -0.04, 1.1, 2.2, 0.12, BPAL.door);
        continue;
      }
      for (const zf of [-0.04, d + 0.04]) {
        lbox(buf, base, wx, wy, zf, 0.8, 1.1, 0.1, BPAL.glass);
        lbox(buf, base, wx - 0.62, wy, zf, 0.42, 1.2, 0.14, shutter);
        lbox(buf, base, wx + 0.62, wy, zf, 0.42, 1.2, 0.14, shutter);
      }
      if (rng.chance(0.4)) {
        lbox(buf, base, wx, wy - 0.72, -0.22, 1.1, 0.25, 0.35, BPAL.leaf);
        lbox(buf, base, wx, wy - 0.56, -0.22, 0.9, 0.14, 0.25, BPAL.flower);
      }
    }
  }
  // Side windows.
  for (const sx of [-w / 2 - 0.04, w / 2 + 0.04]) {
    for (let f = 0; f < floors; f++) {
      wm.multiplyMatrices(base, trs(sx, 0.2 + f * fh + 1.7, d / 2, Math.PI / 2, 0.9, 1.1, 0.1, lm));
      box(buf, wm, BPAL.glass);
    }
  }
  if (rng.chance(0.6)) lbox(buf, base, w * 0.25, h + 1.6, d * 0.65, 0.6, 1.6, 0.6, BPAL.chimney);
  if (!o.plain) extras(buf, base, rng, { w, d, h, fh, floors, sink, wall });
}

interface Shell { w: number; d: number; h: number; fh: number; floors: number; sink: number; wall: Color }

/** Variety on the villa shell: a side wing with a roof terrace (+ pergola), a front balcony and bougainvillea. */
function extras(buf: MeshBuf, base: Matrix4, rng: Rng, s: Shell): void {
  const side = rng.chance(0.5) ? 1 : -1;
  if (rng.chance(0.45)) {
    const w2 = rng.range(2.8, 3.6), d2 = s.d * 0.75, h2 = s.fh * Math.max(1, s.floors - 1);
    const cx = side * (s.w / 2 + w2 / 2 - 0.05), cz = 0.4 + d2 / 2;
    lbox(buf, base, cx, -s.sink / 2 + 0.2, cz, w2 + 0.2, s.sink + 0.4, d2 + 0.2, BPAL.plinth);
    lbox(buf, base, cx, h2 / 2 + 0.2, cz, w2, h2, d2, rng.chance(0.5) ? s.wall : rng.pick(BPAL.walls));
    const top = h2 + 0.2;
    for (const [px, pz, sx, sz] of [[0, -d2 / 2, w2, 0.12], [0, d2 / 2, w2, 0.12], [side * w2 / 2, 0, 0.12, d2]] as Array<[number, number, number,
      number]>) {
      lbox(buf, base, cx + px, top + 0.45, cz + pz, sx, 0.9, sz, BPAL.rail);
    }
    if (rng.chance(0.6)) {
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>) lbox(buf, base, cx + px * (w2 / 2 - 0.3), top + 1.2,
        cz + pz * (d2 / 2 - 0.3), 0.12, 2.4, 0.12, BPAL.wood);
      for (let k = 0; k < 5; k++) lbox(buf, base, cx, top + 2.45, cz - d2 / 2 + 0.3 + k * ((d2 - 0.6) / 4), w2 - 0.3, 0.1, 0.14, BPAL.wood);
    }
  }
  if (s.floors >= 2 && rng.chance(0.6)) {
    const bw = s.w * 0.55, by = s.fh + 0.2;
    lbox(buf, base, 0, by, -0.45, bw, 0.16, 0.9, BPAL.plinth);
    lbox(buf, base, 0, by + 0.5, -0.86, bw, 0.08, 0.06, BPAL.rail);
    for (let k = 0; k <= 6; k++) lbox(buf, base, -bw / 2 + (bw * k) / 6, by + 0.27, -0.86, 0.05, 0.45, 0.05, BPAL.rail);
  }
  if (rng.chance(0.5)) {
    // Bougainvillea cascading down the front corner opposite the wing.
    const cx = -side * (s.w / 2 - 0.1);
    for (let k = 0; k < 3; k++) {
      const v = new Vector3(cx, s.h - 0.3 - k * 0.9, -0.2).applyMatrix4(base), r = 0.75 - k * 0.15;
      sphere(buf, trs(v.x, v.y, v.z, k, r, r * 0.8, r, lm), BPAL.bougain[k % 2] as Color, 7, 4, BPAL.leaf);
    }
  }
}
