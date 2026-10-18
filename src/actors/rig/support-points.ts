// Support points for crash contacts: the extreme vertices of a shape along many directions approximate its
// convex hull, so a tumbling body or bike touches the ground where its mesh really is (beak tip, helmet,
// wheel rims, bar ends) instead of through one fat sphere. Computed once per geometry / bike and cached.
import { Mesh, SkinnedMesh, type BufferGeometry, type Matrix4, type Object3D, Vector3 } from 'three';

const CUBE: Vector3[] = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  if (x || y || z) CUBE.push(new Vector3(x, y, z).normalize());
}
/** Evenly spread directions (Fibonacci sphere) for big rigid shapes such as the bike. */
const FIBO: Vector3[] = Array.from({ length: 256 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 256, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
  return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
});

/** Extreme points of a point set along `dirs` (deduplicated). */
function extremes(count: number, at: (i: number, out: Vector3) => Vector3, dirs: readonly Vector3[] = CUBE): Vector3[] {
  const best = dirs.map(() => ({ d: -Infinity, i: -1 }));
  const p = new Vector3();
  for (let i = 0; i < count; i++) {
    at(i, p);
    dirs.forEach((dir, k) => {
      const d = p.dot(dir), b = best[k] as { d: number; i: number };
      if (d > b.d) { b.d = d; b.i = i; }
    });
  }
  const ids = [...new Set(best.map((b) => b.i).filter((i) => i >= 0))];
  return ids.map((i) => at(i, new Vector3()));
}

const boneCache = new WeakMap<BufferGeometry, Vector3[][]>();

/**
 * Per bone: extreme vertices (offsets from the bone's bind position) of the vertices it dominates.
 * `rest` = bind positions per bone (character space; the bind matrix is identity).
 */
export function boneSupports(geo: BufferGeometry, rest: readonly Vector3[]): Vector3[][] {
  const hit = boneCache.get(geo);
  if (hit) return hit;
  const pos = geo.getAttribute('position'), si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
  const byBone: number[][] = rest.map(() => []);
  for (let v = 0; v < pos.count; v++) {
    let bi = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k);
      if (w > bw) { bw = w; bi = si.getComponent(v, k); }
    }
    byBone[bi]?.push(v);
  }
  const out = byBone.map((verts, b) => {
    const r = rest[b] as Vector3;
    return extremes(verts.length, (i, o) => o.fromBufferAttribute(pos, verts[i] as number).sub(r));
  });
  boneCache.set(geo, out);
  return out;
}

/** Support points that ride on one node of a rigid model (a bike bone or a plain mesh), in node space. */
export interface NodeSupports { node: Object3D; pts: Vector3[] }

const nodeCache = new WeakMap<BufferGeometry, Vector3[][]>();

/** Per bone of a rigidly skinned mesh: extreme vertices in that bone's bind space. */
function boneLocalSupports(mesh: SkinnedMesh): Vector3[][] {
  const geo = mesh.geometry as BufferGeometry;
  const hit = nodeCache.get(geo);
  if (hit) return hit;
  const pos = geo.getAttribute('position'), si = geo.getAttribute('skinIndex');
  const bones = mesh.skeleton.bones, inv = mesh.skeleton.boneInverses;
  const byBone: number[][] = bones.map(() => []);
  for (let v = 0; v < pos.count; v++) byBone[si.getComponent(v, 0)]?.push(v);
  const out = byBone.map((verts, b) => extremes(verts.length,
    (i, o) => o.fromBufferAttribute(pos, verts[i] as number).applyMatrix4(inv[b] as Matrix4), verts.length > 200 ? FIBO : CUBE));
  nodeCache.set(geo, out);
  return out;
}

/** Support points for every mesh under `root` (outline hulls skipped): per bone for skinned meshes. */
export function modelSupports(root: Object3D): NodeSupports[] {
  const out: NodeSupports[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh) || o.userData.isOutline) return;
    if (o instanceof SkinnedMesh) {
      boneLocalSupports(o).forEach((pts, b) => {
        const node = o.skeleton.bones[b];
        if (node && pts.length) out.push({ node, pts });
      });
      return;
    }
    const pos = (o.geometry as BufferGeometry).getAttribute('position');
    if (pos) out.push({ node: o, pts: extremes(pos.count, (i, v) => v.fromBufferAttribute(pos, i), FIBO) });
  });
  return out;
}
