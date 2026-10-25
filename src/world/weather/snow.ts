// Snow on the up-facing world surfaces (SPEC §20): the track's own materials get a world-normal-up
// mix toward snow white, patched in with onBeforeCompile. The road surface never takes snow, and the
// riders and bikes live outside the track group, so they stay untouched.
import { Color, Mesh, MeshToonMaterial, type Material } from 'three';
import type { WorldCtx } from '../ctx';
import { TUNE } from './table';

/** Meshes that never take snow: the road and its paint, the sky and the sea. */
const NO_SNOW = new Set(['road', 'roadMarks', 'shoulderL', 'shoulderR', 'curbs', 'sky', 'clouds', 'sea', 'city:wet']);

const SNOW_VERT = /* glsl */`
  #ifdef USE_INSTANCING
    vSnowN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
  #else
    vSnowN = normalize(mat3(modelMatrix) * objectNormal);
  #endif`;

const SNOW_FRAG = /* glsl */`
  {
    float snowUp = smoothstep(uSnowLo, uSnowHi, normalize(vSnowN).y);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uSnowColor, snowUp * uSnowAmount);
  }`;

/** A copy of the material that lays snow on its up-facing faces. */
function snowClone(mat: MeshToonMaterial): MeshToonMaterial {
  const prev = mat.onBeforeCompile;
  const clone = mat.clone();
  clone.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uSnowColor = { value: new Color(TUNE.snow.color) };
    shader.uniforms.uSnowAmount = { value: TUNE.snow.amount };
    shader.uniforms.uSnowLo = { value: TUNE.snow.slopeLo };
    shader.uniforms.uSnowHi = { value: TUNE.snow.slopeHi };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowN;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${SNOW_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSnowColor;
        uniform float uSnowAmount;
        uniform float uSnowLo;
        uniform float uSnowHi;
        varying vec3 vSnowN;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${SNOW_FRAG}`);
  };
  clone.customProgramCacheKey = () => `snow-${mat.customProgramCacheKey()}`;
  return clone;
}

/** Lay snow on every up-facing surface of the built track. */
export function applySnow(ctx: WorldCtx): void {
  const clones = new Map<Material, Material>();
  ctx.group.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    if (o.userData.noSnow) return;
    if (NO_SNOW.has(o.name)) return;
    const mat = o.material;
    if (Array.isArray(mat) || !(mat instanceof MeshToonMaterial)) return;
    if (mat.transparent) return;
    let patched = clones.get(mat);
    if (!patched) {
      patched = snowClone(mat);
      clones.set(mat, patched);
      ctx.own(patched);
    }
    o.material = patched;
  });
}
