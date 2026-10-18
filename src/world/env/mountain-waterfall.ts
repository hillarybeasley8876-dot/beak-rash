// Sunset Pass waterfall (env-mountain): a toon water sheet that curls over a rounded lip and widens
// as it falls (long hard-edged streaks racing down at different speeds, wide ragged sides, a
// white foam lip and churning spray at the foot), a foam pool on the river and mist rising from the
// plunge — all unlit, fogged, animated on the shared sim-time uniform.
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, NormalBlending, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';
import type { WorldCtx } from '../ctx';
import { lifeTime } from './mountain-anim';
import { buildMist } from './mountain-mist';

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
uniform float uTime; uniform float uMode; uniform float uLen;
uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uLight; uniform vec3 uFoam;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 col; float a;
  if (uMode < 0.5) {
    float v = vUv.y;
    // Long streaks (~12:1): noise stretched down the fall, racing at 9 / 11 / 13 m/s.
    float n1 = vnoise(vec2(vUv.x * 10.0, v * 0.045 - uTime * 0.4));
    float n2 = vnoise(vec2(vUv.x * 23.0 + 3.0, v * 0.09 - uTime * 1.0));
    float n3 = vnoise(vec2(vUv.x * 47.0 + 7.0, v * 0.2 - uTime * 2.6));
    float f = n1 * 0.45 + n2 * 0.35 + n3 * 0.2;
    // Mid blue body, deep blue only in narrow gaps, white streaks, thin bright streak lines.
    col = mix(uDeep, uMid, step(0.3, f));
    col = mix(col, uLight, step(0.6, f));
    col = mix(col, uFoam, step(0.82, vnoise(vec2(vUv.x * 61.0 + 11.0, v * 0.05 - uTime * 0.6))));
    float lip = 1.0 - step(1.0 + 0.9 * vnoise(vec2(vUv.x * 9.0, uTime * 0.8)), v);
    float spray = step(uLen - 6.0 - 4.0 * vnoise(vec2(vUv.x * 7.0, v * 0.3 - uTime * 3.0)), v);
    col = mix(col, uFoam, max(lip, spray));
    float side = min(vUv.x, 1.0 - vUv.x);
    float rag = (vnoise(vec2(v * 0.45 - uTime * 2.2, vUv.x * 5.0)) - 0.5) * 0.24
              + (vnoise(vec2(v * 1.6 - uTime * 3.3, vUv.x * 13.0)) - 0.5) * 0.12;
    a = smoothstep(0.07, 0.1, side + rag) * 0.96;
  } else {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float n = vnoise(p * 6.0 + vec2(uTime * 0.7, -uTime * 0.4)) + vnoise(p * 13.0 - uTime * 1.3) * 0.5;
    col = mix(uMid, uLight, step(0.62, n));
    col = mix(col, uFoam, step(0.9, n));
    a = (1.0 - smoothstep(0.72, 0.78, r + (n - 0.75) * 0.3)) * 0.92;
  }
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function sheetMat(ctx: WorldCtx, mode: 0 | 1, len: number): ShaderMaterial {
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, fog: true, transparent: true, depthWrite: false,
    side: DoubleSide, blending: NormalBlending,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uTime: { value: 0 }, uMode: { value: mode }, uLen: { value: len },
      uDeep: { value: new Color('#4a73b8') }, uMid: { value: new Color('#8db3ec') },
      uLight: { value: new Color('#f4f8ff') }, uFoam: { value: new Color('#fff6f2') },
    }]),
  }));
  mat.uniforms.uTime = lifeTime(ctx);
  return mat;
}

export interface FallSpec {
  lip: Vector3;      // top centre of the fall (world)
  out: Vector3;      // unit horizontal direction the water leaves the cliff
  right: Vector3;    // unit horizontal across the fall
  width: number;
  bottom: number;    // world y of the plunge pool (river surface)
  /** Scale of the lip curl and outward arc (1 = free fall off a cliff; small = a trickle hugging the rock). */
  reach?: number;
}

const CURL = 1.3; // radius of the rounded lip (m)

/** Sheet geometry: curls over a rounded lip, then falls on a gentle outward arc, widening downward. */
function sheet(spec: FallSpec): BufferGeometry {
  const cols = 9, len = spec.lip.y - spec.bottom + 1, rows = Math.max(10, Math.round(len / 2.5));
  const arc = CURL * Math.PI * 0.5;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const v = (r / rows) ** 1.3 * len;
    const curl = v < arc;
    const t = v / CURL;
    const outD = (curl ? CURL * Math.sin(t) : CURL + 1.4 * (1 - Math.exp(-(v - arc) / 3.5))) * (spec.reach ?? 1);
    const drop = curl ? CURL * (1 - Math.cos(t)) : CURL + (v - arc);
    const w = spec.width * (0.8 + 0.42 * (v / len));
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const p = spec.lip.clone().addScaledVector(spec.out, outD).addScaledVector(spec.right, (u - 0.5) * w);
      p.y -= drop;
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
  return geometry(pos, uv, idx);
}

/** Flat foam disc quad (uv = disc coordinates) at c with half-size h. */
function poolGeo(c: Vector3, h: number): BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
    pos.push(c.x + x * h, c.y, c.z + y * h);
    uv.push(x * 0.5 + 0.5, y * 0.5 + 0.5);
  }
  return geometry(pos, uv, [0, 2, 1, 0, 3, 2]);
}

function geometry(pos: number[], uv: number[], idx: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Waterfall sheet + foam pool (+ rising mist) at the plunge; returns the foot (pool centre). */
export function buildWaterfall(ctx: WorldCtx, spec: FallSpec, mist = true): { foot: Vector3 } {
  const len = spec.lip.y - spec.bottom + 1;
  const fall = new Mesh(ctx.own(sheet(spec)), sheetMat(ctx, 0, len));
  fall.name = 'waterfall';
  fall.renderOrder = 2;
  const foot = spec.lip.clone().addScaledVector(spec.out, (CURL + 1.4) * (spec.reach ?? 1)).setY(spec.bottom + 0.06);
  const pool = new Mesh(ctx.own(poolGeo(foot, spec.width * 1.05)), sheetMat(ctx, 1, len));
  pool.name = 'waterfallPool';
  pool.renderOrder = 1;
  const rng = ctx.rng.fork(0x3f11);
  const puffs: Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    puffs.push(foot.clone().addScaledVector(spec.right, rng.range(-0.6, 0.6) * spec.width).addScaledVector(spec.out, rng.range(-1, 5)).setY(spec.bottom + rng.range(-1, 2)));
  }
  if (mist) buildMist(ctx, puffs, { rise: 16, size: [2.5, 6], speed: 0.11, alpha: 0.55, color: '#ffe3e8' });
  for (const mesh of [fall, pool]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    ctx.group.add(mesh);
  }
  return { foot };
}
