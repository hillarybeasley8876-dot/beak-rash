// Tunnel through the headland: arched tube (red P5 dado band, cream tiles, sooty vault, light
// strips), portal headwalls with a red-ringed concrete arch, and the hill cap that closes the top.
// The tube is unlit with baked lamp lighting (same darkness at every quality, no shadow acne);
// per-track fit-outs (dressing/*) add fixtures on top of this shared shell.
import { Color, Vector3 } from 'three';
import type { TrackFeature } from '../../core/types';
import type { WorldCtx } from '../ctx';
import { frameOffset, rowsBetween, type MeshBuf } from '../geom';
import type { PropBatch } from '../kit/batch';
import type { TerrainField } from '../terrain/field';
import { WALL_TOE } from '../terrain/profile';
import { buildTunnelCap } from './tunnelCap';

export const WALL_H = 3.6;
export const CROWN = 7.4;
/** The hill cap spans the tube plus this much on each side (m). */
const CAP_MARGIN = 3.5;
const COL = {
  dado: new Color('#c8102e'), line: new Color('#f4f2ec'), tile: new Color('#e9dfc8'), vault: new Color('#575862'),
  concrete: new Color('#cfccc4'), ring: new Color('#e5191c'), lamp: new Color('#fff3c4'), rock: new Color('#cdbb98'),
};

/** Inner outline (x, y) from the right wall foot, over the crown, to the left wall foot. */
function tunnelOutline(halfW: number, n = 14): Array<[number, number]> {
  const pts: Array<[number, number]> = [[halfW, 0], [halfW, 1.15], [halfW, 1.25], [halfW, WALL_H]];
  for (let i = 1; i < n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([Math.cos(a) * halfW, WALL_H + Math.sin(a) * (CROWN - WALL_H)]);
  }
  pts.push([-halfW, WALL_H], [-halfW, 1.25], [-halfW, 1.15], [-halfW, 0]);
  return pts;
}

function colorFor(y: number, x: number, halfW: number): Color {
  if (Math.abs(x) >= halfW - 0.01 && y <= 1.15) return COL.dado;
  if (Math.abs(x) >= halfW - 0.01 && y <= 1.25) return COL.line;
  return y <= WALL_H + 0.01 ? COL.tile : COL.vault;
}

/** Light strips start every LAMP_EVERY m from s0 + 5 (2.4 m long, x = ±2.2): fit-outs align to them. */
export const LAMP_EVERY = 9;
const shaded = new Color();

/** Baked interior light: dim overall, brighter rows under each light strip, 4 m tile panels. */
function bake(base: Color, s: number, f: TrackFeature, night: boolean): Color {
  const k = (s - f.s0 - 5) / LAMP_EVERY;
  const under = k - Math.floor(k) < 2.6 / LAMP_EVERY && s < f.s1 - 3;
  const panel = Math.floor((s - f.s0) / 4) % 2 === 0 ? 1 : 0.93;
  return shaded.copy(base).multiplyScalar((night ? 0.55 : 0.66) * (under ? 1.22 : 1) * panel);
}

const A = new Vector3(), B = new Vector3(), C = new Vector3(), D = new Vector3(), N = new Vector3(), E = new Vector3();
const DOWN = new Vector3(0, -1, 0);

function quad(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color, facing: Vector3): void {
  N.subVectors(b, a).cross(E.subVectors(c, a)).normalize();
  const flip = N.dot(facing) < 0;
  if (flip) N.negate();
  const i = buf.vert(a, N, col), j = buf.vert(b, N, col), k = buf.vert(c, N, col), l = buf.vert(d, N, col);
  if (flip) buf.quad(i, l, k, j); else buf.quad(i, j, k, l);
}

/** Inner half-width of the tube: walls a toe beyond the drivable bound (riders scrape, never sink in). */
export function tunnelHalfW(field: TerrainField, f: TrackFeature): number {
  const mid = (f.s0 + f.s1) / 2;
  return Math.max(field.bound(mid, -1), field.bound(mid, 1)) + WALL_TOE;
}

/** Vault height above the road at lateral x (|x| ≤ halfW). */
export const vaultY = (x: number, halfW: number): number => WALL_H + Math.sqrt(Math.max(0, 1 - (x / halfW) ** 2)) * (CROWN - WALL_H);

/** Height of the hill cap over tunnel f at (s, x), |x| ≤ capHalfW(); for props on the headland. */
export function capHeight(ctx: WorldCtx, field: TerrainField, f: TrackFeature, s: number, x: number): number {
  return capY(ctx, field, f, s, x, tunnelHalfW(field, f) + CAP_MARGIN);
}
export const capHalfW = (field: TerrainField, f: TrackFeature): number => tunnelHalfW(field, f) + CAP_MARGIN;

