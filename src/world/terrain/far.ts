// Far terrain: a chunked world-space grid (16 m cells) around the whole road, held under the near
// ribbons and the road. Chunks entirely below the sea are skipped; chunks past the fog are hidden
// by world/lod.ts (userData.cullMargin).
import { BufferAttribute, BufferGeometry, Color, Mesh } from 'three';
import { smoothstep } from '../../core/math';
import type { WorldCtx } from '../ctx';
import type { GroundDef } from '../layout/types';
import { farmAllowed, farmWeight } from './farmland';
import { terrainMat } from './material';
import { borderSink } from './tracks';
import type { TerrainField, WorldSample } from './field';
import { NEAR_EXTENT, ribbonReach, type NearRibbon } from './near';
import { groundColor, isShore, profileY, tintNoise } from './profile';

type GroundMat = GroundDef['mat'];

const CELL = 16;
const CHUNK = 24;           // cells per chunk side
const MARGIN = 1000;        // beyond the road's bounding box (≈ fog far)
const HOLD = 3;             // metres under the near ribbons

/**
 * Keep the grid under the near ribbon: 3 m below the profile across the ribbon, and under a cone
 * rising from 4 m below the road edge so cells spanning the road and a wall never poke through.
 */
function holdDown(h: number, u: number, edgeY: number): number {
  const held = h - HOLD * (1 - smoothstep(NEAR_EXTENT - 8, NEAR_EXTENT + 18, u));
  const cone = edgeY - 4 + Math.max(0, u - 6) * 1.4;
  return Math.min(held, cone);
}

/**
 * Deep hold well inside the near ribbon: the grid's 16 m chords must not cut through concave
 * profiles (cliff feet, coves), so a vertex the ribbon covers on all sides sinks below the lowest
 * profile point within one cell; towards the ribbon's outer edge the regular hold takes over.
 */
function deepHold(field: TerrainField, smp: WorldSample, edgeY: number, reach: number, held: number): number {
  const w = smoothstep(reach - 26, reach - 14, smp.u);
  if (w >= 1) return held;
  const roadY = field.q.frameVis(smp.s).pos.y;
  let lo = Infinity;
  for (let du = -CELL; du <= CELL; du += 4) lo = Math.min(lo, profileY(smp.g, edgeY, roadY, Math.max(0, smp.u + du)));
  return Math.min(held, held + (lo - 3 - smp.g.rough - held) * (1 - w));
}

/** Vertices under the road sink below the lowest ground within one cell beyond either edge. */
function roadHold(field: TerrainField, smp: WorldSample): number {
  const gl = field.ground(smp.s, -1), gr = field.ground(smp.s, 1);
  if (gl.detached || gr.detached) return smp.h;
  const roadY = field.q.frameVis(smp.s).pos.y;
  let lo = smp.h;
  for (const side of [-1, 1] as const) {
    const g = side < 0 ? gl : gr, edgeY = field.edgeY(smp.s, side);
    for (let u = 0; u <= CELL; u += 4) lo = Math.min(lo, profileY(g, edgeY, roadY, u) - 3 - g.rough);
  }
  return lo;
}

/** Exact height of the far grid's rendered triangles at a world point (NaN outside the grid). */
export type FarHeight = (wx: number, wz: number) => number;

