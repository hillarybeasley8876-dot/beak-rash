// Sunset Pass village houses (env-mountain): two-storey mountain houses with white plaster ground
// floors, dark timber upper floors, steep gable roofs with upturned ridge horns, wooden balconies,
// warm lit windows (unlit glow quads) and a paper lantern by the door. Local frame: origin at the
// front-centre ground point, front faces −Z (toward the road), like scenery/props/building.ts.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, trs } from '../../kit/shapes';
import { poly } from './building';
import { lantern } from './mountain-deco';

const C = (h: string): Color => new Color(h);
const HPAL = {
  plaster: [C('#f4ead8'), C('#efe2cc'), C('#f7efe2')], timber: [C('#6b4231'), C('#7d4c34'), C('#5d3a2c')],
  beam: C('#3d2820'), plinth: C('#9c9184'), roof: [C('#3f3b52'), C('#4a3d4f'), C('#7a3a2e')], under: C('#2a2430'),
  window: [C('#ffc76a'), C('#ffd88a'), C('#ffb259')], frame: C('#2b1f1a'), door: C('#7a3b26'), ridge: C('#26222c'),
  flower: [C('#ff5f7a'), C('#ffd23a'), C('#ff8a3a')], leaf: C('#3f7f37'), chimney: C('#8e8478'),
};
const lm = new Matrix4(), wm = new Matrix4();
const V = new Vector3();

function part(buf: MeshBuf, base: Matrix4, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color, ry = 0): void {
  wm.multiplyMatrices(base, trs(cx, cy, cz, ry, sx, sy, sz, lm));
  box(buf, wm, col);
}

/** Gable roof over a w × d box (centred at the origin) whose walls end at height h. */
function gableRoof(buf: MeshBuf, m: Matrix4, w: number, d: number, h: number, rise: number, col: Color, wall: Color): void {
  const o = 0.85, W = w / 2 + 0.6, D = d / 2 + o;
  const y0 = h - (o * rise) / (d / 2), top = h + rise;
  poly(buf, m, [[-W, y0, -D], [W, y0, -D], [W, top, 0], [-W, top, 0]], col);
  poly(buf, m, [[W, y0, D], [-W, y0, D], [-W, top, 0], [W, top, 0]], col);
  // Undersides (seen from the road below the eaves).
  poly(buf, m, [[-W, top, 0], [W, top, 0], [W, y0, -D], [-W, y0, -D]], HPAL.under);
  poly(buf, m, [[W, top, 0], [-W, top, 0], [-W, y0, D], [W, y0, D]], HPAL.under);
  // Gable walls.
  poly(buf, m, [[-w / 2, h, d / 2], [-w / 2, h, -d / 2], [-w / 2, top - 0.05, 0]], wall);
  poly(buf, m, [[w / 2, h, -d / 2], [w / 2, h, d / 2], [w / 2, top - 0.05, 0]], wall);
  // Ridge beam with upturned horns at both ends.
  wm.multiplyMatrices(m, trs(0, top + 0.08, 0, 0, 2 * W + 0.2, 0.22, 0.34, lm));
  box(buf, wm, HPAL.ridge);
  for (const sx of [-1, 1]) {
    const horn = new Matrix4().multiplyMatrices(m, new Matrix4().makeTranslation(sx * (W + 0.2), top + 0.25, 0));
    horn.multiply(new Matrix4().makeRotationZ(sx * -0.75)).multiply(new Matrix4().makeScale(0.2, 0.62, 0.3));
    box(buf, horn, HPAL.ridge);
  }
}

export interface HouseOpts { floors?: 1 | 2; w?: number; d?: number; sink?: number; lantern?: boolean }

/** Mountain house. (x, y, z) = ground at the front centre; ry turns local −Z toward the road. */
export function mountainHouse(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng, o: HouseOpts = {}): void {
  const floors = o.floors ?? (rng.chance(0.6) ? 2 : 1);
  const w = o.w ?? rng.range(6, 9), d = o.d ?? rng.range(5.5, 7.5), sink = o.sink ?? 0.6;
  const fh = 3.0, h = floors * fh;
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  const plaster = rng.pick(HPAL.plaster), timber = rng.pick(HPAL.timber);
  part(props, base, 0, 0.25 - sink / 2, d / 2, w + 0.3, 0.5 + sink, d + 0.3, HPAL.plinth);
  part(props, base, 0, fh / 2 + 0.25, d / 2, w, fh - 0.5, d, plaster);
  if (floors === 2) {
    part(props, base, 0, fh + fh / 2, d / 2, w + 0.4, fh, d + 0.4, timber);
    part(props, base, 0, fh, d / 2, w + 0.5, 0.22, d + 0.5, HPAL.beam);
  }
  // Corner posts.
  for (const cx of [-w / 2, w / 2]) for (const cz of [0, d]) part(props, base, cx, h / 2, cz, 0.24, h, 0.24, HPAL.beam);
  const roofM = new Matrix4().multiplyMatrices(base, trs(0, 0, d / 2, 0, 1, 1, 1, lm));
  gableRoof(props, roofM, w + (floors === 2 ? 0.4 : 0), d + (floors === 2 ? 0.4 : 0), h, rng.range(2.2, 3), rng.pick(HPAL.roof), floors === 2 ? timber : plaster);
  // Door + lit windows on the front (and one per side).
  part(props, base, 0, 1.25, -0.06, 1.2, 2.1, 0.12, HPAL.door);
  const win = rng.pick(HPAL.window);
  const front = floors === 2 ? -0.26 : -0.06;
  for (const fx of [-w * 0.3, w * 0.3]) {
    part(props, base, fx, 1.6, -0.05, 1.2, 1.2, 0.1, HPAL.frame);
    part(glow, base, fx, 1.6, -0.1, 0.95, 0.95, 0.04, win);
    if (floors === 2) {
      part(props, base, fx, fh + 1.5, front + 0.01, 1.1, 1.3, 0.1, HPAL.frame);
      part(glow, base, fx, fh + 1.5, front - 0.04, 0.85, 1.05, 0.04, win);
      part(props, base, fx, fh + 0.75, front - 0.25, 1.3, 0.3, 0.4, rng.pick(HPAL.flower));
    }
  }
  for (const sx of [-1, 1]) {
    part(props, base, sx * (w / 2 + 0.02), 1.6, d * 0.5, 0.1, 1.1, 1.1, HPAL.frame);
    part(glow, base, sx * (w / 2 + 0.06), 1.6, d * 0.5, 0.04, 0.85, 0.85, win);
  }
  if (floors === 2 && rng.chance(0.6)) {
    // Wooden balcony across the front of the upper floor.
    part(props, base, 0, fh + 0.05, front - 0.55, w * 0.8, 0.14, 1.0, HPAL.beam);
    part(props, base, 0, fh + 0.95, front - 1.0, w * 0.8, 0.1, 0.1, timber);
    for (let k = 0; k <= 6; k++) part(props, base, -w * 0.4 + (k * w * 0.8) / 6, fh + 0.5, front - 1.0, 0.08, 0.9, 0.08, timber);
  }
  if (rng.chance(0.7)) part(props, base, w * 0.28, h + 1.6, d * 0.7, 0.7, 2.4, 0.7, HPAL.chimney);
  if (o.lantern !== false) {
    V.set(-0.95, 2.55, -0.25).applyMatrix4(base);
    lantern(props, glow, V.x, V.y, V.z, rng, 0.8);
  }
}
