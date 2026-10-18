// Sunset Pass terrain grade (env-mountain): after the shared terrain builders ran, repaint the
// terrain vertex colours with an alpine palette — pebble shores, lush lake meadows, dark forest
// floor, golden alpine grass higher up, warm granite on steep faces and snow on the far peaks —
// switch the far grid's farmland patchwork off (no wheat fields on a mountain pass) and give the
// terrain the mountain material (broad strata on steep faces, env/mountain-terrain-mat.ts).
import { Color, Mesh, type BufferAttribute } from 'three';
import { smoothstep } from '../../core/math';
import type { WorldCtx } from '../ctx';
import type { Noise2 } from '../terrain/noise';
import { mountainTerrainMat } from './mountain-terrain-mat';

const C = (h: string): Color => new Color(h);
const PAL = {
  wet: C('#a88f74'), pebble: C('#d6bd92'), meadow: C('#5f9f43'), meadowDark: C('#3c7b37'), forest: C('#2f6435'),
  dry: C('#a3ad55'), alpine: C('#a7a85a'), alpineGold: C('#c9ad5f'), rock: C('#a7837a'), rockDark: C('#6e5462'),
  rockHigh: C('#8c7f95'), snow: C('#f7eff3'), stone: C('#cdbfa8'),
} as const;

const tmp = new Color(), orig = new Color(), paint = new Color();

/** Alpine ground colour from height, normal.y, a noise value in [-1, 1] and the original colour. */
export function alpineColor(h: number, ny: number, n: number, src: Color, out: Color): Color {
  const lum = (src.r + src.g + src.b) / 3;
  const sat = Math.max(src.r, src.g, src.b) - Math.min(src.r, src.g, src.b);
  // Shores: wet pebbles at the waterline, dry pebbles just above.
  if (h < 0.6) return out.copy(PAL.wet);
  if (h < 2.2 && src.r > src.g) return out.copy(PAL.pebble).lerp(PAL.wet, Math.max(0, n) * 0.3);
  // Paved / stone ground kept by the layout (village plaza, finish area).
  if (lum > 0.42 && sat < 0.22 && src.r >= src.g && h < 60) return out.copy(PAL.stone);
  const steep = 1 - smoothstep(0.7, 0.76, ny);
  // Vegetation by altitude: meadow → forest-floor patches → golden alpine grass → bare rock → snow.
  if (h < 140) {
    out.copy(PAL.meadow);
    if (n > 0.18) out.lerp(PAL.forest, 0.75);
    else if (n > -0.05) out.lerp(PAL.meadowDark, 0.6);
    else if (n < -0.45) out.lerp(PAL.dry, 0.55);
    out.lerp(PAL.alpine, smoothstep(70, 140, h) * 0.6);
  } else {
    out.copy(PAL.alpine).lerp(PAL.alpineGold, n > 0 ? 0.5 : 0.1);
    out.lerp(PAL.rockHigh, smoothstep(240, 340, h) * 0.8);
  }
  if (steep > 0) {
    tmp.copy(PAL.rock).lerp(PAL.rockDark, n > 0.1 ? 0.55 : 0.12).lerp(PAL.rockHigh, smoothstep(160, 320, h) * 0.6);
    out.lerp(tmp, steep);
  }
  // Snow caps on the high peaks (more on gentler slopes).
  const snow = smoothstep(360, 430, h + n * 25) * (0.35 + 0.65 * smoothstep(0.55, 0.8, ny));
  if (snow > 0) out.lerp(PAL.snow, snow);
  return out;
}

/** Repaint every terrain mesh of the track (near ribbons, far grid, tunnel caps). */
export function gradeMountainTerrain(ctx: WorldCtx, noise: Noise2): void {
  let verts = 0, swapped = 0;
  for (const o of ctx.group.children) {
    if (!(o instanceof Mesh)) continue;
    if (!(o.name.startsWith('near') || o.name.startsWith('far:') || o.name === 'tunnelCap')) continue;
    const geo = o.geometry;
    const pos = geo.getAttribute('position') as BufferAttribute;
    const nrm = geo.getAttribute('normal') as BufferAttribute;
    const col = geo.getAttribute('color') as BufferAttribute | undefined;
    if (!col) continue;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      orig.setRGB(col.getX(i), col.getY(i), col.getZ(i));
      alpineColor(y, nrm.getY(i), noise.get(x / 31, z / 31), orig, paint);
      col.setXYZ(i, paint.r, paint.g, paint.b);
    }
    col.needsUpdate = true;
    if (!Array.isArray(o.material) && o.material.customProgramCacheKey().startsWith('track-terrain')) {
      o.material = mountainTerrainMat(ctx);
      swapped++;
    }
    const farm = geo.getAttribute('farm') as BufferAttribute | undefined;
    if (farm) {
      (farm.array as Float32Array).fill(0);
      farm.needsUpdate = true;
    }
    verts += pos.count;
  }
  // The swap keys on the track unit's program cache key; if that changes, say so instead of silently keeping the coast look.
  if (swapped === 0) console.warn('[mountain] no track-terrain material found: terrain keeps the default material');
  ctx.log(`terrain graded: ${verts} vertices, ${swapped} materials swapped`);
}

export type GroundCover = 'gravel' | 'meadow' | 'scree';
const COVER: Record<GroundCover, [Color, Color, Color]> = {
  gravel: [C('#cdbfa6'), C('#ad9f89'), C('#e0d4bd')],
  meadow: [C('#5aa548'), C('#e889b6'), C('#f2d35c')],
  scree: [C('#a9a39b'), C('#8b857f'), C('#c2bbb1')],
};

/**
 * Repaint the near terrain within r of world (cx, cz) with a ground cover (hairpin islands): a base tone
 * with two noise-patch accents (gravel speckle, flower patches, scree stones); ragged edge, flat ground only.
 */
export function paintGround(ctx: WorldCtx, noise: Noise2, cx: number, cz: number, r: number, kind: GroundCover): void {
  const [base, accA, accB] = COVER[kind];
  for (const o of ctx.group.children) {
    if (!(o instanceof Mesh) || !o.name.startsWith('near')) continue;
    const geo = o.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const bs = geo.boundingSphere;
    if (bs && Math.hypot(bs.center.x - cx, bs.center.z - cz) > bs.radius + r) continue;
    const pos = geo.getAttribute('position') as BufferAttribute, nrm = geo.getAttribute('normal') as BufferAttribute;
    const col = geo.getAttribute('color') as BufferAttribute | undefined;
    if (!col) continue;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const edge = r * (0.86 + 0.14 * noise.get(x / 5, z / 5));
      if (Math.hypot(x - cx, z - cz) > edge || nrm.getY(i) < 0.8) continue;
      const n1 = noise.get(x / 2.3 + 11, z / 2.3), n2 = noise.get(x / 3.1 - 7, z / 3.1 + 5);
      paint.copy(base);
      if (n1 > 0.35) paint.copy(accA);
      else if (n2 > 0.42) paint.copy(accB);
      col.setXYZ(i, paint.r, paint.g, paint.b);
    }
    col.needsUpdate = true;
  }
}
