// Road surface: asphalt strip (markings in the texture; per-track base colour, two-tone tint and worn
// racing line from road/detail.ts), shoulders coloured by surface, and the red/white curbs on curves.
// Rows every 1 m so edges match bounds()/surfaceAt(). The road marks (road/marks.ts) follow in their own task.
import { BufferAttribute, Color, Mesh, MeshToonMaterial, Vector3 } from 'three';
import { toonRamp } from '../../render/toon';
import type { TrackFrame } from '../../core/types';
import type { WorldCtx } from '../ctx';
import { GridGeo, MeshBuf, frameOffset } from '../geom';
import { CURB_BLOCK, CURB_W } from '../layout/query';
import { SURFACES, type SideSamples } from '../layout/sides';
import { roadLookFor } from '../looks';
import { roadDetail } from './detail';
import { racingLine } from './line';
import { ROAD_PERIOD, asphaltTexture, grainTexture } from './textures';

const SHOULDER_COLORS: Record<string, string> = {
  road: '#73767d', curb: '#73767d', grass: '#7dbb52', sand: '#f1dfab', dirt: '#b98d5a', water: '#4fb6c9', wall: '#8a8a8a',
};
const CURB_H = 0.03;

/** Visual s range of the road (run-up before the start, run-off after the finish). */
function roadRange(ctx: WorldCtx): { s0: number; s1: number } {
  return { s0: ctx.L.sMin, s1: ctx.L.sMin + ctx.L.n - 1 };
}

/** Build the road; returns the racing line (x per layout sample) for the road marks. */
export function buildRoad(ctx: WorldCtx): Float32Array {
  const { q, L, app } = ctx;
  const { s0, s1 } = roadRange(ctx);
  const rows = Math.round(s1 - s0) + 1;
  const hw = L.halfWidth;
  const fr = q.frameVis(0);
  // ---- asphalt (vertex colours: large-scale tone drift so the 12 m texture period never reads)
  const look = roadLookFor(ctx.id);
  const asphalt = new GridGeo(rows, 2);
  const tone = new Color();
  const line = racingLine(L);
  const aLine = new Float32Array(rows * 2);
  for (let r = 0; r < rows; r++) {
    const s = s0 + r;
    q.frameVis(s, fr);
    const v = s / ROAD_PERIOD;
    asphalt.set(r, 0, frameOffset(fr, -hw, 0), fr.up, 0, v);
    asphalt.set(r, 1, frameOffset(fr, hw, 0), fr.up, 1, v);
    const base = 0.97 + 0.04 * Math.sin(s * 0.071 + 1.3) + 0.025 * Math.sin(s * 0.173 + 0.4) + 0.015 * Math.sin(s * 0.41 + 2.1);
    const skew = 0.02 * Math.sin(s * 0.047 + 0.7);
    asphalt.color(r, 0, tone.setScalar(base - skew));
    asphalt.color(r, 1, tone.setScalar(base + skew));
    aLine[r * 2] = aLine[r * 2 + 1] = line[q.sampleAt(s)] ?? 0;
  }
  const asphaltTex = ctx.own(asphaltTexture(app.renderer, hw, look.base));
  const roadMat = ctx.own(new MeshToonMaterial({ map: asphaltTex, gradientMap: toonRamp(), vertexColors: true }));
  ctx.own(roadDetail(roadMat, look, hw, ROAD_PERIOD));
  const roadGeo = ctx.own(asphalt.build({ colors: true }));
  roadGeo.setAttribute('aLine', new BufferAttribute(aLine, 1));
  const road = new Mesh(roadGeo, roadMat);
  road.name = 'road';
  road.receiveShadow = true;
  ctx.group.add(road);
  // ---- shoulders (both sides in one mesh)
  const grain = ctx.shared('tex:grain', () => grainTexture(app.renderer));
  const shoulderMat = ctx.own(new MeshToonMaterial({ map: grain, vertexColors: true, gradientMap: toonRamp() }));
  for (const side of [-1, 1] as const) {
    const sd = side < 0 ? L.sides.left : L.sides.right;
    const g = new GridGeo(rows, 2);
    const c = new Color();
    for (let r = 0; r < rows; r++) {
      const s = s0 + r;
      q.frameVis(s, fr);
      const i = q.sampleAt(s);
      const w = sd.shoulder[i] ?? 0;
      const a = side * hw, b = side * (hw + w);
      const inner = side < 0 ? b : a, outer = side < 0 ? a : b;
      g.set(r, 0, frameOffset(fr, inner, 0), fr.up, inner / 4, s / 4);
      g.set(r, 1, frameOffset(fr, outer, 0), fr.up, outer / 4, s / 4);
      c.set(shoulderColor(sd, i));
      g.color(r, 0, c);
      g.color(r, 1, c);
    }
    const mesh = new Mesh(ctx.own(g.build({ colors: true })), shoulderMat);
    mesh.name = `shoulder${side < 0 ? 'L' : 'R'}`;
    mesh.receiveShadow = true;
    ctx.group.add(mesh);
  }
  buildCurbs(ctx, fr);
  return line;
}

