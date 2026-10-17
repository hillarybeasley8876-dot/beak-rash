// Tiny toon-prop toolkit for combat meshes: merge coloured primitives into one vertex-coloured geometry,
// wrap it as a toon mesh with an outline, or as an instanced fill + outline pair (pickups).
import {
  BufferAttribute, Color, Euler, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type BufferGeometry,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { outline, outlineMaterial, toon } from '../../../render/toon';

type V3 = readonly [number, number, number];

export class PartBuilder {
  private parts: BufferGeometry[] = [];
  private m = new Matrix4();
  private q = new Quaternion();
  private e = new Euler();

  /** Add a primitive (consumed: do not reuse `g`), coloured, posed by position / Euler rotation / scale. */
  add(g: BufferGeometry, color: ColorRepresentation, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): this {
    this.e.set(rot[0], rot[1], rot[2]);
    this.q.setFromEuler(this.e);
    this.m.compose(new Vector3(...pos), this.q, new Vector3(...scale));
    g.applyMatrix4(this.m);
    const c = new Color(color);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(col, 3));
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    this.parts.push(g);
    return this;
  }

  build(): BufferGeometry {
    const allIndexed = this.parts.every((g) => g.index !== null);
    const list = allIndexed ? this.parts : this.parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(list, false);
    if (!merged) throw new Error('[combat] PartBuilder: merge failed');
    for (const g of this.parts) g.dispose();
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Toon mesh with a black outline child (props 0.03–0.04 m). */
export function toonMesh(geo: BufferGeometry, outlineWidth = 0.03): Mesh {
  const mesh = new Mesh(geo, toon('#ffffff', { vertexColors: true }));
  outline(mesh, outlineWidth);
  return mesh;
}

/**
 * Instanced toon fill + outline sharing one instanceMatrix. Add `fill` to the scene (hull is its child). The
 * shared core outline material pushes vertices out before instancing, so it works for InstancedMesh too.
 */
export function instancedToon(geo: BufferGeometry, max: number, outlineWidth = 0.03): { fill: InstancedMesh; hull: InstancedMesh } {
  const fill = new InstancedMesh(geo, toon('#ffffff', { vertexColors: true }), max);
  const hull = new InstancedMesh(geo, outlineMaterial('#0b0b0f', outlineWidth), max);
  hull.instanceMatrix = fill.instanceMatrix;
  hull.userData.isOutline = true;
  hull.renderOrder = -1;
  fill.count = hull.count = 0;
  fill.frustumCulled = hull.frustumCulled = false;
  fill.add(hull);
  return { fill, hull };
}
