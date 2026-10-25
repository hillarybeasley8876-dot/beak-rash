// Asphalt detail, patched into the road's toon material: a two-tone low-frequency tint — every lane is laid
// in panels 18-38 m long of worn (light) or fresh (dark) asphalt with straight seams, blended over fwidth so
// the seams stay crisp up close and soften instead of shimmering far away — plus a ±3 % mottle (two noise
// octaves at unrelated scales: no visible repeat), and a darker worn racing-line band (its x comes per road
// row in the `aLine` attribute, road/line.ts), streaked along the road.
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, Vector2, Vector3, type MeshToonMaterial } from 'three';
import { Rng } from '../../core/rng';
import type { RoadLook } from '../looks';

const NOISE = 256;

const DETAIL_PARS = /* glsl */`
uniform sampler2D uRoadNoise;
uniform vec3 uToneA;
uniform vec3 uToneB;
uniform float uLineDark;
uniform float uLaneW;
varying vec3 vRoadXS;
float roadHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// 1 = worn (light) panel, 0 = fresh (dark), for lane index 'lane' at s; seams across s blended over fwidth.
float roadPanel(float lane, float s) {
  float len = 18.0 + 20.0 * fract(lane * 0.618 + 0.31);
  float t = s / len + fract(lane * 0.37 + 0.5);
  float i = floor(t), f = t - i, w = min(0.5, fwidth(t) * 1.5);
  float a = step(0.5, roadHash(vec2(i, lane))), b = step(0.5, roadHash(vec2(i + 1.0, lane)));
  return mix(a, b, smoothstep(1.0 - w, 1.0, f));
}`;

const DETAIL_GLSL = /* glsl */`
  {
    vec2 xs = vRoadXS.xy;
    float u = xs.x / uLaneW, lane = floor(u), fu = u - lane, wu = min(0.5, fwidth(u) * 1.5);
    float panel = mix(roadPanel(lane, xs.y), roadPanel(lane + 1.0, xs.y), smoothstep(1.0 - wu, 1.0, fu));
    float n = texture2D(uRoadNoise, xs * vec2(0.031, 0.0083)).r * 0.65 + texture2D(uRoadNoise, xs * vec2(0.047, 0.019) + 0.37).r * 0.35;
    float band = 1.0 - smoothstep(0.6, 1.2, abs(xs.x - vRoadXS.z));
    float streak = texture2D(uRoadNoise, xs * vec2(0.45, 0.012) + 0.71).r;
    diffuseColor.rgb *= mix(uToneB, uToneA, panel) * (1.0 + (n - 0.5) * 0.06) * (1.0 - uLineDark * band * (0.5 + 0.5 * streak));
  }`;

/** Noise texels, computed once per page (every build gets its own texture over the same data). */
let noiseData: Uint8Array | null = null;

/** Tileable value noise (three octaves) in one channel, mean ~0.5 (mottle octaves and the line streaks). */
function noiseTexture(): DataTexture {
  const data = noiseData ?? (noiseData = makeNoise());
  const t = new DataTexture(data, NOISE, NOISE, RedFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function makeNoise(): Uint8Array {
  const rng = new Rng(0x5eed7a);
  const data = new Uint8Array(NOISE * NOISE);
  const acc = new Float32Array(NOISE * NOISE);
  for (const [cells, amp] of [[6, 0.55], [12, 0.3], [24, 0.15]] as Array<[number, number]>) {
    const lat = Array.from({ length: cells * cells }, () => rng.next());
    const at = (i: number, j: number): number => lat[((j + cells) % cells) * cells + ((i + cells) % cells)] ?? 0;
    for (let y = 0; y < NOISE; y++) {
      for (let x = 0; x < NOISE; x++) {
        const fx = (x / NOISE) * cells, fy = (y / NOISE) * cells;
        const i = Math.floor(fx), j = Math.floor(fy);
        const u = (fx - i) ** 2 * (3 - 2 * (fx - i)), v = (fy - j) ** 2 * (3 - 2 * (fy - j));
        const a = at(i, j) + (at(i + 1, j) - at(i, j)) * u, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
        acc[y * NOISE + x] = (acc[y * NOISE + x] ?? 0) + (a + (b - a) * v) * amp;
      }
    }
  }
  // Stretch the contrast around the mean so the values span most of 0…1.
  let mean = 0;
  for (const v of acc) mean += v;
  mean /= acc.length;
  for (let i = 0; i < acc.length; i++) data[i] = Math.round(Math.min(1, Math.max(0, 0.5 + ((acc[i] ?? 0) - mean) * 2.2)) * 255);
  return data;
}

/**
 * Add the detail to the road material: needs uv u = 0…1 across the asphalt (2·halfWidth m, four lanes),
 * v = s / period, and the per-vertex `aLine` attribute (racing-line x in m). Returns the noise texture
 * (owned by the caller).
 */
export function roadDetail(mat: MeshToonMaterial, look: RoadLook, halfWidth: number, period: number): DataTexture {
  const noise = noiseTexture();
  const [a, b] = look.tones;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRoadNoise = { value: noise };
    shader.uniforms.uRoadSize = { value: new Vector2(2 * halfWidth, period) };
    shader.uniforms.uToneA = { value: new Vector3(a[0], a[1], a[2]) };
    shader.uniforms.uToneB = { value: new Vector3(b[0], b[1], b[2]) };
    shader.uniforms.uLineDark = { value: look.line };
    shader.uniforms.uLaneW = { value: halfWidth / 2 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uRoadSize;\nattribute float aLine;\nvarying vec3 vRoadXS;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRoadXS = vec3((uv.x - 0.5) * uRoadSize.x, uv.y * uRoadSize.y, aLine);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${DETAIL_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>${DETAIL_GLSL}`);
  };
  mat.customProgramCacheKey = () => 'track-road';
  return noise;
}
