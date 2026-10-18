// Sunset Pass lake (env-mountain): swaps the track's sea material (the water plane at level 0 is the
// lake and the gorge river) for a golden-hour lake that mirrors the sky — violet overhead, gold toward
// the sun, a glittering sun path, toon ripple dashes, pebble-shallow bands and a pale lapping edge.
import { Color, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector3, type IUniform } from 'three';
import type { WorldCtx } from '../ctx';
import { HEIGHT_OFFSET } from './heightmap';

const VERT = /* glsl */`
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
#include <fog_pars_fragment>
uniform sampler2D uHeight; uniform vec4 uXform; uniform float uTime; uniform vec3 uCam; uniform vec3 uSunDir;
uniform vec3 uZenith; uniform vec3 uPink; uniform vec3 uGold; uniform vec3 uAnti; uniform vec3 uDeep;
uniform vec3 uShallow; uniform vec3 uFoam; uniform vec3 uSun;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 uv = vec2(0.5 + (vWorld.x - uXform.x) * uXform.z, 0.5 - (vWorld.z - uXform.y) * uXform.w);
  float ground = -60.0;
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ground = texture2D(uHeight, uv).r - ${HEIGHT_OFFSET.toFixed(1)};
  float depth = max(0.0, -ground);
  vec3 view = normalize(vWorld - uCam);
  float dist = length(vWorld - uCam);
  // Ripples tilt the mirror a little (toon: quantised).
  vec2 rp = mat2(0.8, -0.6, 0.6, 0.8) * vWorld.xz;
  float rip = vnoise(vec2(rp.x * 0.25 + uTime * 0.3, rp.y * 0.9 - uTime * 0.08));
  float elev = clamp(-view.y + (rip - 0.5) * 0.06, 0.0, 1.0);
  vec2 sa = normalize(uSunDir.xz + 1e-5), da = normalize(view.xz + 1e-5);
  float toward = dot(sa, da) * 0.5 + 0.5;
  vec3 horizon = mix(uAnti, uGold, smoothstep(0.1, 0.9, toward));
  vec3 sky = mix(horizon, uPink, smoothstep(0.02, 0.18, elev));
  sky = mix(sky, uZenith, smoothstep(0.15, 0.6, elev));
  float fres = 0.55 + 0.45 * pow(1.0 - elev, 3.0);
  vec3 col = mix(uDeep, sky, fres);
  // Shallow pebble bands and the lapping edge.
  float wob = (vnoise(vWorld.xz * 0.11 + uTime * 0.05) - 0.5) * 0.6;
  float dd = depth + wob;
  col = mix(col, uShallow, (1.0 - smoothstep(0.6, 1.6, dd)) * 0.75);
  col = mix(col, mix(uShallow, col, 0.5), (1.0 - smoothstep(1.6, 4.0, dd)) * 0.35);
  float lap = 0.22 + 0.12 * sin(uTime * 1.2 + vWorld.x * 0.07 + vWorld.z * 0.05);
  float shore = 1.0 - step(lap, depth + wob * 0.3);
  // Ripple dashes (near) and the glittering sun path.
  float dash = step(0.88, rip) * (1.0 - smoothstep(60.0, 160.0, dist)) * 0.5;
  vec3 refl = reflect(view, vec3(0.0, 1.0, 0.0));
  float sunPath = pow(max(dot(normalize(refl + vec3(0.0, (rip - 0.5) * 0.25, 0.0)), uSunDir), 0.0), 18.0);
  float glint = step(0.62, vnoise(vWorld.xz * 0.5 + uTime * 0.9)) * smoothstep(0.15, 0.7, sunPath);
  col = mix(col, uFoam, clamp(max(shore, dash * 0.6), 0.0, 1.0));
  col += uSun * (sunPath * 0.35 + glint * 0.9);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** Replace the water material; keeps the track's height map, time and camera updates. */
export function buildMountainLake(ctx: WorldCtx): void {
  const sea = ctx.group.getObjectByName('sea');
  if (!(sea instanceof Mesh) || !(sea.material instanceof ShaderMaterial)) {
    console.warn('[mountain] water plane not found');
    return;
  }
  const old = sea.material.uniforms as Record<string, IUniform>;
  const look = ctx.look;
  const sunDir = new Vector3(-look.sun.dir.x, -look.sun.dir.y, -look.sun.dir.z).normalize();
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uHeight: { value: null }, uXform: { value: null }, uTime: { value: 0 }, uCam: { value: new Vector3() },
      uSunDir: { value: sunDir },
      uZenith: { value: new Color('#6a4a9a') }, uPink: { value: new Color('#e98aa0') }, uGold: { value: new Color('#ffbe78') },
      uAnti: { value: new Color('#a984bb') }, uDeep: { value: new Color('#3b2f6e') }, uShallow: { value: new Color('#9a8a6a') },
      uFoam: { value: new Color('#ffe9e0') }, uSun: { value: new Color(look.sun.color) },
    }]),
  }));
  // The track drives uTime / uCam / uHeight on the original uniform objects: share them.
  const u = mat.uniforms as Record<string, IUniform>;
  for (const k of ['uHeight', 'uXform', 'uTime', 'uCam']) if (old[k]) u[k] = old[k] as IUniform;
  sea.material = mat;
}
