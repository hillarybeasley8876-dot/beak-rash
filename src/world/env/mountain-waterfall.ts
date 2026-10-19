// Sunset Pass waterfall (env-mountain): the fall is 1–4 separate water strands pouring over a stepped lip
// (side strands start lower), each a curved ribbon that curls over a rounded lip, bulges outward like a
// rounded column and widens as it falls. Toon-striped, unlit and fogged: a white core, pale-blue then
// deep-blue edges, thin streaks racing down, an ink line just inside the ragged sides, foam at the lip
// and spray at the foot. A churning foam pool with a white ring sits at the plunge, mist rises from it.
// Everything animates on the shared sim-time uniform.
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, NormalBlending, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';
import type { Rng } from '../../core/rng';
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

// aStrand = (seed, strand length in m); uv.x across the strand (0..1), uv.y metres down from its lip.
const SHEET_VERT = /* glsl */`
#include <fog_pars_vertex>
attribute vec2 aStrand;
varying vec2 vUv; varying vec2 vStrand;
void main() {
  vUv = uv; vStrand = aStrand;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const STRAND = /* glsl */`
  float x = vUv.x, v = vUv.y, sd = vStrand.x, len = vStrand.y;
  // Ragged sides (cut, not faded) with the ink line just inside the cut.
  float rag = (vnoise(vec2(v * 0.5 - uTime * 2.2, sd * 7.0)) - 0.5) * 0.2
            + (vnoise(vec2(v * 1.7 - uTime * 3.3, sd * 13.0 + 5.0)) - 0.5) * 0.08;
  float e = min(x, 1.0 - x) + rag;
  if (e < 0.05) discard;
  // Toon bands across the strand (round column): deep edge, pale blue, white core; edges wobble downward.
  float c = e + (vnoise(vec2(v * 0.12 - uTime * 1.1, sd * 3.0 + x * 2.0)) - 0.5) * 0.1;
  col = mix(uDeep, uMid, step(0.13, c));
  col = mix(col, uLight, step(0.26, c));
  // Thin streaks racing down: per lane speed and phase.
  float lane = floor(x * 7.0);
  float sp = 0.8 + 0.5 * hash(vec2(lane, sd)), ph = hash(vec2(lane + 3.0, sd));
  float streak = step(0.84, fract(v * 0.075 - uTime * sp + ph));
  col = mix(col, uMid, streak * step(0.26, c) * 0.85);
  col = mix(col, uDeep, streak * (1.0 - step(0.26, c)) * step(0.13, c) * 0.6);
  // Foam over the lip and spray churning at the foot.
  float lip = 1.0 - step(0.9 + 0.8 * vnoise(vec2(x * 6.0 + sd, uTime * 0.8)), v);
  float spray = step(len - 5.0 - 3.5 * vnoise(vec2(x * 5.0 + sd, v * 0.3 - uTime * 3.0)), v);
  col = mix(col, uFoam, max(lip, spray));
  col = mix(col, uInk, 1.0 - step(0.085, e));
  a = 1.0;`;

const POOL = /* glsl */`
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float n = vnoise(p * 6.0 + vec2(uTime * 0.7, -uTime * 0.4)) + vnoise(p * 13.0 - uTime * 1.3) * 0.5;
  col = mix(uMid, uLight, step(0.62, n));
  col = mix(col, uFoam, step(0.9, n));
  // Churning white ring where the strands hit, breathing outward.
  float ring = 0.5 + 0.04 * sin(uTime * 3.0) + (n - 0.75) * 0.14;
  col = mix(col, uFoam, 1.0 - step(0.1, abs(r - ring)));
  a = (1.0 - smoothstep(0.74, 0.8, r + (n - 0.75) * 0.3)) * 0.94;`;

// uMode 0 = strands, 1 = foam pool (uv = disc coordinates).
const SHEET_FRAG = /* glsl */`
#include <fog_pars_fragment>
uniform float uTime; uniform float uMode;
uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uLight; uniform vec3 uFoam; uniform vec3 uInk;
varying vec2 vUv; varying vec2 vStrand;
${NOISE}
void main() {
  vec3 col; float a;
  if (uMode < 0.5) {${STRAND}
  } else {${POOL}
  }
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function sheetMat(ctx: WorldCtx, mode: 0 | 1): ShaderMaterial {
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, fog: true,
    // Strands are cut (discard) and opaque; the pool is a soft-edged transparent disc on the water.
    transparent: mode === 1, depthWrite: mode === 0, side: DoubleSide, blending: NormalBlending,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uTime: { value: 0 }, uMode: { value: mode },
      uDeep: { value: new Color('#3f68b0') }, uMid: { value: new Color('#9cc4f4') },
      uLight: { value: new Color('#f6faff') }, uFoam: { value: new Color('#fff8f4') }, uInk: { value: new Color('#2b2440') },
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
  /** Water strands across the width (default one per ~4.5 m, 1–4). */
  strands?: number;
}

const CURL = 1.3; // radius of the rounded lip (m)
const COLS = 7;

interface Strand { c: number; w: number; step: number; seed: number }

/** Strands across the fall: centre (−0.5…0.5 of the width), width share, lip step down (side strands lower). */
function layout(n: number, rng: Rng): Strand[] {
  return Array.from({ length: n }, (_, k) => ({
    c: n === 1 ? 0 : -0.5 + (k + 0.5) / n + rng.range(-0.03, 0.03),
    w: n === 1 ? 1 : (1 / n) * rng.range(0.8, 0.95),
    step: n > 2 && (k === 0 || k === n - 1) ? rng.range(0.8, 1.8) : rng.range(0, 0.5),
    seed: k * 1.618 + rng.range(0, 1),
  }));
}

/** Outward distance and drop (m) after the water has run v m down a strand. */
function path(v: number, reach: number): { out: number; drop: number } {
  const arc = CURL * Math.PI * 0.5;
  if (v < arc) return { out: CURL * Math.sin(v / CURL) * reach, drop: CURL * (1 - Math.cos(v / CURL)) };
  return { out: (CURL + 1.4 * (1 - Math.exp(-(v - arc) / 3.5))) * reach, drop: CURL + (v - arc) };
}

/** Every strand of one fall in one geometry: curls over the lip, bulges outward across, widens downward. */
function strandGeo(spec: FallSpec, list: Strand[]): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], st: number[] = [], idx: number[] = [];
  const reach = spec.reach ?? 1;
  for (const s of list) {
    const len = spec.lip.y - s.step - spec.bottom + 1;
    const rows = Math.max(8, Math.round(len / 2.5));
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const v = (r / rows) ** 1.3 * len;
      const { out, drop } = path(v, reach);
      const w = spec.width * s.w * (0.9 + 0.4 * (v / len));
      for (let c = 0; c < COLS; c++) {
        const u = c / (COLS - 1);
        const bulge = Math.sin(Math.PI * u) * w * 0.22 * Math.min(1, reach * 2);
        const p = spec.lip.clone().addScaledVector(spec.out, out + bulge).addScaledVector(spec.right, s.c * spec.width + (u - 0.5) * w);
        pos.push(p.x, p.y - s.step - drop, p.z);
        uv.push(u, v);
        st.push(s.seed, len);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c + 1 < COLS; c++) {
        const a = base + r * COLS + c;
        idx.push(a, a + COLS, a + 1, a + 1, a + COLS, a + COLS + 1);
      }
    }
  }
  return geometry(pos, uv, idx, st);
}

