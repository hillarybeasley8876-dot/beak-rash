// Sunset Pass animals (env-mountain): a big grumpy goose (the viewpoint's "鹅已就位"), grazing cows
// with patches and horns, and capybaras with a yuzu on the head (hot spring). Chunky toon volumes;
// local frame: origin on the ground (or water line), facing local −Z after `yaw`.
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const PAL = {
  white: C('#f7f4ee'), orange: C('#ff9a1f'), black: C('#16151a'), pink: C('#f2a3a6'), horn: C('#efe3c4'),
  cowPatch: [C('#2b2626'), C('#7a4a2e')], capy: [C('#9a6a43'), C('#8c5f3d')], capyDark: C('#5e3d27'),
  yuzu: C('#ffc21a'), leaf: C('#3f9a3a'), grey: C('#8f8c96'),
};
const lm = new Matrix4(), wm = new Matrix4();

type Part = (shape: 'box' | 'ball' | 'cyl' | 'cone', cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color, rx?: number) => void;

/** Shape writer in a local frame (optional pitch rx about local X). */
function parts(buf: MeshBuf, base: Matrix4): Part {
  return (shape, cx, cy, cz, sx, sy, sz, col, rx = 0) => {
    lm.makeRotationX(rx).premultiply(new Matrix4().makeTranslation(cx, cy, cz)).multiply(new Matrix4().makeScale(sx, sy, sz));
    wm.multiplyMatrices(base, lm);
    if (shape === 'box') box(buf, wm, col);
    else if (shape === 'ball') sphere(buf, wm, col, 9, 6);
    else if (shape === 'cyl') cylinder(buf, wm, col, 7, 1, 1, true);
    else cone(buf, wm, col, 7);
  };
}

/** Big goose standing guard (≈ 1.9 m × scale): long upright neck, orange beak, angry brows. */
export function goose(buf: MeshBuf, x: number, y: number, z: number, yaw: number, scale = 1.6): void {
  const base = trs(x, y, z, yaw, scale, scale, scale, new Matrix4());
  const p = parts(buf, base);
  for (const sx of [-0.13, 0.13]) {
    p('cyl', sx, 0, 0.05, 0.035, 0.42, 0.035, PAL.orange);
    p('box', sx, 0.02, -0.06, 0.14, 0.04, 0.2, PAL.orange);
  }
  p('ball', 0, 0.62, 0.08, 0.3, 0.27, 0.42, PAL.white);
  p('cone', 0, 0.66, 0.46, 0.14, 0.26, 0.1, PAL.white, 1.9);
  p('cyl', 0, 0.75, -0.18, 0.09, 0.62, 0.09, PAL.white, -0.12);
  p('ball', 0, 1.42, -0.27, 0.15, 0.14, 0.17, PAL.white);
  p('cone', 0, 1.4, -0.42, 0.07, 0.24, 0.06, PAL.orange, -1.57);
  p('ball', 0, 1.4, -0.66, 0.025, 0.025, 0.025, PAL.black);
  for (const sx of [-1, 1]) {
    p('ball', sx * 0.11, 1.46, -0.33, 0.035, 0.035, 0.035, PAL.black);
    lm.makeRotationZ(sx * 0.5).premultiply(new Matrix4().makeTranslation(sx * 0.1, 1.53, -0.35)).multiply(new Matrix4().makeScale(0.12, 0.025, 0.03));
    wm.multiplyMatrices(base, lm);
    box(buf, wm, PAL.black);
  }
}

/** Grazing cow (≈ 1.5 m tall): patched barrel body, boxy head (down when grazing), horns, tail. */
export function cow(buf: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng, grazing: boolean): void {
  const p = parts(buf, trs(x, y, z, yaw, 1, 1, 1, new Matrix4()));
  for (const [lx, lz] of [[-0.32, -0.62], [0.32, -0.62], [-0.32, 0.62], [0.32, 0.62]] as Array<[number, number]>) {
    p('cyl', lx, 0, lz, 0.11, 0.8, 0.11, PAL.white);
    p('cyl', lx, 0, lz, 0.12, 0.14, 0.12, PAL.black);
  }
  p('ball', 0, 1.05, 0, 0.55, 0.45, 0.95, PAL.white);
  const patch = rng.pick(PAL.cowPatch);
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, 6.28), zz = rng.range(-0.6, 0.6);
    p('ball', Math.cos(a) * 0.47, 1.05 + Math.sin(a) * 0.36, zz, 0.2, 0.18, 0.28, patch);
  }
  const hy = grazing ? 0.62 : 1.3, hz = grazing ? -1.15 : -1.05, tilt = grazing ? -0.9 : -0.15;
  p('box', 0, hy, hz, 0.42, 0.42, 0.52, PAL.white, tilt);
  p('box', 0, hy - (grazing ? 0.22 : 0.08), hz - (grazing ? 0.18 : 0.3), 0.38, 0.24, 0.2, PAL.pink, tilt);
  for (const sx of [-1, 1]) {
    p('cone', sx * 0.2, hy + 0.2, hz + 0.1, 0.05, 0.22, 0.05, PAL.horn, 0);
    p('box', sx * 0.3, hy + 0.12, hz + 0.08, 0.2, 0.08, 0.12, patch);
    p('ball', sx * 0.15, hy + 0.06, hz - 0.27, 0.04, 0.04, 0.04, PAL.black);
  }
  p('cyl', 0, 0.55, 0.95, 0.03, 0.5, 0.03, PAL.white, 0.3);
  p('ball', 0, 0.55, 1.1, 0.07, 0.1, 0.07, patch);
}

/** Capybara (≈ 0.7 m long × scale) soaking (body centre near y): sleepy eyes and a yuzu on top. */
export function capybara(buf: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng, scale = 1.4): void {
  const p = parts(buf, trs(x, y, z, yaw, scale, scale, scale, new Matrix4()));
  const fur = rng.pick(PAL.capy);
  p('ball', 0, 0.2, 0.12, 0.32, 0.3, 0.45, fur);
  p('box', 0, 0.42, -0.3, 0.32, 0.3, 0.42, fur);
  p('box', 0, 0.36, -0.53, 0.26, 0.22, 0.06, PAL.capyDark);
  for (const sx of [-1, 1]) {
    p('ball', sx * 0.13, 0.62, -0.18, 0.06, 0.05, 0.04, PAL.capyDark);
    p('box', sx * 0.1, 0.5, -0.5, 0.09, 0.018, 0.02, PAL.black);
  }
  p('ball', 0, 0.68, -0.28, 0.1, 0.09, 0.1, PAL.yuzu);
  p('ball', 0.04, 0.78, -0.3, 0.05, 0.015, 0.03, PAL.leaf);
}
