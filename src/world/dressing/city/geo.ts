// Geometry helpers for the city's civil structures: quads turned toward a facing direction (with
// or without uvs), textured wall ribbons along the road, runs of track where a test holds, and
// single-mesh textured toon skins.
import { Color, Mesh, MeshToonMaterial, Vector3, type Texture } from 'three';
import { toonRamp } from '../../../render/toon';
import type { WorldCtx } from '../../ctx';
import { rowsBetween, type MeshBuf } from '../../geom';
import { REFLECT_LAYER } from './batch';

const N = new Vector3(), E = new Vector3();

/** One textured toon mesh from a buffer (a single draw call); also drawn in the wet-road mirror, where it hides what stands behind it. */
export function texMesh(ctx: WorldCtx, name: string, buf: MeshBuf, map: Texture): void {
  if (!buf.idx.length) return;
  const mat = ctx.own(new MeshToonMaterial({ map, vertexColors: true, gradientMap: toonRamp() }));
  const mesh = new Mesh(ctx.own(buf.build()), mat);
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.layers.enable(REFLECT_LAYER);
  ctx.group.add(mesh);
}

/** Quad a-b-c-d with its normal turned toward `facing`. */
export function quadToward(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color, facing: Vector3): void {
  N.subVectors(b, a).cross(E.subVectors(c, a)).normalize();
  const flip = N.dot(facing) < 0;
  if (flip) N.negate();
  const i = buf.vert(a, N, col), j = buf.vert(b, N, col), k = buf.vert(c, N, col), l = buf.vert(d, N, col);
  if (flip) buf.quad(i, l, k, j); else buf.quad(i, j, k, l);
}

/** [s0, s1] runs (2 m resolution) where `test(s)` holds. */
export function runsWhere(ctx: WorldCtx, test: (s: number) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const { L } = ctx;
  let start: number | null = null;
  for (let s = Math.max(0, L.sMin); s <= L.sMin + L.n - 1; s += 2) {
    const ok = test(s);
    if (ok && start === null) start = s;
    if (!ok && start !== null) { out.push([start, s - 2]); start = null; }
  }
  if (start !== null) out.push([start, L.sMin + L.n - 1]);
  return out;
}

/** True when s lies within (pad m of) a feature of the kind. */
export function inFeature(ctx: WorldCtx, kind: string, s: number, pad = 0): boolean {
  return ctx.L.features.some((f) => f.kind === kind && s >= f.s0 - pad && s <= f.s1 + pad);
}

const WHITE = new Color(1, 1, 1);

/** Quad with uvs (a, b, c, d in order) facing `facing`. */
export function quadUV(buf: MeshBuf, p: Vector3[], uv: Array<[number, number]>, facing: Vector3, col = WHITE): void {
  const [a, b, c] = p as [Vector3, Vector3, Vector3, Vector3];
  N.subVectors(b, a).cross(E.subVectors(c, a)).normalize();
  const flip = N.dot(facing) < 0;
  if (flip) N.negate();
  const ids = p.map((v, i) => buf.vert(v, N, col, uv[i]?.[0] ?? 0, uv[i]?.[1] ?? 0));
  const [i, j, k, l] = ids as [number, number, number, number];
  if (flip) buf.quad(i, l, k, j); else buf.quad(i, j, k, l);
}

/**
 * Textured wall ribbon on `side` at x = ±(bound + inset) from y0(s) to y1(s) above the road, uv in
 * metres / `scale` (v from absolute height so panel joints stay level).
 */
export function wallRibbon(ctx: WorldCtx, buf: MeshBuf, s0: number, s1: number, side: -1 | 1, xAt: (s: number) => number, y0: (s: number) => number, y1: (s: number) => number, scale: number): void {
  const { q } = ctx;
  const fr = q.frameVis(s0);
  const rows = rowsBetween(s0, s1, 2);
  for (let r = 0; r < rows.length - 1; r++) {
    const sa = rows[r] ?? 0, sb = rows[r + 1] ?? 0;
    q.frameVis(sa, fr);
    const facing = new Vector3(-fr.right.x * side, 0, -fr.right.z * side);
    const ya = q.frameVis(sa).pos.y, yb = q.frameVis(sb).pos.y;
    const xa = xAt(sa), xb = xAt(sb);
    const pts = [q.toWorld(sa, xa, y0(sa), new Vector3()), q.toWorld(sb, xb, y0(sb), new Vector3()), q.toWorld(sb, xb, y1(sb), new Vector3()), q.toWorld(sa, xa, y1(sa), new Vector3())];
    const uv: Array<[number, number]> = [[sa / scale, (ya + y0(sa)) / scale], [sb / scale, (yb + y0(sb)) / scale], [sb / scale, (yb + y1(sb)) / scale], [sa / scale, (ya + y1(sa)) / scale]];
    quadUV(buf, pts, uv, facing);
  }
}
