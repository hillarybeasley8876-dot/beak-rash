// Primitive geometry builders in bike space (metres, −Z forward, +X right, +Y up).
// Every helper returns a fresh BufferGeometry already placed where it belongs on the bike.
import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, LatheGeometry,
  Matrix4, Quaternion, SphereGeometry, TubeGeometry, Vector2, Vector3, type Euler, type Shape,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type V3 = Vector3;
export const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
export const AX = new Vector3(1, 0, 0);
const UP = new Vector3(0, 1, 0);

/** Quality-scaled segment counter: seg(12) → 12 on high, 9 on medium, 6 on low. */
export type Seg = (n: number, min?: number) => number;
export const segScale = (q: number): Seg => (n, min = 3) => Math.max(min, Math.round(n * q));
/** Far-LOD counter (bikes ≥ 35 m away, where a frame tube is under a pixel wide): about a third of the high
 *  count; quality minimums above 3 are ignored (a 4-sided tube reads round at that size). */
export const farSeg: Seg = (n, min = 3) => Math.max(Math.min(min, 3), Math.round(n * 0.35));

const orient = (g: BufferGeometry, from: Vector3, to: Vector3): BufferGeometry =>
  g.applyQuaternion(new Quaternion().setFromUnitVectors(from, to.clone().normalize()));

/** Tapered cylinder from a (radius r0) to b (radius r1). */
export function cyl(a: V3, b: V3, r0: number, r1 = r0, seg = 8, caps = false): BufferGeometry {
  const dir = b.clone().sub(a);
  const g = new CylinderGeometry(r1, r0, dir.length(), seg, 1, !caps);
  orient(g, UP, dir);
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}

export function sph(c: V3, r: number, w = 8, h = 6): BufferGeometry {
  return new SphereGeometry(r, w, h).translate(c.x, c.y, c.z);
}

/** Ellipsoid with radii (rx, ry, rz), optionally rotated (Euler, radians). */
export function ellip(c: V3, rx: number, ry: number, rz: number, w = 8, h = 6, rot?: Euler): BufferGeometry {
  const g = new SphereGeometry(1, w, h).scale(rx, ry, rz);
  if (rot) g.applyMatrix4(new Matrix4().makeRotationFromEuler(rot));
  return g.translate(c.x, c.y, c.z);
}

export function box(c: V3, sx: number, sy: number, sz: number, rot?: Euler): BufferGeometry {
  const g = new BoxGeometry(sx, sy, sz);
  if (rot) g.applyMatrix4(new Matrix4().makeRotationFromEuler(rot));
  return g.translate(c.x, c.y, c.z);
}

/** Box spanning a → b (its long axis), with cross-section w (x-ish) × h. */
export function bar(a: V3, b: V3, w: number, h: number): BufferGeometry {
  const dir = b.clone().sub(a);
  const g = new BoxGeometry(w, dir.length(), h);
  orient(g, UP, dir);
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}

/** Lathe of profile points [radius, along-axis] around `axis` through c. Faces point outward when the
 *  profile runs toward +axis along its outer side (closed profiles: counter-clockwise in (r, h)). */
export function lathe(profile: ReadonlyArray<readonly [number, number]>, seg: number, c: V3, axis = AX): BufferGeometry {
  const g = new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), seg);
  orient(g, UP, axis);
  return g.translate(c.x, c.y, c.z);
}

/** Smooth tube through points (centripetal Catmull-Rom). */
export function tube(points: V3[], r: number, tubular: number, radial: number, closed = false): BufferGeometry {
  const curve = new CatmullRomCurve3(points, closed, 'centripetal');
  return new TubeGeometry(curve, tubular, r, radial, closed);
}

/** Extrude a 2D shape (XY) by depth along Z, centred on z = 0. */
export function extrude(shape: Shape, depth: number, bevel = 0, bevelSeg = 1, curveSeg = 6): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth, curveSegments: curveSeg, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: bevelSeg, steps: 1,
  });
  return g.translate(0, 0, -depth / 2);
}

/** Weld coincident vertices (ignoring uv seams) and recompute normals: smooth toon shading on extrusions. */
export function smooth(g: BufferGeometry, tolerance = 1e-4): BufferGeometry {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const merged = mergeVertices(g, tolerance);
  merged.computeVertexNormals();
  return merged;
}

/** Ring (collar, headset cup, seat clamp) around `axis` through c: rIn..rOut, height h, rounded outer edges. */
export function roundRing(c: V3, axis: V3, rIn: number, rOut: number, h: number, seg: number): BufferGeometry {
  const e = Math.min(h / 3, (rOut - rIn) / 2);
  return lathe([[rIn, -h / 2], [rOut - e, -h / 2], [rOut, -h / 2 + e], [rOut, h / 2 - e], [rOut - e, h / 2], [rIn, h / 2]], seg, c, axis);
}

/** Pill a → b (radius r) with domed ends: rounded clamps, bar ends, lever blades. */
export function pill(a: V3, b: V3, r: number, seg: number): BufferGeometry {
  const dir = b.clone().sub(a), len = dir.length(), k = Math.min(r, len / 2);
  const prof: Array<[number, number]> = [[0, 0], [r * 0.7, k * 0.3], [r, k], [r, len - k], [r * 0.7, len - k * 0.3], [0, len]];
  return lathe(prof, seg, a, dir.normalize());
}
