// The two materials every bike shares: cel-shaded body (vertex colours × decal atlas, toon ramp from
// render/toon.ts) and the inverted-hull outline (per-vertex width + crack-free smoothed normals,
// widened with view distance like the riders' outlines, capped lower so thin tubes keep their colour).
import { BackSide, MeshBasicMaterial, MeshToonMaterial } from 'three';
import { toonRamp } from '../../../render/toon';
import { decalAtlas } from './atlas';

export const OUTLINE_COLOR = '#0b0b0f';

let body: MeshToonMaterial | null = null;
let hull: MeshBasicMaterial | null = null;

export function bodyMaterial(): MeshToonMaterial {
  if (body) return body;
  body = new MeshToonMaterial({
    color: '#ffffff', vertexColors: true, map: decalAtlas(), gradientMap: toonRamp(), alphaTest: 0.5,
  });
  body.name = 'bikes:body';
  return body;
}

export function hullMaterial(): MeshBasicMaterial {
  if (hull) return hull;
  hull = new MeshBasicMaterial({ color: OUTLINE_COLOR, side: BackSide });
  hull.name = 'bikes:hull';
  hull.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float aOutline;\nattribute vec3 aOutlineN;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  float oD = length((modelViewMatrix * vec4(transformed, 1.0)).xyz);
  transformed += normalize(aOutlineN) * aOutline * clamp(oD / 6.0, 0.55, 1.6);`,
      );
  };
  hull.customProgramCacheKey = () => 'bikes-hull-v2';
  return hull;
}
