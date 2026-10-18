// Near terrain: one ribbon per side from the drivable edge out to ~52 m, rows every 2 m, sharing
// the road edge vertices exactly (no seams). Chunked so camera and shadow frustum culling work.
// Also answers exact ground-height queries for prop placement (same triangles as rendered).
import { Color, Mesh, Vector3 } from 'three';
import type { TrackFrame } from '../../core/types';
import type { WorldCtx } from '../ctx';
import { GridGeo, frameOffset } from '../geom';
import { terrainMat } from './material';
import type { TerrainField } from './field';
import { WALL_TOE, groundColor, isShore } from './profile';

/** Column offsets beyond the drivable edge (m). Dense near the edge for walls, steps and beaches. */
export const NEAR_U = [0, WALL_TOE, 0.15, 0.35, 0.6, 0.9, 1.25, 1.8, 2.4, 3, 4.6, 6.6, 9, 12, 16, 21, 27, 34, 42, 52];
export const NEAR_EXTENT = NEAR_U[NEAR_U.length - 1] as number;
const ROW_STEP = 2;
const CHUNK_ROWS = 96;

export interface NearRibbon {
  side: -1 | 1;
  s0: number;
  rows: number;
  /** Per-row column scale for far columns (fold prevention on the inside of tight curves). */
  scale: Float32Array;
  h: Float32Array;   // rows × cols heights
}

/** Column u for a row, compressing columns beyond 12 m where the row is capped. */
const colU = (c: number, k: number): number => {
  const u = NEAR_U[c] ?? 0;
  return u <= 12 ? u : 12 + (u - 12) * k;
};

/** Far-column compression per row so ribbons never fold on the inside of curves (≤ 0.75 R). */
function foldScale(ctx: WorldCtx, field: TerrainField, side: -1 | 1, s0: number, rows: number): Float32Array {
  const raw = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    const s = s0 + r * ROW_STEP;
    const k = ctx.q.frameVis(s).curvature * side;
    const curveRoom = k > 1e-5 ? 0.75 / k - field.bound(s, side) : Infinity;
    const room = field.mod ? Math.min(curveRoom, field.mod.room(s, side)) : curveRoom;
    raw[r] = Math.min(1, Math.max(0, (room - 12) / (NEAR_EXTENT - 12)));
  }
  // Moving minimum (±30 m) then a box blur (±16 m) keeps the outer edge smooth.
  const out = new Float32Array(rows);
  const win = Math.round(30 / ROW_STEP), blur = Math.round(16 / ROW_STEP);
  const mins = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    let m = 1;
    for (let j = Math.max(0, r - win); j <= Math.min(rows - 1, r + win); j++) m = Math.min(m, raw[j] ?? 1);
    mins[r] = m;
  }
  for (let r = 0; r < rows; r++) {
    let sum = 0, n = 0;
    for (let j = Math.max(0, r - blur); j <= Math.min(rows - 1, r + blur); j++) { sum += mins[j] ?? 1; n++; }
    out[r] = Math.min(mins[r] ?? 1, sum / n + 0.02);
  }
  return out;
}

export function buildNearTerrain(ctx: WorldCtx, field: TerrainField): NearRibbon[] {
  const { q, L } = ctx;
  const s0 = L.sMin, s1 = L.sMin + L.n - 1;
  const rows = Math.floor((s1 - s0) / ROW_STEP) + 1;
  const cols = NEAR_U.length;
  const mat = terrainMat(ctx);
  const fr: TrackFrame = q.frameVis(0);
  const edge = new Vector3(), p = new Vector3(), rh = new Vector3();
  const ribbons: NearRibbon[] = [];
  for (const side of [-1, 1] as const) {
    const scale = foldScale(ctx, field, side, s0, rows);
    const h = new Float32Array(rows * cols);
    const pos = new Float32Array(rows * cols * 3);
    const mats: string[] = new Array(rows * cols);
    const shore = new Uint8Array(rows);
    for (let r = 0; r < rows; r++) {
      const s = s0 + r * ROW_STEP;
      q.frameVis(s, fr);
      const bound = field.bound(s, side);
      const g = field.ground(s, side);
      frameOffset(fr, side * bound, 0, edge);
      rh.set(fr.right.x, 0, fr.right.z).normalize().multiplyScalar(side);
      const edgeY = edge.y;
      shore[r] = isShore(g) ? 1 : 0;
      for (let c = 0; c < cols; c++) {
        const u = colU(c, scale[r] ?? 1);
        p.copy(edge).addScaledVector(rh, u);
        const res = c === 0 && !g.detached ? { h: edgeY, bump: null } : field.shape(g, edgeY, fr.pos.y, u, p.x, p.z);
        if (field.mod && c > 0) res.h = field.mod.height(s, side, u, p.x, p.z, res.h);
        const k = r * cols + c;
        h[k] = res.h;
        pos[k * 3] = p.x; pos[k * 3 + 1] = res.h; pos[k * 3 + 2] = p.z;
        mats[k] = res.bump ? res.bump.mat : g.mat;
      }
    }
    ribbons.push({ side, s0, rows, scale, h });
    // Chunks share edge rows with their neighbours.
    for (let r0 = 0; r0 < rows - 1; r0 += CHUNK_ROWS) {
      const r1 = Math.min(rows - 1, r0 + CHUNK_ROWS);
      const geo = new GridGeo(r1 - r0 + 1, cols);
      for (let r = r0; r <= r1; r++) {
        for (let c = 0; c < cols; c++) {
          const k = r * cols + c;
          // Columns run outward; on the left that is right→left, so store them reversed.
          const cc = side < 0 ? cols - 1 - c : c;
          p.set(pos[k * 3] ?? 0, pos[k * 3 + 1] ?? 0, pos[k * 3 + 2] ?? 0);
          geo.set(r - r0, cc, p, fr.up, p.x / 6, p.z / 6);
        }
      }
      const built = geo.build({ colors: true, computeNormals: true });
      colorize(built.getAttribute('normal').array as Float32Array, geo, mats, shore, field, r0, r1, cols, side);
      const mesh = new Mesh(ctx.own(built), mat);
      mesh.name = `near${side < 0 ? 'L' : 'R'}:${r0}`;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData.heightmap = true;
      ctx.group.add(mesh);
    }
  }
  return ribbons;
}