export function buildFarTerrain(ctx: WorldCtx, field: TerrainField, ribbons: NearRibbon[] = []): FarHeight {
  const { L } = ctx;
  // The farmland quilt and the border's fall-away are per track (terrain/tracks.ts): the Gobi is
  // desert, so its far hills are sand and its horizon is a dry basin, not an ocean.
  const farm = farmAllowed(ctx.id);
  const sink = borderSink(ctx.id);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < L.n; i += 4) {
    minX = Math.min(minX, L.px[i] ?? 0); maxX = Math.max(maxX, L.px[i] ?? 0);
    minZ = Math.min(minZ, L.pz[i] ?? 0); maxZ = Math.max(maxZ, L.pz[i] ?? 0);
  }
  const margin = L.def.farMargin ?? MARGIN;
  const x0 = Math.floor((minX - margin) / CELL) * CELL, z0 = Math.floor((minZ - margin) / CELL) * CELL;
  const nx = Math.ceil((maxX + margin - x0) / CELL), nz = Math.ceil((maxZ + margin - z0) / CELL);
  // Sample every grid vertex once.
  const vx = nx + 1, vz = nz + 1;
  const H = new Float32Array(vx * vz);
  const U = new Float32Array(vx * vz);
  const M = new Array<GroundMat>(vx * vz);
  const S = new Uint8Array(vx * vz);
  for (let j = 0; j < vz; j++) {
    for (let i = 0; i < vx; i++) {
      const wx = x0 + i * CELL, wz = z0 + j * CELL;
      const smp = field.sampleWorld(wx, wz);
      const k = j * vx + i;
      // Beyond the ends of the visual road the ribbons stop: keep the regular hold there.
      const inside = smp.s > L.sMin + 2 && smp.s < L.sMin + L.n - 3;
      const rb = inside ? ribbons.find((r) => r.side === smp.side) : undefined;
      let h: number;
      if (smp.u < 0) h = rb ? roadHold(field, smp) : smp.h;
      else {
        const edgeY = field.edgeY(smp.s, smp.side);
        const held = holdDown(smp.h, smp.u, edgeY);
        h = rb ? deepHold(field, smp, edgeY, ribbonReach(rb, smp.s), held) : held;
      }
      // Far beyond the fog the land sinks into the sea along a ragged coastline, so the world
      // reads as a headland rather than a rectangle from the air.
      const edge = Math.min(i, j, vx - 1 - i, vz - 1 - j) * CELL + field.noise.fbm(wx / 300, wz / 300, 2) * 160;
      H[k] = h + (sink - h) * (1 - smoothstep(60, 420, edge));
      U[k] = smp.u;
      M[k] = smp.bump ? smp.bump.mat : smp.g.mat;
      S[k] = isShore(smp.g) || smp.bump ? 1 : 0;
    }
  }
  const mat = terrainMat(ctx, farm);
  const color = new Color();
  for (let cj = 0; cj < nz; cj += CHUNK) {
    for (let ci = 0; ci < nx; ci += CHUNK) {
      const ni = Math.min(CHUNK, nx - ci), nj = Math.min(CHUNK, nz - cj);
      let above = false;
      for (let j = cj; j <= cj + nj && !above; j++) for (let i = ci; i <= ci + ni; i++) if ((H[j * vx + i] ?? -99) > -1.2) { above = true; break; }
      if (!above) continue;
      const cols = ni + 1, rows = nj + 1;
      const pos = new Float32Array(cols * rows * 3), uv = new Float32Array(cols * rows * 2);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = (cj + j) * vx + (ci + i), v = j * cols + i;
          pos[v * 3] = x0 + (ci + i) * CELL; pos[v * 3 + 1] = H[k] ?? 0; pos[v * 3 + 2] = z0 + (cj + j) * CELL;
          uv[v * 2] = (pos[v * 3] ?? 0) / 6; uv[v * 2 + 1] = (pos[v * 3 + 2] ?? 0) / 6;
        }
      }
      // Rows run along +z, columns along +x: wind so faces point up.
      const idx: number[] = [];
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = j * cols + i, b = a + 1, d = a + cols, e = d + 1;
          idx.push(a, d, b, b, d, e);
        }
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(pos, 3));
      geo.setAttribute('uv', new BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const nrm = geo.getAttribute('normal').array as Float32Array;
      const col = new Float32Array(cols * rows * 3);
      const farmW = new Float32Array(cols * rows);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = (cj + j) * vx + (ci + i), v = j * cols + i;
          const wx = pos[v * 3] ?? 0, wz = pos[v * 3 + 2] ?? 0;
          const m = M[k] ?? 'grass';
          groundColor(m, H[k] ?? 0, nrm[v * 3 + 1] ?? 1, Math.max(0, U[k] ?? 0), field.noise.get(wx / 23, wz / 23), S[k] === 1, color,
            tintNoise(field.noise, wx, wz));
          col[v * 3] = color.r; col[v * 3 + 1] = color.g; col[v * 3 + 2] = color.b;
          farmW[v] = farm ? farmWeight(field.noise, wx, wz, U[k] ?? 0, nrm[v * 3 + 1] ?? 1, H[k] ?? 0, S[k] === 1) : 0;
        }
      }
      geo.setAttribute('color', new BufferAttribute(col, 3));
      if (farm) geo.setAttribute('farm', new BufferAttribute(farmW, 1));
      geo.computeBoundingSphere();
      const mesh = new Mesh(ctx.own(geo), mat);
      mesh.name = `far:${ci},${cj}`;
      mesh.receiveShadow = true;
      mesh.userData.heightmap = true;
      mesh.userData.cullMargin = 60;   // world/lod.ts hides chunks past the fog
      ctx.group.add(mesh);
    }
  }
  const heightAt: FarHeight = (wx, wz) => {
    const fx = (wx - x0) / CELL, fz = (wz - z0) / CELL;
    if (fx < 0 || fz < 0 || fx >= nx || fz >= nz) return Number.NaN;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const h = (a: number, b: number): number => H[b * vx + a] ?? 0;
    // Same split as the index buffer: (a, d, b) and (b, d, e).
    if (u + v <= 1) return h(i, j) + (h(i + 1, j) - h(i, j)) * u + (h(i, j + 1) - h(i, j)) * v;
    return h(i + 1, j + 1) + (h(i, j + 1) - h(i + 1, j + 1)) * (1 - u) + (h(i + 1, j) - h(i + 1, j + 1)) * (1 - v);
  };
  return heightAt;
}
