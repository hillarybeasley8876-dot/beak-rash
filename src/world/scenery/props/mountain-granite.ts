// Bevelled granite for the Sunset Pass walls (env-mountain). The same jittered-icosahedron rock as
// props/rocks.ts crag(), subdivided once: every edge midpoint is pushed out toward the rock's
// ellipsoid, so the broad planes keep one flat toon tone while each edge gets a bevel facet and the
// silhouette rounds off (a chunky vinyl-toy rock instead of a crude 20-facet lump).
import { Color, IcosahedronGeometry, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';

/** Unit icosahedron corners and faces (corner indices), read once from three's geometry. */
const ICO = ((): { v: Vector3[]; f: Array<[number, number, number]> } => {
  const geo = new IcosahedronGeometry(1, 0);
  const pos = geo.getAttribute('position');
  const v: Vector3[] = [];
  const index = (i: number): number => {
    const p = new Vector3().fromBufferAttribute(pos, i);
    const k = v.findIndex((q) => q.distanceToSquared(p) < 1e-6);
    if (k >= 0) return k;
    v.push(p);
    return v.length - 1;
  };
  const f: Array<[number, number, number]> = [];
  for (let i = 0; i < pos.count; i += 3) f.push([index(i), index(i + 1), index(i + 2)]);
  geo.dispose();
  return { v, f };
})();

/** Granite tones shared by the wall, portal and lip rocks (same warm family as env/mountain-grade.ts PAL.rock). */
export const GRANITE = [new Color('#cf9f86'), new Color('#b4846f'), new Color('#93695f')] as const;

/** Midpoint lift: 1 = flat chamfer, 1 / cos(edge half-angle) ≈ 1.175 = fully on the sphere. */
const BEVEL = 1.11;

const corner = ICO.v.map(() => new Vector3());
const mid = [new Vector3(), new Vector3(), new Vector3()];
const n = new Vector3(), e1 = new Vector3(), e2 = new Vector3(), shade = new Color(), plane = new Color();

function facet(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, col: Color): void {
  n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
  // Up-facing facets slightly lighter (sun-bleached tops), like crag().
  shade.copy(col).multiplyScalar(0.95 + 0.07 * Math.max(0, n.y));
  buf.tri(buf.vert(a, n, shade), buf.vert(b, n, shade), buf.vert(c, n, shade));
}

/**
 * Granite rock centred at (x, y, z), half-extents (sx, sy, sz), yaw ry (drop-in for crag()); `flatBase`
 * squashes the lower half so it sits on (or sinks into) the ground. 80 facets: 4 per icosahedron face.
 */
export function bevelRock(buf: MeshBuf, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, rng: Rng, col: Color,
  flatBase = true): void {
  const c = Math.cos(ry), s = Math.sin(ry);
  // Local (unit-ish, jittered) corners; the world transform happens per facet vertex.
  ICO.v.forEach((v, i) => (corner[i] as Vector3).copy(v).multiplyScalar(rng.range(0.74, 1.1)));
  const world = (p: Vector3): Vector3 => {
    const py = flatBase && p.y < 0 ? p.y * 0.55 : p.y;
    const px = p.x * sx, pz = p.z * sz;
    return p.set(x + px * c + pz * s, y + py * sy, z - px * s + pz * c);
  };
  const tmp = [new Vector3(), new Vector3(), new Vector3()];
  for (const [ia, ib, ic] of ICO.f) {
    const A = corner[ia] as Vector3, B = corner[ib] as Vector3, C = corner[ic] as Vector3;
    (mid[0] as Vector3).addVectors(A, B).multiplyScalar(0.5 * BEVEL);
    (mid[1] as Vector3).addVectors(B, C).multiplyScalar(0.5 * BEVEL);
    (mid[2] as Vector3).addVectors(C, A).multiplyScalar(0.5 * BEVEL);
    // One tone per original face (the plane), a little noise between planes.
    plane.copy(col).multiplyScalar(1 + rng.range(-0.035, 0.035));
    const [m0, m1, m2] = mid.map((m) => world(m.clone())) as [Vector3, Vector3, Vector3];
    const [a, b, d] = [A, B, C].map((p, k) => world((tmp[k] as Vector3).copy(p))) as [Vector3, Vector3, Vector3];
    facet(buf, a, m0, m2, plane);
    facet(buf, m0, b, m1, plane);
    facet(buf, m2, m1, d, plane);
    facet(buf, m0, m1, m2, plane);
  }
}
