// Sunset Pass terrain material (env-mountain): the shared vertex-coloured toon terrain, but steep faces
// get broad procedural strata instead of the coast's fine limestone texture — 3.2 m strata split into
// 3–7 m blocks, each with its own flat tone, a lighter sun-caught top bevel and thin cracks, gently
// wavy in world space — and the grass/rock boundary is crisp. The pattern fades out where strata
// shrink below ~20 px or beyond ~80 m (no moiré), and the fog is stepped so far ridges separate.
import { MeshToonMaterial } from 'three';
import { toonRamp } from '../../render/toon';
import type { WorldCtx } from '../ctx';
import { grainTexture } from '../road/textures';

const STRATA = /* glsl */`
  vec2 hn = normalize(vWNrm.xz + vec2(1e-4, 0.0));
  float along = dot(vWPos.xz, vec2(-hn.y, hn.x));
  // Grain in world space, projected onto the face on slopes (planar UVs stretch into stripes there).
  vec4 grainC = texture2D(map, mix(vWPos.xz, vec2(along, vWPos.y), smoothstep(0.3, 0.6, 1.0 - abs(vWNrm.y))) / 6.0);
  float wob = sin(vWPos.x * 0.045 + vWPos.z * 0.031) * 1.4 + sin(vWPos.x * 0.13 - vWPos.z * 0.11) * 0.5;
  float yb = (vWPos.y + wob) / 3.2;
  float band = floor(yb), fb = fract(yb);
  // Blocks along the face (3-7 m per stratum): each its own flat tone, split by thin cracks.
  float bw = 3.0 + 4.0 * fract(sin(band * 12.9898) * 43758.5453);
  float xb = (along + band * 2.3) / bw;
  float fx = fract(xb);
  float h1 = fract(sin(band * 91.7 + floor(xb) * 37.3) * 4375.85);
  // The whole pattern fades once a stratum is under ~20 px or beyond ~80 m (no pinstripes at range).
  float wy = max(fwidth(yb), 0.002), wx = max(fwidth(xb), 0.002);
  float detail = (1.0 - smoothstep(0.035, 0.07, max(wy, wx))) * (1.0 - smoothstep(60.0, 95.0, length(vWPos - cameraPosition)));
  float bevel = smoothstep(0.84 - wy, 0.84 + wy, fb);
  float crack = 1.0 - smoothstep(0.03 - wx, 0.03 + wx, min(fx, 1.0 - fx));
  float tone = mix(1.0, (1.0 - 0.2 * h1) * (1.0 + 0.16 * bevel) * (1.0 - 0.22 * crack), detail);
  float steep = smoothstep(0.42, 0.52, 1.0 - abs(vWNrm.y));
  diffuseColor *= mix(grainC, vec4(vec3(tone), 1.0), steep);`;

// Toon fog: three flat steps with short ramps, so far hills separate by value instead of smearing.
const FOG = /* glsl */`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  float fq = fogFactor * 3.0;
  fogFactor = mix(fogFactor, (floor(fq) + smoothstep(0.3, 0.7, fract(fq))) / 3.0, 0.75);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;

/** Shared mountain terrain material (near ribbons, far grid, tunnel caps). */
export function mountainTerrainMat(ctx: WorldCtx): MeshToonMaterial {
  return ctx.shared('mat:terrain:mountain', () => {
    const grain = ctx.shared('tex:grain', () => grainTexture(ctx.app.renderer));
    const m = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), map: grain });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNrm = normalize(mat3(modelMatrix) * normal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
        .replace('#include <map_fragment>', STRATA)
        .replace('#include <fog_fragment>', FOG);
    };
    m.customProgramCacheKey = () => 'mountain-terrain';
    return m;
  });
}
