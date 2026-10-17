// Primitive shapes written into a MeshBuf through a Matrix4 (flat or smooth normals, vertex colour).
// Unit shapes: box = cube −0.5..0.5; cylinder/cone = radius 1, y 0..1; sphere = radius 1.
import { Color, Matrix3, Matrix4, Vector3 } from 'three';
import type { MeshBuf } from '../geom';

const p = new Vector3(), n = new Vector3(), nm = new Matrix3();

function put(buf: MeshBuf, m: Matrix4, x: number, y: number, z: number, nx: number, ny: number, nz: number, c: Color): number {
  p.set(x, y, z).applyMatrix4(m);
  n.set(nx, ny, nz).applyMatrix3(nm).normalize();
  return buf.vert(p, n, c);
}

const BOX_FACES: Array<[number[], number[][]]> = [
  [[1, 0, 0], [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]]],
  [[-1, 0, 0], [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]]],
  [[0, 1, 0], [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]]],
  [[0, -1, 0], [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]]],
  [[0, 0, 1], [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]],
  [[0, 0, -1], [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]]],
];

/** Axis-aligned unit cube through `m`; optional per-face colours (+x, −x, +y, −y, +z, −z). */
export function box(buf: MeshBuf, m: Matrix4, c: Color, faces?: Array<Color | undefined>): void {
  nm.getNormalMatrix(m);
  BOX_FACES.forEach(([nv, quad], f) => {
    const col = faces?.[f] ?? c;
    const [nx, ny, nz] = nv as [number, number, number];
    const ids = quad.map(([x, y, z]) => put(buf, m, x ?? 0, y ?? 0, z ?? 0, nx, ny, nz, col));
    buf.quad(ids[0] ?? 0, ids[1] ?? 0, ids[2] ?? 0, ids[3] ?? 0);
  });
}

/** Cylinder (radius r0 at y=0 → r1 at y=1) with smooth sides and flat caps. */
export function cylinder(buf: MeshBuf, m: Matrix4, c: Color, segs = 10, r0 = 1, r1 = 1, caps = true, capColor?: Color): void {
  nm.getNormalMatrix(m);
  const slope = r0 - r1;
  const base = buf.count;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    put(buf, m, cx * r0, 0, cz * r0, cx, slope, cz, c);
    put(buf, m, cx * r1, 1, cz * r1, cx, slope, cz, c);
  }
  for (let i = 0; i < segs; i++) {
    const a = base + i * 2;
    buf.quad(a, a + 1, a + 3, a + 2);
  }
  if (!caps) return;
  const cc = capColor ?? c;
  for (const [y, r, ny] of [[1, r1, 1], [0, r0, -1]] as Array<[number, number, number]>) {
    if (r <= 1e-4) continue;
    const centre = put(buf, m, 0, y, 0, 0, ny, 0, cc);
    const ring = buf.count;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      put(buf, m, Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0, cc);
    }
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      if (ny > 0) buf.tri(centre, ring + j, ring + i);
      else buf.tri(centre, ring + i, ring + j);
    }
  }
}

/** Cone: radius 1 at y=0 to a point at y=1. */
export function cone(buf: MeshBuf, m: Matrix4, c: Color, segs = 10): void {
  cylinder(buf, m, c, segs, 1, 0.0001, true);
}

/** UV sphere (smooth); `squash` flattens the bottom half (blobby foliage). */
export function sphere(buf: MeshBuf, m: Matrix4, c: Color, w = 10, h = 7, bottom?: Color): void {
  nm.getNormalMatrix(m);
  const base = buf.count;
  for (let j = 0; j <= h; j++) {
    const v = j / h, phi = v * Math.PI;
    const col = bottom && v > 0.62 ? bottom : c;
    for (let i = 0; i <= w; i++) {
      const th = (i / w) * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
      put(buf, m, x, y, z, x, y, z, col);
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const a = base + j * (w + 1) + i, b = a + 1, d = a + w + 1, e = d + 1;
      buf.quad(a, b, e, d);
    }
  }
}

/** Matrix from position, Y rotation and scale (handy for placing unit shapes). */
export function trs(x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number, out = new Matrix4()): Matrix4 {
  const c = Math.cos(ry), s = Math.sin(ry);
  return out.set(
    c * sx, 0, s * sz, x,
    0, sy, 0, y,
    -s * sx, 0, c * sz, z,
    0, 0, 0, 1,
  );
}
