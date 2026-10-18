// Tyre and rim geometry (bike space, authored around a hub; the wheel plane is YZ, the axle is X).
// Tyres are lathes of an open round cross-section that stops at the rim beads, so every segment is spent on
// the visible arc; knobbly tyres get a ring of zig-zag tread blocks; rims are lathed box / deep / deep-V
// sections.
import { BoxGeometry, Matrix4, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lathe, type V3 } from '../build/geo';

const BEAD = (128 * Math.PI) / 180;

/** Round tyre of outer radius R and tube radius t: `tubular` segments around, `segs` across the tread. */
export function tyreGeo(hub: V3, R: number, t: number, tubular: number, segs: number): BufferGeometry {
  const rc = R - t;
  const profile: Array<[number, number]> = [];
  for (let i = 0; i <= segs; i++) {
    const a = -BEAD + (2 * BEAD * i) / segs;
    profile.push([rc + Math.cos(a) * t, Math.sin(a) * t]);
  }
  return lathe(profile, tubular, hub);
}

/** Ring of `n` tread blocks standing `h` proud of the tyre, alternating left / right of the centre line. */
export function treadBlocks(hub: V3, R: number, t: number, n: number, h: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const len = ((Math.PI * 2 * R) / n) * 0.52, inner = R - t * 0.55, height = R + h - inner;
  const X = new Vector3(1, 0, 0), d = new Vector3(), T = new Vector3(), m = new Matrix4();
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * Math.PI * 2, side = k % 2 ? 1 : -1;
    d.set(0, Math.sin(a), Math.cos(a));
    T.set(0, -Math.cos(a), Math.sin(a));
    const box = new BoxGeometry(t * 1.05, height, len);
    const idx = box.getIndex();
    if (idx) box.setIndex(Array.from(idx.array).filter((_, i) => i < 18 || i >= 24)); // drop the bottom face
    const c = hub.clone().addScaledVector(d, inner + height / 2).addScaledVector(X, side * t * 0.32);
    m.makeBasis(X, d, T).setPosition(c);
    parts.push(box.applyMatrix4(m));
  }
  const g = mergeGeometries(parts);
  if (!g) throw new Error('[bikes] tread blocks failed to merge');
  return g;
}

export type RimKind = 'box' | 'deep' | 'deepV' | 'mag';

/** Rim section lathes: one profile, or three (outer walls + inner band) for two-tone aero rims. */
export function rimGeos(hub: V3, rOut: number, rIn: number, hw: number, kind: RimKind, ring: number, twoTone: boolean): BufferGeometry[] {
  const inner = kind === 'deepV' ? 0.003 : hw * 0.75;
  if (!twoTone) return [lathe([[rOut, hw], [rIn, inner], [rIn, -inner], [rOut, -hw]], ring, hub)];
  const rMid = (rOut + rIn) / 2, mid = (hw + inner) / 2;
  return [
    lathe([[rOut, hw], [rMid, mid]], ring, hub),
    lathe([[rMid, -mid], [rOut, -hw]], ring, hub),
    lathe([[rMid, mid], [rIn, inner], [rIn, -inner], [rMid, -mid]], ring, hub),
  ];
}
