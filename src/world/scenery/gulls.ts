// Animated gull flocks: one mesh, every gull orbits its flock centre and flaps in the vertex shader
// (no per-frame CPU work). Unlit white/grey toon colours with black wing tips; fogged.
import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, type Vector3,
} from 'three';
import type { Rng } from '../../core/rng';
import type { WorldCtx } from '../ctx';

const VERT = /* glsl */`
#include <fog_pars_vertex>
attribute vec4 aOrbit;   // centre x, centre z, radius, height
attribute vec3 aPhase;   // angle phase, angular speed (signed), flap phase
attribute float aWing;   // 0 body, 1 wing (flaps with |x|)
attribute vec3 aColor;
uniform float uTime;
varying vec3 vColor;
void main() {
  float ang = aPhase.x + uTime * aPhase.y;
  float dir = sign(aPhase.y);
  vec3 c = vec3(aOrbit.x + cos(ang) * aOrbit.z, aOrbit.w + sin(uTime * 0.6 + aPhase.z) * 1.6, aOrbit.y + sin(ang) * aOrbit.z);
  vec3 fwd = normalize(vec3(-sin(ang), 0.0, cos(ang)) * dir);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  // Bank into the turn.
  float bank = -0.35 * dir;
  vec3 r2 = right * cos(bank) + up * sin(bank);
  vec3 u2 = up * cos(bank) - right * sin(bank);
  vec3 p = position;
  float flap = sin(uTime * 8.0 + aPhase.z * 3.0);
  p.y += aWing * flap * 0.55 * abs(p.x);
  vec3 world = c + r2 * p.x + u2 * p.y - fwd * p.z;
  vColor = aColor;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
#include <fog_pars_fragment>
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const WHITE = new Color('#ffffff'), GREY = new Color('#b9c3cd'), TIP = new Color('#17181d'), BEAK = new Color('#ffcf1f');

/** Gull silhouette (local: x right, y up, −z forward), per-vertex wing weights. */
const SHAPE: Array<{ p: [number, number, number][]; c: Color; wing: number }> = [
  { p: [[0, 0, -0.45], [0.12, 0, 0.1], [-0.12, 0, 0.1]], c: WHITE, wing: 0 },
  { p: [[0, 0, -0.45], [0, 0.1, 0.0], [0, 0, 0.45]], c: WHITE, wing: 0 },
  { p: [[0, 0.02, -0.62], [0.04, 0.02, -0.45], [-0.04, 0.02, -0.45]], c: BEAK, wing: 0 },
  { p: [[0.1, 0, -0.12], [0.75, 0.05, 0.02], [0.1, 0, 0.2]], c: GREY, wing: 1 },
  { p: [[0.75, 0.05, 0.02], [1.05, 0.0, 0.2], [0.6, 0.03, 0.18]], c: TIP, wing: 1 },
  { p: [[-0.1, 0, -0.12], [-0.1, 0, 0.2], [-0.75, 0.05, 0.02]], c: GREY, wing: 1 },
  { p: [[-0.75, 0.05, 0.02], [-0.6, 0.03, 0.18], [-1.05, 0.0, 0.2]], c: TIP, wing: 1 },
];

export interface Flock { centre: Vector3; count: number; radius: number; height: number }

export function buildGulls(ctx: WorldCtx, flocks: Flock[], rng: Rng): void {
  const total = flocks.reduce((n, f) => n + f.count, 0);
  const vpg = SHAPE.length * 3;
  const pos = new Float32Array(total * vpg * 3), col = new Float32Array(total * vpg * 3);
  const orbit = new Float32Array(total * vpg * 4), phase = new Float32Array(total * vpg * 3), wing = new Float32Array(total * vpg);
  let v = 0;
  for (const f of flocks) {
    for (let i = 0; i < f.count; i++) {
      const o = [f.centre.x + rng.range(-8, 8), f.centre.z + rng.range(-8, 8), f.radius * rng.range(0.6, 1.3), f.height + rng.range(-4, 5)];
      const ph = [rng.range(0, 6.28), rng.range(0.25, 0.45) * (rng.chance(0.85) ? 1 : -1), rng.range(0, 6.28)];
      const s = rng.range(0.9, 1.25);
      for (const tri of SHAPE) {
        for (const [x, y, z] of tri.p) {
          pos.set([x * s, y * s, z * s], v * 3);
          col.set([tri.c.r, tri.c.g, tri.c.b], v * 3);
          orbit.set(o, v * 4);
          phase.set(ph, v * 3);
          wing[v] = tri.wing;
          v++;
        }
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new BufferAttribute(col, 3));
  geo.setAttribute('aOrbit', new BufferAttribute(orbit, 4));
  geo.setAttribute('aPhase', new BufferAttribute(phase, 3));
  geo.setAttribute('aWing', new BufferAttribute(wing, 1));
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true, side: DoubleSide,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }]),
  }));
  const mesh = new Mesh(ctx.own(geo), mat);
  mesh.name = 'gulls';
  mesh.frustumCulled = false;
  ctx.group.add(mesh);
  const time = mat.uniforms.uTime as { value: number };
  ctx.onUpdate((dtSim) => { time.value += dtSim; });
}
