// Terrain material: vertex-coloured toon with two detail textures blended by steepness — soft
// planar grain on flat ground, blocky limestone strata (rock-texture.ts) on steep faces (world space).
// Received sun shadow fades out on grazing faces (shadow-fade.ts: no acne on rippled rock).
import { MeshToonMaterial } from 'three';
import { toonRamp } from '../../render/toon';
import type { WorldCtx } from '../ctx';
import { grainTexture } from '../road/textures';
import { FARM_FRAG_BODY, FARM_FRAG_HEAD, FARM_UNIFORMS, FARM_VERT_BODY, FARM_VERT_HEAD } from './farmland';
import { ROCK_TILE_M, rockTexture } from './rock-texture';
import { SHADOW_FADE_FN, fadedLightsChunk } from './shadow-fade';
import { CRAG_AMBIENT, CRAG_BANDS } from './crag-glsl';

/**
 * Shared terrain material; `farm` adds the farmland patchwork (far grid only: needs the `farm` attribute).
 * Craggy tracks (LayoutDef.crags) get banded limestone faces with cool shadows (crag-glsl.ts).
 */
export function terrainMat(ctx: WorldCtx, farm = false): MeshToonMaterial {
  return ctx.shared(farm ? 'mat:terrain:farm' : 'mat:terrain', () => {
    const crag = !!ctx.L.def.crags;
    const grain = ctx.shared('tex:grain', () => grainTexture(ctx.app.renderer));
    const strata = ctx.shared('tex:strata', () => rockTexture(ctx.app.renderer));
    const m = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), map: grain });
    if (crag) m.defines = { CRAG_FACES: '' };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uStrata = { value: strata };
      if (farm) Object.assign(shader.uniforms, FARM_UNIFORMS);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\n${farm ? FARM_VERT_HEAD : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNrm = normalize(mat3(modelMatrix) * normal);
          ${farm ? FARM_VERT_BODY : ''}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uStrata;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\n${SHADOW_FADE_FN}\n${farm ? FARM_FRAG_HEAD : ''}`)
        .replace('#include <lights_fragment_begin>', fadedLightsChunk())
        .replace('#include <map_fragment>', `
          vec4 grainC = texture2D(map, vMapUv);
          // Strata: world-fixed biplanar projection (x-y / z-y planes) so bands stay continuous
          // across chunk seams and curved faces; v runs up the face.
          vec2 an = abs(vWNrm.xz) + 1e-4;
          an /= an.x + an.y;
          vec4 strataC = texture2D(uStrata, vWPos.zy / ${ROCK_TILE_M.toFixed(1)}) * an.x
            + texture2D(uStrata, vWPos.xy / ${ROCK_TILE_M.toFixed(1)}) * an.y;
          float steep = smoothstep(0.35, 0.6, 1.0 - abs(vWNrm.y));
          diffuseColor *= mix(grainC, strataC, steep);
          ${CRAG_BANDS}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${CRAG_AMBIENT}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${farm ? FARM_FRAG_BODY : ''}`);
    };
    m.customProgramCacheKey = () => `track-terrain${farm ? '-farm' : ''}${crag ? '-crag' : ''}`;
    return m;
  });
}
