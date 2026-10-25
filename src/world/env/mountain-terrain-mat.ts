// Sunset Pass terrain material (env-mountain): the shared vertex-coloured toon terrain, but steep faces
// get rock courses instead of the coast's fine limestone texture: irregular courses (~COURSE_H tall,
// gently wavy in world space), each a lit foot band, a body in its block's own tone and a dark crevice
// band with an ink line under the next course; ink joints split the courses into 4–9 m blocks
// (dressing/mountain/ledges.ts sets rock shelves on the same course lines). Lines fade below ~1.5 px and
// the bands beyond ~150–260 m (no pinstripes). Steep faces turned from the low sun sit in their own
// shadow without the shadow-map test (at grazing angles it only hatched them with acne), the grass/rock
// boundary is crisp, and the fog is stepped so far ridges separate.
import { MeshToonMaterial, ShaderChunk } from 'three';
import { toonRamp } from '../../render/toon';
import type { WorldCtx } from '../ctx';
import { grainTexture } from '../road/textures';

/** Rock course height (m, on average); every course line is shifted by up to ±COURSE_JITTER of a course
 *  (irregular strata) and waves by courseWob. The GLSL below uses the same formulas. */
export const COURSE_H = 4.2;
const COURSE_JITTER = 0.18;

export function courseWob(x: number, z: number): number {
  return Math.sin(x * 0.045 + z * 0.031) * 1.4 + Math.sin(x * 0.13 - z * 0.11) * 0.5;
}

/** Shift of course line k in course units (small sin arguments, so the GPU's sin agrees closely). */
function courseJitter(k: number): number {
  const v = Math.sin(k * 1.731 + 0.37) * 437.585;
  return (v - Math.floor(v) - 0.5) * 2 * COURSE_JITTER;
}

/** World height of course line k at (x, z): the top of course k − 1 and the foot of course k. */
export const courseY = (k: number, x: number, z: number): number => (k + courseJitter(k)) * COURSE_H - courseWob(x, z);

const COURSE_GLSL = /* glsl */`
float courseJit(float k) {
  return (fract(sin(k * 1.731 + 0.37) * 437.585) - 0.5) * ${(2 * COURSE_JITTER).toFixed(2)};
}`;

const COURSES = /* glsl */`
  vec2 hn = normalize(vWNrm.xz + vec2(1e-4, 0.0));
  float along = dot(vWPos.xz, vec2(-hn.y, hn.x));
  // Grain in world space, projected onto the face on slopes (planar UVs stretch into stripes there).
  vec4 grainC = texture2D(map, mix(vWPos.xz, vec2(along, vWPos.y), smoothstep(0.3, 0.6, 1.0 - abs(vWNrm.y))) / 6.0);
  float wob = sin(vWPos.x * 0.045 + vWPos.z * 0.031) * 1.4 + sin(vWPos.x * 0.13 - vWPos.z * 0.11) * 0.5;
  float yb = (vWPos.y + wob) / ${COURSE_H.toFixed(2)};
  // The course holding yb between its shifted lines lo and hi; fb runs from 0 (foot) to 1 (next line).
  float c0 = floor(yb);
  float course = yb < c0 + courseJit(c0) ? c0 - 1.0 : (yb >= c0 + 1.0 + courseJit(c0 + 1.0) ? c0 + 1.0 : c0);
  float lo = course + courseJit(course), hi = course + 1.0 + courseJit(course + 1.0);
  float fb = (yb - lo) / (hi - lo);
  // Blocks along the face (4-9 m per course, staggered), each its own flat tone and crevice depth.
  float bw = 4.0 + 5.0 * fract(sin(course * 12.9898) * 43758.5453);
  float xb = (along + course * 2.3) / bw;
  float fx = fract(xb);
  float h1 = fract(sin(course * 91.7 + floor(xb) * 37.3) * 4375.85);
  float h2 = fract(sin(course * 47.3 + floor(xb) * 11.9) * 2731.7);
  float wy = max(fwidth(yb) / (hi - lo), 1e-4), wx = max(fwidth(xb), 1e-4);
  float cw = 0.13 + 0.12 * h2;
  float foot = 1.0 - smoothstep(0.1 - wy, 0.1 + wy, fb);
  float crevice = smoothstep(1.0 - cw - wy, 1.0 - cw + wy, fb);
  // Ink: the line under the next course (most blocks) and the block joints, faded once thinner than ~1.5 px.
  float ink = smoothstep(0.955 - wy, 0.955 + wy, fb) * step(0.3, h2) * (1.0 - smoothstep(0.02, 0.045, wy));
  float joint = (1.0 - smoothstep(0.014 - wx, 0.014 + wx, min(fx, 1.0 - fx))) * (1.0 - smoothstep(0.012, 0.03, wx)) * (1.0 - crevice);
  float tone = (1.0 - 0.13 * h1) * mix(1.0, 1.15, foot) * mix(1.0, 0.64, crevice);
  tone = mix(tone, 0.24, max(ink, joint * 0.8));
  tone = mix(tone, 1.0 - 0.07 * h1, smoothstep(150.0, 260.0, length(vWPos - cameraPosition)));
  float steep = smoothstep(0.42, 0.52, 1.0 - abs(vWNrm.y));
  diffuseColor *= mix(grainC, vec4(vec3(tone), 1.0), steep);`;

/** Steep faces turned from the light are in their own shadow (no depth test there: at grazing angles it
 *  only hatched the rock walls with acne); the shadow map takes over within a few degrees of the
 *  terminator. Gentler ground keeps the plain shadow test (steep comes from the courses above). */
const FACE_SHADOW = /* glsl */`
float faceShadow(float ndl, float s, float steep) {
  return mix(s, smoothstep(0.0, 0.05, ndl) * s, steep);
}`;
const SHADOW_FROM = '? getShadow( directionalShadowMap[ i ]';
const SHADOW_END = 'vDirectionalShadowCoord[ i ] ) : 1.0;';

/** lights_fragment_begin with the directional shadow wrapped in faceShadow (null if three's chunk changed). */
function faceShadowLights(): string | null {
  const chunk = ShaderChunk.lights_fragment_begin;
  if (!chunk.includes(SHADOW_FROM) || !chunk.includes(SHADOW_END)) return null;
  return chunk
    .replace(SHADOW_FROM, '? faceShadow( dot( geometryNormal, directLight.direction ), getShadow( directionalShadowMap[ i ]')
    .replace(SHADOW_END, 'vDirectionalShadowCoord[ i ] ), steep ) : 1.0;');
}

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
    const lights = faceShadowLights();
    if (!lights) console.warn('[mountain] three lights chunk changed: terrain keeps the plain shadow test');
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNrm = normalize(mat3(modelMatrix) * normal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\n${FACE_SHADOW}\n${COURSE_GLSL}`)
        .replace('#include <map_fragment>', COURSES)
        .replace('#include <fog_fragment>', FOG);
      if (lights) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', lights);
    };
    m.customProgramCacheKey = () => 'mountain-terrain';
    return m;
  });
}