export function buildTunnel(ctx: WorldCtx, structure: PropBatch, tube: PropBatch, lamps: PropBatch, field: TerrainField, f: TrackFeature): void {
  const halfW = tunnelHalfW(field, f);
  const outline = tunnelOutline(halfW);
  const fr = ctx.q.frameVis(f.s0);
  const centre = new Vector3();
  const rows = rowsBetween(f.s0, f.s1, 2);
  for (let r = 0; r < rows.length - 1; r++) {
    const sa = rows[r] ?? 0, sb = rows[r + 1] ?? 0;
    ctx.q.frameVis((sa + sb) / 2, fr);
    frameOffset(fr, 0, 3, centre);
    const buf = tube.at(centre.x, centre.z);
    for (let k = 0; k < outline.length - 1; k++) {
      const [x0, y0] = outline[k] as [number, number];
      const [x1, y1] = outline[k + 1] as [number, number];
      ctx.q.toWorld(sa, x0, y0, A); ctx.q.toWorld(sa, x1, y1, B);
      ctx.q.toWorld(sb, x1, y1, C); ctx.q.toWorld(sb, x0, y0, D);
      // Faces point into the tube.
      const facing = E.copy(centre).sub(A);
      quad(buf, A, B, C, D, bake(colorFor((y0 + y1) / 2, (x0 + x1) / 2, halfW), sa, f, ctx.look.grade.night), facing.clone());
    }
  }
  // Light strips on the vault every LAMP_EVERY m (unlit, glowing).
  for (let s = f.s0 + 5; s < f.s1 - 3; s += LAMP_EVERY) {
    for (const x of [-2.2, 2.2]) {
      const y = vaultY(x, halfW) - 0.06;
      ctx.q.toWorld(s, x - 0.18, y, A); ctx.q.toWorld(s, x + 0.18, y, B);
      ctx.q.toWorld(s + 2.4, x + 0.18, y, C); ctx.q.toWorld(s + 2.4, x - 0.18, y, D);
      quad(lamps.at(A.x, A.z), A, B, C, D, COL.lamp, DOWN);
    }
  }
  for (const [s, dir] of [[f.s0, -1], [f.s1, 1]] as Array<[number, number]>) buildPortal(ctx, structure, field, s, dir, outline, halfW, f);
  buildTunnelCap(ctx, field, f, halfW + CAP_MARGIN, (s, x, W) => capY(ctx, field, f, s, x, W));
}

/** Hill-cap height over the tunnel at (s, x): a hump between the terrain on both sides. */
function capY(ctx: WorldCtx, field: TerrainField, f: TrackFeature, s: number, x: number, W: number): number {
  const fr = ctx.q.frameVis(s);
  const roof = ctx.L.roof[ctx.q.sampleAt((f.s0 + f.s1) / 2)] ?? 12;
  const side = (sd: -1 | 1): number => {
    const g = field.ground(s, sd), b = field.bound(s, sd);
    const p = frameOffset(fr, sd * (b + 3), 0);
    return field.shape(g, field.edgeY(s, sd), fr.pos.y, 3, p.x, p.z).h;
  };
  const t = (x + W) / (2 * W);
  const base = side(-1) + (side(1) - side(-1)) * t;
  const crown = fr.pos.y + roof;
  const hump = 1 - (2 * t - 1) ** 2;
  return base + Math.max(0, crown - base) * hump + field.noise.get(x / 9 + s / 31, s / 17) * 1.2 * hump;
}

/** Resample a polyline to n points evenly by arc length. */
function resample(pts: Array<[number, number]>, n: number): Array<[number, number]> {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1] as [number, number], [bx, by] = pts[i] as [number, number];
    acc.push((acc[i - 1] ?? 0) + Math.hypot(bx - ax, by - ay));
  }
  const total = acc[acc.length - 1] ?? 1;
  const out: Array<[number, number]> = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1);
    while (j < pts.length - 2 && (acc[j + 1] ?? 0) < d) j++;
    const t = (d - (acc[j] ?? 0)) / Math.max(1e-6, (acc[j + 1] ?? 0) - (acc[j] ?? 0));
    const [ax, ay] = pts[j] as [number, number], [bx, by] = pts[j + 1] as [number, number];
    out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
  }
  return out;
}

function buildPortal(ctx: WorldCtx, batch: PropBatch, field: TerrainField, s: number, dir: number, outline: Array<[number, number]>, halfW: number,
  f: TrackFeature): void {
  // Just wide enough to close the gap to the cutting's rock faces (which start at the bound).
  const W = halfW + 1.6, K = 44;
  const fr = ctx.q.frameVis(s);
  const roadY = fr.pos.y;
  const outer: Array<[number, number]> = [[W, 0]];
  for (let i = 0; i <= 12; i++) {
    const x = W - (2 * W * i) / 12;
    outer.push([x, capY(ctx, field, f, s, x, W) + 0.6 - roadY]);
  }
  outer.push([-W, 0]);
  const inner = resample(outline, K);
  const ring = inner.map(([x, y]): [number, number] => {
    const dx = x, dy = y - 2.6, l = Math.hypot(dx, dy) || 1;
    return [x + (dx / l) * 0.8, Math.max(0, y + (dy / l) * 0.8)];
  });
  const out = resample(outer, K);
  const facing = new Vector3(fr.tangent.x * dir, 0, fr.tangent.z * dir);
  const buf = batch.at(fr.pos.x, fr.pos.z);
  for (let k = 0; k < K - 1; k++) {
    const band = (a: Array<[number, number]>, b: Array<[number, number]>, col: Color, push: number): void => {
      const [ax, ay] = a[k] as [number, number], [bx, by] = a[k + 1] as [number, number];
      const [cx, cy] = b[k + 1] as [number, number], [dx, dy] = b[k] as [number, number];
      ctx.q.toWorld(s + dir * push, ax, ay, A); ctx.q.toWorld(s + dir * push, bx, by, B);
      ctx.q.toWorld(s + dir * push, cx, cy, C); ctx.q.toWorld(s + dir * push, dx, dy, D);
      quad(buf, A, B, C, D, col, facing);
    };
    const yMid = ((out[k]?.[1] ?? 0) + (out[k + 1]?.[1] ?? 0)) / 2;
    band(inner, ring, COL.ring, 0.25);
    band(ring, out, yMid > CROWN + 3 ? COL.rock : COL.concrete, 0);
  }
}
