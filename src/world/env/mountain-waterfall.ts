// Sunset Pass waterfall (env-mountain): an animated water sheet (streaks racing down, ragged edges,
// spray at the foot), a foam pool on the river and soft mist puffs rising from the plunge — all
// unlit, fogged, driven by one time uniform advanced with sim time.
import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, NormalBlending, ShaderMaterial,
  UniformsLib, UniformsUtils, Vector3,
} from 'three';
import type { WorldCtx } from '../ctx';

const NOISE = /* glsl */`
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

const SHEET_VERT = /* glsl */`
#include <fog_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

// uv.x across (0..1), uv.y down the fall in metres; uMode 0 = sheet, 1 = foam pool (uv = disc coords).
const SHEET_FRAG = /* glsl */`
#include <fog_pars_fragment>
uniform float uTime; uniform float uMode; uniform float uLen; uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uFoam;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 col; float a;
  if (uMode < 0.5) {
    float v = vUv.y;
    float n1 = vnoise(vec2(vUv.x * 18.0, v * 0.35 - uTime * 2.6));
    float n2 = vnoise(vec2(vUv.x * 41.0 + 3.0, v * 0.9 - uTime * 4.1));
    float streak = smoothstep(0.5, 0.78, n1 * 0.6 + n2 * 0.5);
    col = mix(uDeep, uLight, 0.2 + 0.8 * streak);
    float spray = smoothstep(uLen - 9.0, uLen, v) + (1.0 - smoothstep(0.0, 2.5, v)) * 0.5;
    col = mix(col, uFoam, clamp(spray, 0.0, 1.0));
    float edge = min(vUv.x, 1.0 - vUv.x) * 8.0 + (vnoise(vec2(v * 0.6 - uTime * 2.0, vUv.x * 3.0)) - 0.5) * 0.9;
    a = smoothstep(0.0, 0.6, edge) * 0.93;
  } else {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float n = vnoise(p * 6.0 + vec2(uTime * 0.7, -uTime * 0.4)) + vnoise(p * 13.0 - uTime * 1.3) * 0.5;
    col = mix(uLight, uFoam, smoothstep(0.55, 0.95, n));
    a = (1.0 - smoothstep(0.55, 1.0, r + (n - 0.75) * 0.25)) * 0.9;
  }
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const MIST_VERT = /* glsl */`
#include <fog_pars_vertex>
attribute vec3 aCorner; uniform float uTime; uniform float uRise; uniform vec2 uSize; uniform float uSpeed;
varying vec2 vUv; varying float vFade;
void main() {
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
uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying float vFade;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.2, 1.0, r)) * vFade * uAlpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function timeUniform(ctx: WorldCtx): { value: number } {
  return ctx.shared('mountain:waterfall:time', () => {
    const time = { value: 0 };
    ctx.onUpdate((dtSim) => { time.value += dtSim; });
    return { time, dispose: () => undefined };
  }).time;
}

function sheetMat(ctx: WorldCtx, mode: 0 | 1, len: number): ShaderMaterial {
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, fog: true, transparent: true, depthWrite: false,
    side: DoubleSide, blending: NormalBlending,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uTime: { value: 0 }, uMode: { value: mode }, uLen: { value: len },
      uDeep: { value: new Color('#5f86c8') }, uLight: { value: new Color('#f2f7ff') }, uFoam: { value: new Color('#fff6f2') },
    }]),
  }));
  mat.uniforms.uTime = timeUniform(ctx);
  return mat;
}

export interface FallSpec {
  lip: Vector3;      // top centre of the fall (world)
  out: Vector3;      // unit horizontal direction the water leaves the cliff
  right: Vector3;    // unit horizontal across the fall
  width: number;
  bottom: number;    // world y of the plunge pool (river surface)
}

function sheet(spec: FallSpec): BufferGeometry {
  const cols = 9, len = spec.lip.y - spec.bottom + 1, rows = Math.max(8, Math.round(len / 3));
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const v = (r / rows) ** 1.3 * len;
    const outD = 1.6 * (1 - Math.exp(-v / 3.5));
    const w = spec.width * (1 + 0.18 * (v / len));
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const p = spec.lip.clone().addScaledVector(spec.out, outD).addScaledVector(spec.right, (u - 0.5) * w);
      p.y -= v;
      pos.push(p.x, p.y, p.z);
      uv.push(u, v);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const a = r * cols + c;
      idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function quadGeo(centres: Vector3[], corner: (i: number) => [number, number, number], flat: number): BufferGeometry {
  const pos: number[] = [], cor: number[] = [], uv: number[] = [], idx: number[] = [];
  centres.forEach((c, i) => {
    const [, , seed] = corner(i);
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
      pos.push(c.x + x * flat, c.y, c.z + y * flat);
      cor.push(x, y, seed);
      uv.push(x * 0.5 + 0.5, y * 0.5 + 0.5);
    }
    const k = i * 4;
    idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aCorner', new BufferAttribute(new Float32Array(cor), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 30;
  return g;
}

/** Waterfall sheet + foam pool + rising mist at the plunge. */
export function buildWaterfall(ctx: WorldCtx, spec: FallSpec): void {
  const len = spec.lip.y - spec.bottom + 1;
  const fall = new Mesh(ctx.own(sheet(spec)), sheetMat(ctx, 0, len));
  fall.name = 'waterfall';
  fall.renderOrder = 2;
  const foot = spec.lip.clone().addScaledVector(spec.out, 2.4).setY(spec.bottom + 0.06);
  const pool = new Mesh(ctx.own(quadGeo([foot], () => [0, 0, 0], spec.width * 0.95)), sheetMat(ctx, 1, len));
  pool.name = 'waterfallPool';
  pool.renderOrder = 1;
  const rng = ctx.rng.fork(0x3f11);
  const puffs: Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    puffs.push(foot.clone().addScaledVector(spec.right, rng.range(-0.6, 0.6) * spec.width).addScaledVector(spec.out, rng.range(-1, 5)).setY(spec.bottom + rng.range(-1, 2)));
  }
  buildMist(ctx, puffs, { rise: 26, size: [3, 9], speed: 0.11, alpha: 0.3, color: '#ffe3e8' });
  for (const mesh of [fall, pool]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    ctx.group.add(mesh);
  }
}

export interface MistOpts { rise: number; size: [number, number]; speed: number; alpha: number; color: string }

/** Soft camera-facing puffs rising from `centres` and fading (spray, steam). */
export function buildMist(ctx: WorldCtx, centres: Vector3[], o: MistOpts): void {
  const rng = ctx.rng.fork(centres.length * 7919);
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, fog: true, transparent: true, depthWrite: false, blending: NormalBlending, side: DoubleSide,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uTime: { value: 0 }, uRise: { value: o.rise }, uSize: { value: o.size }, uSpeed: { value: o.speed },
      uAlpha: { value: o.alpha }, uColor: { value: new Color(o.color) },
    }]),
  }));
  mat.uniforms.uTime = timeUniform(ctx);
  const mesh = new Mesh(ctx.own(quadGeo(centres, () => [0, 0, rng.next()], 0)), mat);
  mesh.name = 'mist';
  mesh.renderOrder = 3;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  ctx.group.add(mesh);
}
