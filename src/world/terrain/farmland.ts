// Farmland on the far hills: a per-vertex `farm` weight (gentle, dry, inland ground away from the
// road) and the fragment code that paints a patchwork of fields there — staggered rows of fields on
// a rotated grid, one crop colour per field, furrows and dark hedge borders.
import { Color } from 'three';
import { smoothstep } from '../../core/math';
import type { Noise2 } from './noise';

/** Crop colours: wheat, young crop, lavender, olive grove, ploughed earth, sunflowers. */
const PALETTE = ['#e6c35c', '#a3cf5a', '#a58bd3', '#6f9a45', '#c49461', '#f3cf37'].map((h) => new Color(h));
const HEDGE = new Color('#4d7a35');

/**
 * Farm weight (0..1) of a far-grid vertex: u = metres beyond the drivable edge, ny = normal.y,
 * h = height above the sea; shore and island ground never farms.
 */
export function farmWeight(noise: Noise2, wx: number, wz: number, u: number, ny: number, h: number, shore: boolean): number {
  if (shore) return 0;
  const patch = smoothstep(-0.2, 0.15, noise.get(wx / 520, wz / 520));
  return smoothstep(85, 130, u) * smoothstep(0.9, 0.95, ny) * smoothstep(4, 9, h) * (1 - smoothstep(95, 115, h)) * patch;
}

export const FARM_UNIFORMS = { uFarmPal: { value: PALETTE }, uHedge: { value: HEDGE } };

export const FARM_VERT_HEAD = 'attribute float farm;\nvarying float vFarm;';
export const FARM_VERT_BODY = 'vFarm = farm;';
export const FARM_FRAG_HEAD = `uniform vec3 uFarmPal[6];
uniform vec3 uHedge;
varying float vFarm;
vec3 farmField(vec2 xz, out float hedge) {
  vec2 p = mat2(0.94, 0.34, -0.34, 0.94) * xz;
  float col = floor(p.x / 78.0);
  vec2 q = vec2(p.x / 78.0, p.y / 54.0 + col * 0.43);
  vec2 cell = floor(q), f = fract(q);
  float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  int k = int(floor(h * 6.0));
  vec3 c = uFarmPal[0];
  for (int i = 1; i < 6; i++) if (i == k) c = uFarmPal[i];
  float along = fract(h * 13.37) < 0.5 ? f.x * 78.0 : f.y * 54.0;
  c *= 1.0 - 0.14 * smoothstep(0.3, 0.5, abs(fract(along / 3.4) - 0.5));
  vec2 e = min(f, 1.0 - f) * vec2(78.0, 54.0);
  hedge = 1.0 - smoothstep(1.0, 2.0, min(e.x, e.y));
  return c;
}`;
/** Runs after the vertex colour is applied (grainC comes from the map chunk). */
export const FARM_FRAG_BODY = `{
  float hedge;
  vec3 fc = mix(farmField(vWPos.xz, hedge), uHedge, hedge);
  diffuseColor.rgb = mix(diffuseColor.rgb, fc * grainC.rgb, smoothstep(0.45, 0.6, vFarm));
}`;
