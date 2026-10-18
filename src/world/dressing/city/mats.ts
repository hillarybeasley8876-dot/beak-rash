// City materials (one instance per track via ctx.shared). All read the batch `aux` attribute:
//   buildings  — toon walls + procedural night windows (aux: style, seed, lit ratio, LED band)
//   neon       — unlit atlas signs pushed into HDR so they bloom (aux: intensity, phase, flicker)
//   cycle      — traffic / crossing lights switching on a shared clock (aux: phase, role)
// Time runs on sim time (freezes in hit-stop, slows in the KO slow-mo).
import { MeshBasicMaterial, MeshToonMaterial, type Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { toonRamp } from '../../../render/toon';
import type { WorldCtx } from '../../ctx';
import { BUILDING_FRAG, BUILDING_FRAG_HEAD, CYCLE_FRAG, HASH_GLSL, NEON_FRAG } from './glsl';

interface TimeUniform { value: number }

/** Shared city clock uniform (sim seconds since the track was built). */
export function cityTime(ctx: WorldCtx): TimeUniform {
  return ctx.shared('city:time', () => {
    const time = { value: 0 };
    ctx.onUpdate((dtSim) => { time.value += dtSim; });
    return { time, dispose: () => undefined };
  }).time;
}

/** Pass `aux` (and `uv` as vFac) to the fragment shader. */
function withAux(shader: WebGLProgramParametersWithUniforms, fragHead: string): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 aux;\nvarying vec4 vAux;\nvarying vec2 vFac;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAux = aux;\nvFac = uv;');
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>\nuniform float uCityTime;\nvarying vec4 vAux;\nvarying vec2 vFac;\n${HASH_GLSL}\n${fragHead}`,
  );
}

/** Toon walls with lit windows (uv = facade coordinates in window bays × floors). */
export function buildingMat(ctx: WorldCtx): MeshToonMaterial {
  const time = cityTime(ctx);
  return ctx.shared('city:mat:building', () => {
    const m = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCityTime = time;
      withAux(shader, BUILDING_FRAG_HEAD);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${BUILDING_FRAG}`);
    };
    m.customProgramCacheKey = () => 'city-building';
    return m;
  });
}

/** Unlit HDR sign material over an atlas texture (vertex colour tints, aux drives brightness/flicker). */
export function neonMat(ctx: WorldCtx, key: string, map: Texture): MeshBasicMaterial {
  const time = cityTime(ctx);
  return ctx.shared(`city:mat:neon:${key}`, () => {
    const m = new MeshBasicMaterial({ map, vertexColors: true });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCityTime = time;
      withAux(shader, '');
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n${NEON_FRAG}`);
    };
    m.customProgramCacheKey = () => 'city-neon';
    return m;
  });
}

/** Unlit lamps that switch on a shared cycle (traffic lights, crossing men, aviation blinkers). */
export function cycleMat(ctx: WorldCtx): MeshBasicMaterial {
  const time = cityTime(ctx);
  return ctx.shared('city:mat:cycle', () => {
    const m = new MeshBasicMaterial({ vertexColors: true });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCityTime = time;
      withAux(shader, '');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${CYCLE_FRAG}`);
    };
    m.customProgramCacheKey = () => 'city-cycle';
    return m;
  });
}
