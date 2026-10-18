// Coast landmarks: red/white lighthouse with keeper's cottage, wooden pier, market stalls.
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';
import { villa } from './building';

const C = (h: string): Color => new Color(h);
const RED = C('#e5191c'), WHITE = C('#f6f3ec'), DARK = C('#24262c'), GLASS = C('#fff2a8');
const WOOD = C('#b07b4f'), WOOD2 = C('#94643f'), PILE = C('#6e4a30');
const m = new Matrix4(), lm = new Matrix4(), wm = new Matrix4();

/** Lighthouse (base at ground y). Lantern glass goes to `glow`. */
export function lighthouse(buf: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, rng: Rng): void {
  const bands = 5, bh = 3.4;
  cylinder(buf, trs(x, y - 1.5, z, 0, 3.4, 2.0, 3.4, m), C('#cfc5b4'), 14, 1, 1.0);
  for (let i = 0; i < bands; i++) {
    const r0 = 2.7 - i * 0.18, r1 = 2.7 - (i + 1) * 0.18;
    cylinder(buf, trs(x, y + 0.5 + i * bh, z, 0, 1, bh, 1, m), i % 2 ? WHITE : RED, 16, r0, r1, false);
  }
  const top = y + 0.5 + bands * bh;
  cylinder(buf, trs(x, top, z, 0, 2.6, 0.35, 2.6, m), DARK, 16);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    box(buf, trs(x + Math.cos(a) * 2.45, top + 0.75, z + Math.sin(a) * 2.45, -a, 0.08, 0.8, 0.08, m), DARK);
  }
  cylinder(buf, trs(x, top + 1.12, z, 0, 2.5, 0.1, 2.5, m), DARK, 16, 1, 1, false);
  cylinder(glow, trs(x, top + 0.35, z, 0, 1.45, 2.3, 1.45, m), GLASS, 12);
  cylinder(buf, trs(x, top + 2.65, z, 0, 1.7, 0.25, 1.7, m), DARK, 12);
  cone(buf, trs(x, top + 2.9, z, 0, 1.6, 1.5, 1.6, m), RED, 12);
  sphere(buf, trs(x, top + 4.5, z, 0, 0.25, 0.25, 0.25, m), DARK, 6, 4);
  villa(buf, x + 6.5, y, z + 1.5, rng.range(0, 6), rng, { floors: 1, w: 6, d: 4.5, sink: 2, plain: true });
}

/** Wooden pier from (x, y, z) heading along yaw `ry` for `len` metres; deck top at y. */
export function pier(buf: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, ry: number, len: number, rng: Rng): void {
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  const part = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color): void => {
    wm.multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, lm));
    box(buf, wm, col);
  };
  const W = 4;
  for (let d = 0; d < len; d += 1.2) part(0, -0.12, d + 0.6, W, 0.22, 1.12, Math.floor(d / 1.2) % 2 ? WOOD : WOOD2);
  for (let d = 2; d < len; d += 4) {
    for (const sx of [-W / 2 + 0.2, W / 2 - 0.2]) {
      wm.multiplyMatrices(base, trs(sx, -7, d, 0, 0.2, 7, 0.2, lm));
      cylinder(buf, wm, PILE, 6, 1, 1, false);
      part(sx, 0.55, d, 0.12, 1.1, 0.12, WOOD2);
    }
  }
  for (const sx of [-W / 2 + 0.2, W / 2 - 0.2]) part(sx, 1.05, len / 2 + 1, 0.1, 0.1, len - 2, WOOD);
  // Hut at the end + lamp.
  part(0, 1.4, len - 2.2, 3, 2.8, 2.6, C('#4aa3df'));
  part(0, 1.4, len - 3.52, 0.9, 1.9, 0.06, WHITE);
  wm.multiplyMatrices(base, trs(0, 2.8, len - 2.2, 0, 1, 1, 1, lm));
  cone(buf, wm.multiply(new Matrix4().makeScale(2.4, 1.2, 2.1)), RED, 4);
  for (let d = 10; d < len - 4; d += 14) {
    part(W / 2 - 0.2, 1.8, d, 0.1, 3.6, 0.1, DARK);
    wm.multiplyMatrices(base, trs(W / 2 - 0.2, 3.7, d, 0, 0.22, 0.22, 0.22, lm));
    sphere(glow, wm, C('#fff1b8'), 6, 4);
  }
  part(-W / 2 + 0.5, 0.35, len * 0.6, 0.5, 0.5, 0.5, C('#3d6fb6'));
}

const FISH = [C('#c9d3dc'), C('#ff8a3d'), C('#e5191c'), C('#9aa7b4')];
const FRUIT = [C('#ff9f1c'), C('#ffd21f'), C('#7cc04f'), C('#e5191c')];
const AWN: Array<[Color, Color]> = [[RED, WHITE], [C('#2f7fc1'), WHITE], [C('#2a9d8f'), C('#ffe9c7')], [C('#ffcf1f'), WHITE]];

/** Market stall facing −Z (the road): table with produce, striped awning, crates. */
export function stall(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng): void {
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  const part = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color, rx = 0): void => {
    const local = trs(cx, cy, cz, 0, 1, 1, 1, new Matrix4()).multiply(new Matrix4().makeRotationX(rx)).multiply(new Matrix4().makeScale(sx, sy, sz));
    box(buf, wm.multiplyMatrices(base, local), col);
  };
  const [a, b] = rng.pick(AWN);
  for (const [px, pz] of [[-1.5, 0], [1.5, 0], [-1.5, 1.8], [1.5, 1.8]] as Array<[number, number]>) part(px, 1.25, pz, 0.1, 2.5, 0.1, DARK);
  part(0, 0.85, 0.5, 3.2, 0.12, 1.4, WOOD);
  part(0, 0.45, 0.5, 3.1, 0.8, 1.3, WOOD2);
  const kind = rng.int(0, 2);
  if (kind === 0) part(0, 0.95, 0.5, 3.0, 0.1, 1.2, C('#e3f4fb'));
  for (let i = 0; i < 9; i++) {
    const fx = -1.2 + (i % 5) * 0.6, fz = 0.2 + Math.floor(i / 5) * 0.55;
    wm.multiplyMatrices(base, trs(fx, 1.08, fz, rng.range(-0.4, 0.4), 1, 1, 1, lm));
    if (kind === 0) sphere(buf, wm.multiply(new Matrix4().makeScale(0.26, 0.09, 0.11)), rng.pick(FISH), 6, 4);
    else sphere(buf, wm.multiply(new Matrix4().makeScale(0.16, 0.16, 0.16)), rng.pick(FRUIT), 6, 4);
  }
  // Awning: five stripes sloping toward the road.
  for (let i = 0; i < 6; i++) part(-1.5 + i * 0.6 + 0.3, 2.55, 0.75, 0.6, 0.06, 2.4, i % 2 ? a : b, 0.32);
  part(0, 2.05, -0.38, 3.6, 0.3, 0.05, a);
  part(1.9, 0.3, 1.3, 0.6, 0.6, 0.6, WOOD);
  part(1.9, 0.75, 1.3, 0.5, 0.3, 0.5, WOOD2);
}
