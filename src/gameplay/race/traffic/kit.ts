// Tiny geometry kit for chunky toy vehicles: coloured primitives merged into one BufferGeometry.
// Rounded boxes keep smooth normals so the inverted-hull outlines stay closed.
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, Matrix4, Quaternion,
  SphereGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];

const tmpColor = new Color();
const m = new Matrix4();
const q = new Quaternion();

/** Paint every vertex of `geo` with `color`, drop UVs, and place it at `pos` with Euler `rot`. */
function finish(geo: BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): BufferGeometry {
  // RoundedBoxGeometry is non-indexed, so every part is made non-indexed to merge cleanly.
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  tmpColor.set(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = tmpColor.r;
    col[i * 3 + 1] = tmpColor.g;
    col[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  q.setFromEuler(new Euler(rot[0], rot[1], rot[2]));
  m.compose(new Vector3(...pos), q, new Vector3(...scale));
  g.applyMatrix4(m);
  return g;
}

/** Rounded box: size [w, h, d], corner radius r (small parts get a cheaper 1-segment bevel). */
export function rbox(size: V3, color: string, pos: V3, r = 0.12, rot?: V3): BufferGeometry {
  const rad = Math.min(r, size[0] / 2 - 0.005, size[1] / 2 - 0.005, size[2] / 2 - 0.005);
  const big = rad >= 0.15 && Math.min(...size) > 0.6;
  return finish(new RoundedBoxGeometry(size[0], size[1], size[2], big ? 2 : 1, Math.max(0.005, rad)), color, pos, rot);
}

/** Plain box (12 triangles) for tiny details. */
export function box(size: V3, color: string, pos: V3, rot?: V3): BufferGeometry {
  return finish(new BoxGeometry(size[0], size[1], size[2]), color, pos, rot);
}

export function sphere(radius: number, color: string, pos: V3, scale: V3 = [1, 1, 1], segs = 12): BufferGeometry {
  return finish(new SphereGeometry(radius, segs, Math.max(6, Math.round(segs * 0.7))), color, pos, [0, 0, 0], scale);
}

export function cylinder(rTop: number, rBot: number, h: number, color: string, pos: V3, rot?: V3, segs = 14): BufferGeometry {
  return finish(new CylinderGeometry(rTop, rBot, h, segs), color, pos, rot);
}

export function cone(r: number, h: number, color: string, pos: V3, rot?: V3, segs = 14): BufferGeometry {
  return finish(new ConeGeometry(r, h, segs), color, pos, rot);
}

/** Merge parts (non-indexed, position/normal/color) into one geometry. */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!out) throw new Error('[race] traffic: could not merge vehicle parts');
  out.computeBoundingSphere();
  return out;
}

/** Quad with explicit UV rect (u0,v0,u1,v1) spanning corner `a` → `b` along `uDir`, height along +Y. */
export function decalQuad(center: V3, uDir: V3, width: number, height: number, uv: [number, number, number, number]): BufferGeometry {
  const [cx, cy, cz] = center;
  const hx = (uDir[0] * width) / 2, hz = (uDir[2] * width) / 2, hh = height / 2;
  const pos = new Float32Array([
    cx - hx, cy - hh, cz - hz, cx + hx, cy - hh, cz + hz, cx + hx, cy + hh, cz + hz,
    cx - hx, cy - hh, cz - hz, cx + hx, cy + hh, cz + hz, cx - hx, cy + hh, cz - hz,
  ]);
  const [u0, v0, u1, v1] = uv;
  const uvs = new Float32Array([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1]);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
