// Sunset Pass mist (env-mountain): toon camera-facing puffs (lobed, hard-edged, two tones) that rise
// from a set of centres, grow and erode away (waterfall spray, hot-spring steam). Unlit, fogged, one draw call per call site, animated on
// the shared sim-time uniform.
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, NormalBlending, ShaderMaterial, UniformsLib, UniformsUtils, type Vector3 } from 'three';
import type { WorldCtx } from '../ctx';
import { lifeTime } from './mountain-anim';

const MIST_VERT = /* glsl */`
#include <fog_pars_vertex>
attribute vec3 aCorner; uniform float uTime; uniform float uRise; uniform vec2 uSize; uniform float uSpeed;
varying vec2 vUv; varying float vFade; varying float vSeed;
void main() {
  vSeed = aCorner.z;
  float life = fract(uTime * uSpeed + aCorner.z);
  vec3 c = position + vec3(sin(aCorner.z * 40.0 + uTime * 0.3) * uSize.x * 0.6, life * uRise, 0.0);
  float size = mix(uSize.x, uSize.y, life);
  vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
  mvPosition.xy += aCorner.xy * size;
  vUv = aCorner.xy * 0.5 + 0.5;
  vFade = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.55, 1.0, life));
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const MIST_FRAG = /* glsl */`
#include <fog_pars_fragment>
uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying float vFade; varying float vSeed;
void main() {
  // Toon puff: a lobed hard-edged silhouette that erodes as it fades, shade tone + a lit core.
  vec2 p = vUv * 2.0 - 1.0;
  float ang = atan(p.y, p.x);
  float lobe = 0.8 + 0.12 * sin(ang * 3.0 + vSeed * 6.28) + 0.07 * sin(ang * 5.0 - vSeed * 4.0);
  float edge = lobe * mix(0.45, 1.0, vFade);
  float inside = 1.0 - smoothstep(edge - 0.05, edge, length(p));
  float core = 1.0 - smoothstep(edge * 0.5 - 0.05, edge * 0.5, length(p - vec2(-0.16, 0.2)));
  gl_FragColor = vec4(uColor * mix(0.84, 1.0, core), inside * step(0.03, vFade) * uAlpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export interface MistOpts { rise: number; size: [number, number]; speed: number; alpha: number; color: string }

/** One camera-facing quad per centre: aCorner = (corner x, corner y, life phase seed). */
function puffGeo(centres: Vector3[], seed: (i: number) => number): BufferGeometry {
  const pos: number[] = [], cor: number[] = [], idx: number[] = [];
  centres.forEach((c, i) => {
    const phase = seed(i);
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
      pos.push(c.x, c.y, c.z);
      cor.push(x, y, phase);
    }
    const k = i * 4;
    idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aCorner', new BufferAttribute(new Float32Array(cor), 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 30;
  return g;
}

/** Toon camera-facing puffs rising from `centres` and eroding away (spray, steam). */
export function buildMist(ctx: WorldCtx, centres: Vector3[], o: MistOpts): void {
  const rng = ctx.rng.fork(centres.length * 7919);
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, fog: true, transparent: true, depthWrite: false, blending: NormalBlending, side: DoubleSide,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uTime: { value: 0 }, uRise: { value: o.rise }, uSize: { value: o.size }, uSpeed: { value: o.speed },
      uAlpha: { value: o.alpha }, uColor: { value: new Color(o.color) },
    }]),
  }));
  mat.uniforms.uTime = lifeTime(ctx);
  const mesh = new Mesh(ctx.own(puffGeo(centres, () => rng.next())), mat);
  mesh.name = 'mist';
  mesh.renderOrder = 3;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  ctx.group.add(mesh);
}
