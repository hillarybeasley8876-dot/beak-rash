// Inverted-hull outlines for actors. Same look as render/toon.ts (black hull, object-space width) but
// works on SkinnedMesh (pushes along the skinned normal), honours a per-vertex `aOutline` width factor
// (thin lines on faces, none on pupils) and widens with view distance so silhouettes stay readable.
import { BackSide, Mesh, MeshBasicMaterial, SkinnedMesh, type BufferGeometry, type Object3D } from 'three';

export const OUTLINE_COLOR = '#0b0b0f';
const mats = new Map<string, MeshBasicMaterial>();

export function outlineMaterial(width: number, perVertex: boolean): MeshBasicMaterial {
  const key = `${width.toFixed(4)}|${perVertex}`;
  let m = mats.get(key);
  if (m) return m;
  m = new MeshBasicMaterial({ color: OUTLINE_COLOR, side: BackSide });
  const w = width.toFixed(4);
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${perVertex ? 'attribute float aOutline;' : ''}\nvoid main() {`)
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
#ifdef USE_SKINNING
  vec3 oN = normalize(objectNormal);
#else
  vec3 oN = normalize(normal);
#endif
  float oD = length((modelViewMatrix * vec4(transformed, 1.0)).xyz);
  transformed += oN * ${w} * ${perVertex ? 'aOutline' : '1.0'} * clamp(oD / 6.0, 0.55, 2.2);`,
      );
  };
  m.customProgramCacheKey = () => `actors-outline-${w}-${perVertex}`;
  mats.set(key, m);
  return m;
}

/** Hull for one mesh (shares its geometry; skinned meshes share the skeleton). */
export function hullFor(mesh: Mesh, width: number): Mesh {
  const perVertex = mesh.geometry.getAttribute('aOutline') !== undefined;
  const mat = outlineMaterial(width, perVertex);
  let hull: Mesh;
  if (mesh instanceof SkinnedMesh) {
    const s = new SkinnedMesh(mesh.geometry as BufferGeometry, mat);
    s.bind(mesh.skeleton, mesh.bindMatrix);
    s.bindMode = mesh.bindMode;
    hull = s;
  } else {
    hull = new Mesh(mesh.geometry, mat);
  }
  hull.userData.isOutline = true;
  hull.castShadow = false;
  hull.receiveShadow = false;
  hull.frustumCulled = mesh.frustumCulled;
  hull.renderOrder = mesh.renderOrder - 1;
  return hull;
}

/** Add outline hulls under every non-outline mesh of `root` (static props such as weapons). */
export function outlineAll(root: Object3D, width: number): void {
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh && !o.userData.isOutline && !o.userData.noOutline) meshes.push(o);
  });
  for (const mesh of meshes) mesh.add(hullFor(mesh, width));
}
