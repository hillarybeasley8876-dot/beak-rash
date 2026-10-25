// Wet asphalt: a rainy track's road is darker and picks up a sheen (a cheap fresnel of the sky
// colour at grazing angles, like the city's wet overlay but without the planar reflection).
// The patch rides on the road's own toon material, so the road's detail shading is kept.
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

/** Make the track's road wet: darker asphalt with a sky sheen at grazing angles. */
export function applyWetRoad(ctx: WorldCtx): void {
  const road = ctx.group.getObjectByName('road');
  if (!(road instanceof Mesh)) return;
  const mat = road.material;
  if (!(mat instanceof MeshToonMaterial)) return;
  const prev = mat.onBeforeCompile;
  const sheen = new Color(ctx.look.sky.horizon);
  const sun = new Color(ctx.look.sun.color);
  const sunDir = new Vector3(-ctx.look.sun.dir.x, -ctx.look.sun.dir.y, -ctx.look.sun.dir.z).normalize();
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uWetSheen = { value: sheen };
    shader.uniforms.uWetSun = { value: sun };
    shader.uniforms.uWetSunDir = { value: sunDir };
    shader.uniforms.uWetDark = { value: TUNE.rain.wetDark };
    shader.uniforms.uWetFres = { value: TUNE.rain.sheen };
    shader.uniforms.uWetSpecAmt = { value: TUNE.rain.spec };
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
  mat.customProgramCacheKey = () => 'track-road-wet';
  mat.needsUpdate = true;
}
