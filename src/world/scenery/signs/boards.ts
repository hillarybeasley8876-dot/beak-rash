// Sign structures: textured faces (atlas, unlit so they stay readable) + their frames and posts
// (toon props). Faces look toward local −Z after `yaw`; see faceYaw() for aiming at riders.
import { Color, Matrix4, Vector3 } from 'three';
import type { MeshBuf } from '../../geom';
import { box, cylinder, trs } from '../../kit/shapes';
import type { AtlasRect } from './atlas';

const WHITE = new Color('#ffffff');
const FRAME = new Color('#1c1d22'), STEEL = new Color('#8e98a4'), BACK = new Color('#c7ccd2');
const m = new Matrix4();
const n = new Vector3(), r = new Vector3(), up = new Vector3(0, 1, 0), p = new Vector3();

/** Yaw for a face whose normal is `nx, nz` (horizontal). */
export const yawFor = (nx: number, nz: number): number => Math.atan2(-nx, -nz);

/**
 * Textured quad centred at c (world) with normal from yaw, size w × h. `mirror` flips u.
 * Written into an unlit faces buffer.
 */
export function faceQuad(buf: MeshBuf, c: Vector3, yaw: number, w: number, h: number, rect: AtlasRect, mirror = false): void {
  n.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  r.crossVectors(up, n).normalize();
  const u0 = mirror ? rect.u1 : rect.u0, u1 = mirror ? rect.u0 : rect.u1;
  const corners: Array<[number, number, number, number]> = [[-1, -1, u0, rect.v0], [1, -1, u1, rect.v0], [1, 1, u1, rect.v1], [-1, 1, u0, rect.v1]];
  const ids = corners.map(([sx, sy, u, v]) => {
    p.copy(c).addScaledVector(r, (sx * w) / 2).addScaledVector(up, (sy * h) / 2);
    return buf.vert(p, n, WHITE, u, v);
  });
  buf.quad(ids[0] ?? 0, ids[1] ?? 0, ids[2] ?? 0, ids[3] ?? 0);
}

/** Point offset from c along the face's normal by d (positive = toward the viewer). */
function ahead(c: Vector3, yaw: number, d: number, out = new Vector3()): Vector3 {
  return out.set(c.x - Math.sin(yaw) * d, c.y, c.z - Math.cos(yaw) * d);
}

/** Billboard: face w × h with its bottom at `lift` above ground (x, y, z) on two posts. */
export function billboard(
  props: MeshBuf, faces: MeshBuf, x: number, y: number, z: number, yaw: number, w: number, h: number, lift: number, rect: AtlasRect,
): void {
  const cy = y + lift + h / 2;
  box(props, trs(x, cy, z, yaw, w + 0.36, h + 0.36, 0.3, m), FRAME);
  const back = ahead(new Vector3(x, cy, z), yaw, -0.17);
  box(props, trs(back.x, back.y, back.z, yaw, w, h, 0.04, m), BACK);
  faceQuad(faces, ahead(new Vector3(x, cy, z), yaw, 0.16), yaw, w, h, rect);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  for (const k of [-0.3, 0.3]) {
    const px = x + rx * k * w, pz = z + rz * k * w;
    cylinder(props, trs(px, y - 0.5, pz, 0, 0.16, lift + 0.6, 0.16, m), STEEL, 8, 1, 1, false);
    box(props, trs(px, y + lift * 0.55, pz, yaw, 0.12, 0.12, 1.4, m), STEEL);
  }
  // Catwalk under the face.
  const cw = ahead(new Vector3(x, y + lift - 0.12, z), yaw, 0.45);
  box(props, trs(cw.x, cw.y, cw.z, yaw, w, 0.08, 0.7, m), FRAME);
}

/** Road sign plate on one post. */
export function postSign(
  props: MeshBuf, faces: MeshBuf, x: number, y: number, z: number, yaw: number, w: number, h: number, lift: number, rect: AtlasRect,
  mirror = false,
): void {
  const cy = y + lift + h / 2;
  box(props, trs(x, cy, z, yaw, w + 0.08, h + 0.08, 0.06, m), FRAME);
  faceQuad(faces, ahead(new Vector3(x, cy, z), yaw, 0.04), yaw, w, h, rect, mirror);
  const post = ahead(new Vector3(x, y, z), yaw, -0.08);
  cylinder(props, trs(post.x, y - 0.4, post.z, 0, 0.06, lift + h * 0.8 + 0.4, 0.06, m), STEEL, 6, 1, 1, false);
}

/** Free-standing panel (banners on frames along barriers): two short legs. */
export function panel(
  props: MeshBuf, faces: MeshBuf, x: number, y: number, z: number, yaw: number, w: number, h: number, lift: number, rect: AtlasRect,
): void {
  const cy = y + lift + h / 2;
  box(props, trs(x, cy, z, yaw, w + 0.12, h + 0.12, 0.08, m), FRAME);
  faceQuad(faces, ahead(new Vector3(x, cy, z), yaw, 0.05), yaw, w, h, rect);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  for (const k of [-0.45, 0, 0.45]) {
    box(props, trs(x + rx * k * w, y + (lift + 0.1) / 2 - 0.2, z + rz * k * w, yaw, 0.1, lift + 0.5, 0.1, m), FRAME);
  }
}