/** Vertex colours from material, height and steepness (the colour attribute shares geo.col). */
function colorize(nrm: Float32Array, geo: GridGeo, mats: string[], shore: Uint8Array, field: TerrainField, r0: number, r1: number, cols: number, side: -1 | 1): void {
  const c = new Color();
  for (let r = r0; r <= r1; r++) {
    for (let col = 0; col < cols; col++) {
      const cc = side < 0 ? cols - 1 - col : col;
      const vi = (r - r0) * cols + cc;
      const x = geo.pos[vi * 3] ?? 0, y = geo.pos[vi * 3 + 1] ?? 0, z = geo.pos[vi * 3 + 2] ?? 0;
      const n = field.noise.get(x / 23, z / 23);
      const mat = (mats[r * cols + col] ?? 'grass') as 'sand' | 'grass' | 'rock' | 'dirt' | 'stone';
      // The flat toe at a wall's foot takes the face's colour (no grass seam along rock walls).
      const ny = (NEAR_U[col] ?? 0) <= WALL_TOE ? Math.min(nrm[vi * 3 + 1] ?? 1, nrm[toeFace(vi, side) * 3 + 1] ?? 1) : nrm[vi * 3 + 1] ?? 1;
      groundColor(mat, y, ny, NEAR_U[col] ?? 0, n, shore[r] === 1, c);
      geo.color(r - r0, cc, c);
    }
  }
}

/** Vertex index of the first column beyond the wall toe in the same row (columns stored reversed on the left). */
const TOE_COL = NEAR_U.findIndex((u) => u > WALL_TOE);
const toeFace = (vi: number, side: -1 | 1): number => {
  const cols = NEAR_U.length, row = Math.floor(vi / cols);
  return row * cols + (side < 0 ? cols - 1 - TOE_COL : TOE_COL);
};

/** Exact rendered height of a ribbon at (s, u ≥ 0 beyond the edge), or null outside it. */
export function ribbonHeight(rb: NearRibbon, s: number, u: number): number | null {
  const cols = NEAR_U.length;
  const f = (s - rb.s0) / ROW_STEP;
  if (f < 0 || f > rb.rows - 1 || u < 0) return null;
  const r = Math.min(rb.rows - 2, Math.floor(f)), fs = f - r;
  const k = rb.scale[r] ?? 1;
  if (u > colU(cols - 1, k)) return null;
  let c = 0;
  while (c < cols - 2 && u > colU(c + 1, k)) c++;
  const u0 = colU(c, k), u1 = colU(c + 1, k);
  const fu = Math.min(1, Math.max(0, (u - u0) / Math.max(1e-6, u1 - u0)));
  const H = (rr: number, cc: number): number => rb.h[rr * cols + cc] ?? 0;
  const h00 = H(r, c), h01 = H(r, c + 1), h10 = H(r + 1, c), h11 = H(r + 1, c + 1);
  if (rb.side > 0) {
    return fu + fs <= 1 ? h00 + (h01 - h00) * fu + (h10 - h00) * fs : h11 + (h10 - h11) * (1 - fu) + (h01 - h11) * (1 - fs);
  }
  return fs <= fu ? h01 + (h00 - h01) * (1 - fu) + (h11 - h01) * fs : h10 + (h11 - h10) * fu + (h00 - h10) * (1 - fs);
}
