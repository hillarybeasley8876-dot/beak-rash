// Fittings (bike space): front basket, lamp, kickstand, reflectors, chain guard and number plates.
import { PlaneGeometry, Shape, Vector3 } from 'three';
import { box, cyl, ellip, extrude, lathe, pill, sph, tube, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import { decalUv, type DecalId } from '../build/atlas';
import { chainLoop } from '../build/strip';
import { decal, facing } from './accessories';

/** Open grid basket; `c` = floor centre. Returns the floor centre (→ basket marker). */
export function basket(ps: PartSet, c: V3, w: number, h: number, d: number, rimColor: string, mount: V3[], seg: Seg): V3 {
  ps.add(box(c, w, 0.012, d), { color: '#2a2c31', outline: 0.01 });
  const hy = c.y + h / 2;
  const up = v(0, 1, 0);
  decal(ps, 'grid', v(c.x, hy, c.z - d / 2), v(0, 0, -1), up, w, h, true);
  decal(ps, 'grid', v(c.x, hy, c.z + d / 2), v(0, 0, 1), up, w, h, true);
  decal(ps, 'grid', v(c.x - w / 2, hy, c.z), v(-1, 0, 0), up, d, h, true);
  decal(ps, 'grid', v(c.x + w / 2, hy, c.z), v(1, 0, 0), up, d, h, true);
  const y = c.y + h, k = 0.02;
  const rim = [
    v(-w / 2 + k, y, -d / 2), v(w / 2 - k, y, -d / 2), v(w / 2, y, -d / 2 + k), v(w / 2, y, d / 2 - k),
    v(w / 2 - k, y, d / 2), v(-w / 2 + k, y, d / 2), v(-w / 2, y, d / 2 - k), v(-w / 2, y, -d / 2 + k),
  ].map((p) => p.add(new Vector3(c.x, 0, c.z)));
  ps.add(tube(rim, 0.009, seg(24, 12), seg(6, 4), true), { color: rimColor, outline: 0.012 });
  for (const sx of [-1, 1]) {
    ps.detail.add(cyl(v(c.x + sx * w / 2, c.y, c.z - d / 2), v(c.x + sx * w / 2, y, c.z - d / 2), 0.006, 0.006, 4), { color: rimColor });
  }
  if (mount.length > 1) ps.detail.add(tube(mount, 0.008, seg(8, 4), 6), { color: '#3a3d44', outline: 0.008 });
  return c.clone();
}

/** Round head lamp pointing `dir` (unit), bracket back to `mount`. */
export function lamp(ps: PartSet, at: V3, dir: V3, mount: V3, shell: string, seg: Seg, r = 0.04): void {
  ps.add(lathe([[0.006, -r * 1.1], [r * 0.7, -r * 0.8], [r, -r * 0.1], [r * 1.02, 0]], seg(16, 10), at, dir), { color: shell, outline: 0.012 });
  const lens = at.clone().addScaledVector(dir, 0.004);
  ps.add(ellip(v(0, 0, 0), r * 0.92, r * 0.92, r * 0.3, seg(14, 8), seg(6, 4)).lookAt(dir).translate(lens.x, lens.y, lens.z), { color: '#fff6b8', glow: true });
  ps.detail.add(cyl(at.clone().addScaledVector(dir, -r), mount, 0.007, 0.007, 6), { color: '#3a3d44', outline: 0.006 });
}

/** Folded side stand on the left chainstay. */
export function kickstand(ps: PartSet, pivot: V3, tip: V3, color: string, seg: Seg): void {
  if (ps.far) return;
  ps.add(cyl(pivot, tip, 0.011, 0.008, seg(10, 6), true), { color, outline: 0.008 });
  ps.add(sph(pivot, 0.016, seg(8, 5), seg(5, 4)), { color, outline: 0.008 });
  ps.add(ellip(tip, 0.012, 0.008, 0.022, seg(8, 5), seg(5, 3)), { color, outline: 0.008 });
}

/** Flat reflector facing `normal` (+Z rear red, −Z front white). */
export function reflector(ps: PartSet, at: V3, normal: V3, color: string, w = 0.05, h = 0.03): void {
  const g = box(v(0, 0, 0), w, h, 0.01);
  g.lookAt(normal);
  ps.add(g.translate(at.x, at.y, at.z), { color, outline: 0.006 });
}

/** Full chain case on the right side (x), covering the chainring and the top run; optional decal. */
export function chainGuard(ps: PartSet, bb: V3, ringR: number, hub: V3, cogR: number, x: number, color: string, seg: Seg, label?: DecalId): void {
  const pts = chainLoop(v(0, bb.y, bb.z), ringR + 0.022, v(0, hub.y, hub.z), cogR + 0.024, seg(10, 5));
  const shape = new Shape();
  pts.forEach((p, i) => (i ? shape.lineTo(-p.z, p.y) : shape.moveTo(-p.z, p.y)));
  shape.closePath();
  ps.add(extrude(shape, 0.018, 0, 1, 1).rotateY(Math.PI / 2).translate(x, 0, 0), { color, outline: 0.012 });
  if (label) {
    const mid = v(x + 0.0095, bb.y + ringR * 0.55, (bb.z + hub.z) / 2 + 0.03);
    const len = Math.abs(hub.z - bb.z) * 0.62;
    decal(ps, label, mid, v(1, 0, 0), v(0, 1, 0).applyAxisAngle(v(1, 0, 0), -Math.atan2(hub.y - bb.y, hub.z - bb.z)), len, len / 4);
  }
}

/** Rear-facing race-number plate centred at `at` (decal on the back), on two struts to `mount`. */
export function rearPlate(ps: PartSet, at: V3, w: number, h: number, mount: V3): void {
  ps.add(box(at, w, h, 0.006), { color: '#f5f5f0', outline: 0.008 });
  decal(ps, 'plate', at.clone().add(v(0, 0, 0.0035)), v(0, 0, 1), v(0, 1, 0), w, h);
  for (const s of [-1, 1]) {
    ps.detail.add(cyl(at.clone().add(v(s * w * 0.3, h * 0.3, -0.003)), mount.clone().add(v(s * 0.012, 0, 0)), 0.0045, 0.0045, 6), { color: '#3a3d44', outline: 0.003 });
  }
}

/** Chunky rear light: dark pill body along X on a bracket from `mount`, a self-lit lens facing back: a glowing
 *  colour cap, or 'decal' for the LED lens from the atlas. */
export function tailLight(ps: PartSet, at: V3, mount: V3, len: number, r: number, lens: string, seg: Seg): void {
  ps.add(pill(at.clone().setX(at.x - len / 2), at.clone().setX(at.x + len / 2), r, seg(12, 8)), { color: '#2a2c31', outline: 0.008 });
  ps.detail.add(cyl(mount, at, 0.006, 0.006, 6), { color: '#3a3d44', outline: 0.004 });
  const face = at.clone().add(v(0, 0, r + 0.0015));
  if (lens === 'decal') ps.add(facing(new PlaneGeometry(len * 0.98, r * 1.9), face, v(0, 0, 1), v(0, 1, 0)), { decal: decalUv('taillight'), glow: true });
  else ps.add(ellip(face.add(v(0, 0, -0.004)), len * 0.4, r * 0.7, 0.007, seg(12, 8), seg(6, 4)), { color: lens, glow: true });
}