function shoulderColor(sd: SideSamples, i: number): string {
  return SHOULDER_COLORS[SURFACES[sd.surface[i] ?? 0] ?? 'road'] ?? '#777777';
}

/** Raised bevelled curb blocks (1.5 m, alternating red/white) wherever the query flags curbs. */
function buildCurbs(ctx: WorldCtx, fr: TrackFrame): void {
  const { q, L } = ctx;
  const hw = L.halfWidth;
  const BLOCK = CURB_BLOCK;
  const red = new Color('#e5191c'), white = new Color('#f6f4ef');
  const profile: Array<[number, number]> = [[0, 0], [0.1, CURB_H], [CURB_W - 0.1, CURB_H], [CURB_W, 0]];
  const quads: Array<{ side: -1 | 1; s: number; color: Color }> = [];
  for (const side of [-1, 1] as const) {
    for (let s = Math.ceil(L.sMin / BLOCK) * BLOCK; s + BLOCK <= L.sMin + L.n - 1; s += BLOCK) {
      if (!q.curbAt(s + BLOCK / 2, side)) continue;
      quads.push({ side, s, color: Math.round(s / BLOCK) % 2 === 0 ? red : white });
    }
  }
  if (!quads.length) return;
  // Each block owns its vertices so the colours stay crisp: 2 rows × 4 profile points, 3 quads.
  const buf = new MeshBuf();
  const p = new Vector3(), n = new Vector3();
  for (const qd of quads) {
    const base = buf.count;
    for (let r = 0; r < 2; r++) {
      q.frameVis(qd.s + r * BLOCK, fr);
      for (let c = 0; c < 4; c++) {
        const [dx, y] = profile[c] as [number, number];
        frameOffset(fr, qd.side * (hw + dx), y, p);
        // Bevel normals lean outward/inward; the top faces straight up.
        const lean = c === 0 ? -0.6 : c === 3 ? 0.6 : 0;
        n.set(fr.up.x + fr.right.x * lean * qd.side, fr.up.y + fr.right.y * lean * qd.side, fr.up.z + fr.right.z * lean * qd.side).normalize();
        buf.vert(p, n, qd.color);
      }
    }
    for (let c = 0; c < 3; c++) {
      const a = base + c, b = base + c + 1, d = base + 4 + c, e = base + 4 + c + 1;
      // Columns run outward; on the left side outward is −x, so flip the winding there.
      if (qd.side > 0) buf.quad(a, b, e, d); else buf.quad(a, d, e, b);
    }
  }
  const geo = buf.build();
  const mat = ctx.own(new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
  const mesh = new Mesh(ctx.own(geo), mat);
  mesh.name = 'curbs';
  mesh.receiveShadow = true;
  ctx.group.add(mesh);
}
