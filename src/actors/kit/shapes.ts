// 2D-outline helpers: bevelled extrusions welded into smooth indexed meshes (feathers, feet, ears,
// beak plates). Shapes are drawn in XY and extruded along Z, centred on z = 0.
import { BufferAttribute, ExtrudeGeometry, type BufferGeometry, type Shape } from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface ExtrudeOpts {
  depth: number;
  /** Bevel size as a fraction of depth (rounded rims). */
  bevel?: number;
  curveSegments?: number;
  bevelSegments?: number;
  /** Split faces until no edge is longer than this (m) — lets vertex colours form crisp bands. */
  maxEdge?: number;
}

/** Extrude + weld + smooth normals. Returns an indexed geometry with position + normal only. */
export function extrudeSmooth(shape: Shape, o: ExtrudeOpts): BufferGeometry {
  const bevel = o.bevel ?? 0.45;
  const raw = new ExtrudeGeometry(shape, {
    depth: o.depth, bevelEnabled: bevel > 0, bevelThickness: o.depth * bevel, bevelSize: o.depth * bevel,
    bevelSegments: o.bevelSegments ?? 2, curveSegments: o.curveSegments ?? 6,
  });
  raw.translate(0, 0, -o.depth * 0.5);
  raw.deleteAttribute('uv');
  raw.deleteAttribute('normal');
  const fine = o.maxEdge ? new TessellateModifier(o.maxEdge, 6).modify(raw) : raw;
  const g = mergeVertices(fine, 1e-5);
  raw.dispose();
  if (fine !== raw) fine.dispose();
  g.computeVertexNormals();
  return g;
}

/** Copy of the position attribute as a plain array (for per-vertex lookups before warping). */
export function positionsOf(g: BufferGeometry): Float32Array {
  const a = g.getAttribute('position');
  return new Float32Array(a.array as ArrayLike<number>);
}

/** Replace positions (after a warp) and recompute smooth normals. */
export function setPositions(g: BufferGeometry, pos: Float32Array): void {
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.computeVertexNormals();
}

/** Reverse triangle winding (call before setPositions when a warp mirrors the shape) so faces point outward. */
export function flipWinding(g: BufferGeometry): void {
  const idx = g.index;
  if (!idx) return;
  const a = idx.array;
  for (let i = 0; i + 2 < a.length; i += 3) {
    const t = a[i + 1] ?? 0;
    a[i + 1] = a[i + 2] ?? 0;
    a[i + 2] = t;
  }
  idx.needsUpdate = true;
}
