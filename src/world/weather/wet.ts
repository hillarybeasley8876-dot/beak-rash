// Wet stone: a rainy track's road is darker and picks up a sheen (a cheap fresnel of the sky
// colour at grazing angles, like the city's wet overlay but without the planar reflection).
// The patch rides on the road's own toon material, so the road's detail shading is kept.
// The water town drizzles rather than storms: its stone only darkens a little, so the joints of
// the flagstones survive the weather (SPEC §20).
import { Color, Mesh, MeshToonMaterial, Vector3 } from 'three';
import type { WorldCtx } from '../ctx';
import { TUNE } from './table';

const WET_VERT = /* glsl */`
  vWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWetN = normalize(mat3(modelMatrix) * normal);`;

const WET_FRAG = /* glsl */`
  {
    vec3 wetV = normalize(cameraPosition - vWetPos);
    vec3 wetN = normalize(vWetN);
    float wetFres = pow(1.0 - clamp(dot(wetN, wetV), 0.0, 1.0), 5.0);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uWetSheen, wetFres * uWetFres);
    vec3 wetH = normalize(uWetSunDir + wetV);
    float wetSpec = pow(max(dot(wetN, wetH), 0.0), 14.0);
    gl_FragColor.rgb += uWetSun * wetSpec * uWetSpecAmt;
  }`;

/** The wet look of one build: how dark the stone goes and how much sky it picks up. */
export interface WetLook { dark: number; sheen: number; spec: number }

/** The wet look of a track: the town's drizzle is a soft one. */
export function wetLookFor(id: string): WetLook {
  if (id === 'watertown') return TUNE.softRain;
  return { dark: TUNE.rain.wetDark, sheen: TUNE.rain.sheen, spec: TUNE.rain.spec };
}

/** Make the track's road wet: darker asphalt with a sky sheen at grazing angles. */
export function applyWetRoad(ctx: WorldCtx): void {
  const look = wetLookFor(ctx.id);
  const sheen = new Color(ctx.look.sky.horizon);
  const sun = new Color(ctx.look.sun.color);
  const sunDir = new Vector3(-ctx.look.sun.dir.x, -ctx.look.sun.dir.y, -ctx.look.sun.dir.z).normalize();
  // The road and its shoulders share one wet look; the two shoulders share a material, so each
  // material is patched once. Only the water town's shoulders take the wet look — the other
  // tracks keep the look they had.
  const names = ctx.id === 'watertown' ? ['road', 'shoulderL', 'shoulderR'] : ['road'];
  const mats: MeshToonMaterial[] = [];
  for (const name of names) {
    const mesh = ctx.group.getObjectByName(name);
    if (!(mesh instanceof Mesh)) continue;
    const mat = mesh.material;
    if (mat instanceof MeshToonMaterial && !mats.includes(mat)) mats.push(mat);
  }
  for (const mat of mats) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      prev.call(mat, shader, renderer);
      shader.uniforms.uWetSheen = { value: sheen };
      shader.uniforms.uWetSun = { value: sun };
      shader.uniforms.uWetSunDir = { value: sunDir };
      shader.uniforms.uWetDark = { value: look.dark };
      shader.uniforms.uWetFres = { value: look.sheen };
      shader.uniforms.uWetSpecAmt = { value: look.spec };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;\nvarying vec3 vWetN;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WET_VERT}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
        uniform vec3 uWetSheen;
        uniform vec3 uWetSun;
        uniform vec3 uWetSunDir;
        uniform float uWetDark;
        uniform float uWetFres;
        uniform float uWetSpecAmt;
        varying vec3 vWetPos;
        varying vec3 vWetN;`)
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= uWetDark;')
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${WET_FRAG}`);
    };
    // The key carries the track and the material, so a track whose road has a different patch
    // (the water town's paving has no detail shader) never shares another track's program.
    mat.customProgramCacheKey = () => `track-wet-${ctx.id}-${mats.indexOf(mat)}`;
    mat.needsUpdate = true;
  }
}
