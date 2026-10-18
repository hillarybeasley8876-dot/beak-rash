// Distant village pieces (seen across the fields, 150 m+ away): low-detail houses and a bell tower
// in the villa palette. Local frame: origin at the front-centre ground point, front faces −Z.
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, trs } from '../../kit/shapes';
import { BPAL, hipRoof } from './building';

const STONE = new Color('#e9dcc4');
const BELFRY = new Color('#3a2a22');
const lm = new Matrix4(), wm = new Matrix4();

function part(buf: MeshBuf, base: Matrix4, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color): void {
  wm.multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, lm));
  box(buf, wm, col);
}

/** Simple house: plinth sunk `sink` m into the slope, walls, hip roof, door and two windows. */
export function farHouse(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng, sink: number): void {
  const w = rng.range(5, 8), d = rng.range(4.5, 6.5), h = rng.pick([3.2, 3.4, 6.2, 6.4]);
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  part(buf, base, 0, -sink / 2, d / 2, w + 0.2, sink, d + 0.2, BPAL.plinth);
  part(buf, base, 0, h / 2, d / 2, w, h, d, rng.pick(BPAL.walls));
  hipRoof(buf, new Matrix4().multiplyMatrices(base, trs(0, 0, d / 2, 0, 1, 1, 1, lm)), w, d, h, rng.range(1.3, 2), rng.chance(0.7) ? BPAL.roof : BPAL.roofAlt, BPAL.roofDark);
  part(buf, base, 0, 1.1, -0.05, 1, 2.1, 0.12, BPAL.door);
  for (const wx of [-w * 0.3, w * 0.3]) part(buf, base, wx, h - 1.5, -0.05, 0.9, 1, 0.12, BPAL.glass);
}

/** Campanile: square stone shaft, dark belfry openings, pyramid roof. */
export function bellTower(buf: MeshBuf, x: number, y: number, z: number, ry: number, sink: number): void {
  const W = 3.4, H = 15;
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  part(buf, base, 0, (H - sink) / 2, W / 2, W, H + sink, W, STONE);
  part(buf, base, 0, H - 2.2, W / 2, W + 0.12, 1.8, 1.2, BELFRY);
  part(buf, base, 0, H - 2.2, W / 2, 1.2, 1.8, W + 0.12, BELFRY);
  part(buf, base, 0, H + 0.15, W / 2, W + 0.5, 0.3, W + 0.5, STONE);
  hipRoof(buf, new Matrix4().multiplyMatrices(base, trs(0, 0, W / 2, 0, 1, 1, 1, lm)), W - 0.4, W - 0.4, H + 0.3, 3.2, BPAL.roof, BPAL.roofDark);
}