/** Flat foam disc quad (uv = disc coordinates) at c with half-size h. */
function poolGeo(c: Vector3, h: number): BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
    pos.push(c.x + x * h, c.y, c.z + y * h);
    uv.push(x * 0.5 + 0.5, y * 0.5 + 0.5);
  }
  return geometry(pos, uv, [0, 2, 1, 0, 3, 2], [0, 0, 0, 0, 0, 0, 0, 0]);
}

function geometry(pos: number[], uv: number[], idx: number[], strand: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('aStrand', new BufferAttribute(new Float32Array(strand), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Waterfall strands + foam pool (+ rising mist) at the plunge; returns the foot (pool centre). */
export function buildWaterfall(ctx: WorldCtx, spec: FallSpec, mist = true): { foot: Vector3 } {
  const rng = ctx.rng.fork(0x3f11);
  const n = spec.strands ?? Math.min(4, Math.max(1, Math.round(spec.width / 4.5)));
  const fall = new Mesh(ctx.own(strandGeo(spec, layout(n, rng))), sheetMat(ctx, 0));
  fall.name = 'waterfall';
  const foot = spec.lip.clone().addScaledVector(spec.out, (CURL + 1.4) * (spec.reach ?? 1)).setY(spec.bottom + 0.06);
  const pool = new Mesh(ctx.own(poolGeo(foot, spec.width * 1.05)), sheetMat(ctx, 1));
  pool.name = 'waterfallPool';
  pool.renderOrder = 1;
  const puffs: Vector3[] = [];
  for (let i = 0; i < 20; i++) {
    puffs.push(foot.clone().addScaledVector(spec.right, rng.range(-0.6, 0.6) * spec.width).addScaledVector(spec.out, rng.range(-1, 5)).setY(spec.bottom + rng.range(-1, 2)));
  }
  if (mist) buildMist(ctx, puffs, { rise: 16, size: [3, 7], speed: 0.11, alpha: 0.6, color: '#ffe3e8' });
  for (const mesh of [fall, pool]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    ctx.group.add(mesh);
  }
  return { foot };
}
