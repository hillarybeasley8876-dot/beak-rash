// The materials every bike shares: cel-shaded body (vertex colours × decal atlas on the render/toon.ts ramp,
// plus gloss-driven toon specular, chrome banding and a cool stepped rim), the inverted-hull outline
// (per-vertex width + crack-free smoothed normals, widened with view distance like the riders' outlines,
// capped lower so thin tubes keep their colour) and a shadow depth material. All three honour the per-bone
// dissolve (spokes ↔ speed blur, see build/shading-glsl.ts).
import { BackSide, MeshBasicMaterial, MeshDepthMaterial, MeshToonMaterial, RGBADepthPacking, type WebGLProgramParametersWithUniforms } from 'three';
import { toonRamp } from '../../../render/toon';
import { decalAtlas } from './atlas';
import {
  FADE_FRAGMENT, FADE_FRAGMENT_DECL, FADE_VERTEX, FADE_VERTEX_DECL, FINISH_FRAGMENT, GLOSS_FRAGMENT_DECL,
  GLOSS_VERTEX, GLOSS_VERTEX_DECL,
} from './shading-glsl';

export const OUTLINE_COLOR = '#0b0b0f';

let body: MeshToonMaterial | null = null;
let hull: MeshBasicMaterial | null = null;
let depth: MeshDepthMaterial | null = null;

/** Inject the per-bone dissolve into any skinned material's shaders. */
function addFade(shader: WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace('void main() {', `${FADE_VERTEX_DECL}\nvoid main() {`)
    .replace('#include <skinbase_vertex>', `#include <skinbase_vertex>${FADE_VERTEX}`);
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', `${FADE_FRAGMENT_DECL}\nvoid main() {${FADE_FRAGMENT}`);
}

export function bodyMaterial(): MeshToonMaterial {
  if (body) return body;
  body = new MeshToonMaterial({
    color: '#ffffff', vertexColors: true, map: decalAtlas(), gradientMap: toonRamp(), alphaTest: 0.5,
  });
  body.name = 'bikes:body';
  body.onBeforeCompile = (shader) => {
    addFade(shader);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${GLOSS_VERTEX_DECL}\nvoid main() {\n  ${GLOSS_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${GLOSS_FRAGMENT_DECL}\nvoid main() {`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>${FINISH_FRAGMENT}`);
  };
  body.customProgramCacheKey = () => 'bikes-body-v4';
  return body;
}

export function hullMaterial(): MeshBasicMaterial {
  if (hull) return hull;
  hull = new MeshBasicMaterial({ color: OUTLINE_COLOR, side: BackSide });
  hull.name = 'bikes:hull';
  hull.onBeforeCompile = (shader) => {
    addFade(shader);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float aOutline;\nattribute vec3 aOutlineN;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  float oD = length((modelViewMatrix * vec4(transformed, 1.0)).xyz);
  transformed += normalize(aOutlineN) * aOutline * clamp(oD / 6.0, 0.55, 1.6);`,
      );
  };
  hull.customProgramCacheKey = () => 'bikes-hull-v3';
  return hull;
}

/** Shadow-map material: atlas alpha test + the dissolve, so hidden spokes / blur discs cast no shadow. */
export function depthMaterial(): MeshDepthMaterial {
  if (depth) return depth;
  depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: decalAtlas(), alphaTest: 0.5 });
  depth.name = 'bikes:depth';
  depth.onBeforeCompile = addFade;
  depth.customProgramCacheKey = () => 'bikes-depth-v1';
  return depth;
}
