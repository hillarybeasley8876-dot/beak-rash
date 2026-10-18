// Underpass and tunnel fit-out: concrete panel skin on the cutting's retaining walls (hazard-striped
// kerb, coping, railing at street level, wall lights, P5 posters) and inside the tunnel glazed tiles,
// LED strips that streak in the wet road, jet fans, exit signs and light pools under the vault lamps.
import { Color, Matrix4, Mesh, MeshToonMaterial, Vector3, type Texture } from 'three';
import { toonRamp } from '../../../render/toon';
import type { WorldCtx } from '../../ctx';
import { MeshBuf } from '../../geom';
import { cylinder, trs, box } from '../../kit/shapes';
import { STREET } from '../../layouts/city';
import type { City } from './city';
import { quadToward, runsWhere, wallRibbon } from './geo';
import { sign } from './neon';
import { p5Face } from './neon-faces';
import type { Pools } from './paint';
import { hdr, segment } from './util';
import { CONCRETE_M, TILE_M, concreteTexture, tileTexture } from './wall-tex';

const COL = { yellow: new Color('#ffd21f'), black: new Color('#1c1c22'), coping: new Color('#a9a7b6'), rail: new Color('#2a2c36'), fan: new Color('#8b93a3'), fanIn: new Color('#2a2c36') };
const POSTERS = ['SHOWTIME!', '暴力鹈鹕', 'ONE MORE!', '今日宜：撞人'];
const m = new Matrix4();
const A = new Vector3(), B = new Vector3(), C = new Vector3(), D = new Vector3();

/** One textured toon mesh from a buffer (a single draw call). */
function texMesh(ctx: WorldCtx, name: string, buf: MeshBuf, map: Texture): void {
  if (!buf.idx.length) return;
  const mat = ctx.own(new MeshToonMaterial({ map, vertexColors: true, gradientMap: toonRamp() }));
  const mesh = new Mesh(ctx.own(buf.build()), mat);
  mesh.name = name;
  mesh.receiveShadow = true;
  ctx.group.add(mesh);
}

/** Concrete skin, kerb, coping, railing, lights and posters on every retaining-wall run. */
export function retainingWalls(c: City): void {
  const { ctx, field, b } = c.d;
  const { q } = ctx;
  const buf = new MeshBuf();
  const rng = c.d.rng.fork(0x3e7a);
  const top = (s: number): number => STREET + 0.05 - q.frameVis(s).pos.y;
  let poster = 0;
  for (const side of [-1, 1] as const) {
    const xAt = (s: number): number => side * (field.bound(s, side) + 0.035);
    for (const [s0, s1] of runsWhere(ctx, (s) => q.edgeKindAt(s, side) === 'rock' && top(s) > 0.5)) {
      wallRibbon(ctx, buf, s0, s1 + 2, side, xAt, () => 0, top, CONCRETE_M);
      const fr = q.frameVis(s0);
      for (let s = s0; s < s1 + 1; s += 1) {
        q.frameVis(s, fr);
        const facing = new Vector3(-fr.right.x * side, 0, -fr.right.z * side);
        const x = xAt(s) - side * 0.01, x2 = xAt(s + 1) - side * 0.01;
        q.toWorld(s, x, 0, A); q.toWorld(s + 1, x2, 0, B); q.toWorld(s + 1, x2, 0.32, C); q.toWorld(s, x, 0.32, D);
        quadToward(b.props.at(A.x, A.z), A, B, C, D, Math.floor(s) % 2 ? COL.yellow : COL.black, facing);
        const t = top(s), t2 = top(s + 1);
        q.toWorld(s, x, t, A); q.toWorld(s + 1, x2, t2, B); q.toWorld(s + 1, x2 + side * 0.6, t2, C); q.toWorld(s, x + side * 0.6, t, D);
        quadToward(b.props.at(A.x, A.z), A, B, C, D, COL.coping, new Vector3(0, 1, 0));
      }
      for (let s = s0 + 1; s < s1; s += 2.5) {
        const t = top(s);
        const p = q.toWorld(s, xAt(s) + side * 0.3, t, new Vector3());
        box(b.props.at(p.x, p.z), trs(p.x, p.y + 0.55, p.z, 0, 0.07, 1.1, 0.07, m), COL.rail);
        const p2 = q.toWorld(Math.min(s + 2.5, s1), xAt(s + 2.5) + side * 0.3, top(Math.min(s + 2.5, s1)), new Vector3());
        segment(b.props.at(p.x, p.z), p.clone().setY(p.y + 1.08), p2.setY(p2.y + 1.08), 0.06, COL.rail);
        if (t > 3.4 && Math.round(s - s0) % 10 === 1) {
          const l = q.toWorld(s, xAt(s) - side * 0.07, 2.7, new Vector3());
          const ft = q.frameVis(s);
          box(b.glow.at(l.x, l.z), trs(l.x, l.y, l.z, Math.atan2(ft.tangent.x, ft.tangent.z), 0.12, 0.16, 1.0, m), hdr('#ffd9a0', 2.2));
        }
      }
      for (let s = s0 + 14; s < s1 - 6; s += rng.range(26, 40)) {
        if (top(s) < 3.6) continue;
        const text = POSTERS[poster++ % POSTERS.length] ?? '';
        // Same key as the rooftop P5 boards (neon.ts): one atlas cell per line.
        const rect = c.d.face(`roof:${text}:true`, () => p5Face(c.neonAtlas, rng.fork(poster), text));
        const p = q.toWorld(s, xAt(s) - side * 0.04, 2.1, new Vector3());
        q.frameVis(s, fr);
        const yaw = Math.atan2(fr.right.x * side, fr.right.z * side);
        if (rect) sign(c.cb.neon.at(p.x, p.z), p, yaw, 4.2, 4.2 * (160 / 512), rect, 1.2);
      }
    }
  }
  texMesh(ctx, 'city:walls', buf, ctx.own(concreteTexture(ctx.app.renderer)));
}

/** Tunnel tube geometry (mirrors features/tunnel.ts): wall height, crown and the vault profile. */
const WALL_H = 3.6, CROWN = 7.4, TOE = 0.06;
const vaultY = (x: number, halfW: number): number => WALL_H + Math.sqrt(Math.max(0, 1 - (x / halfW) ** 2)) * (CROWN - WALL_H);

/** Tiles, LED strips, jet fans, exit signs and road pools inside every tunnel feature. */
export function tunnelFitOut(c: City, pools: Pools): void {
  const { ctx, field, b } = c.d;
  const { q } = ctx;
  const tiles = new MeshBuf();
  const strips = [hdr('#22e8ff', 2.6), hdr('#ff2d95', 2.6)];
  for (const f of ctx.L.features.filter((ft) => ft.kind === 'tunnel')) {
    const mid = (f.s0 + f.s1) / 2;
    const halfW = Math.max(field.bound(mid, -1), field.bound(mid, 1)) + TOE;
    for (const side of [-1, 1] as const) {
      const xw = side * (halfW - 0.02);
      wallRibbon(ctx, tiles, f.s0 + 0.5, f.s1 - 0.5, side, () => xw, () => 1.3, () => WALL_H - 0.05, TILE_M);
      const col = strips[side < 0 ? 0 : 1] as Color;
      const fr = q.frameVis(f.s0);
      for (let s = f.s0 + 0.5; s < f.s1 - 1; s += 2) {
        q.frameVis(s, fr);
        const facing = new Vector3(-fr.right.x * side, 0, -fr.right.z * side);
        const x = side * (halfW - 0.05);
        for (const [y0, y1, cc] of [[2.0, 2.12, col], [WALL_H - 0.12, WALL_H - 0.04, hdr('#cfe4ff', 2.0)]] as Array<[number, number, Color]>) {
          q.toWorld(s, x, y0, A); q.toWorld(s + 2, x, y0, B); q.toWorld(s + 2, x, y1, C); q.toWorld(s, x, y1, D);
          quadToward(b.glow.at(A.x, A.z), A, B, C, D, cc, facing);
        }
      }
    }
    for (let s = f.s0 + 22; s < f.s1 - 15; s += 46) jetFans(c, s, halfW);
    for (let s = f.s0 + 30, k = 0; s < f.s1 - 10; s += 50, k++) {
      const side: -1 | 1 = k % 2 ? 1 : -1;
      const p = q.toWorld(s, side * (halfW - 0.08), 2.8, new Vector3());
      const fr = q.frameVis(s);
      box(b.glow.at(p.x, p.z), trs(p.x, p.y, p.z, Math.atan2(fr.tangent.x, fr.tangent.z), 0.1, 0.36, 0.9, m), hdr('#2bff88', 2.0));
    }
    // Pools under the vault light strips (features/tunnel.ts puts them every 9 m at x = ±2.2).
    for (let s = f.s0 + 5; s < f.s1 - 3; s += 9) for (const x of [-2.2, 2.2]) pools.add(s + 1.2, x, 3.6, new Color(0.9, 0.8, 0.6));
  }
  texMesh(ctx, 'city:tiles', tiles, ctx.own(tileTexture(ctx.app.renderer)));
}

/** A pair of jet fans hanging from the vault at s. */
function jetFans(c: City, s: number, halfW: number): void {
  const { ctx, b } = c.d;
  const fr = ctx.q.frameVis(s);
  const ry = Math.atan2(fr.tangent.x, fr.tangent.z);
  const rot = new Matrix4().makeRotationX(Math.PI / 2);
  for (const x of [-2.8, 2.8]) {
    const y = vaultY(x, halfW) - 1.05;
    const p = ctx.q.toWorld(s, x, y, new Vector3());
    const buf = b.props.at(p.x, p.z);
    cylinder(buf, trs(p.x, p.y, p.z, ry, 1, 1, 1, m).multiply(rot).multiply(new Matrix4().makeTranslation(0, -1.6, 0)).multiply(new Matrix4().makeScale(0.55, 3.2, 0.55)), COL.fan, 12, 1, 1, true, COL.fanIn);
    for (const dz of [-0.9, 0.9]) {
      const q2 = ctx.q.toWorld(s + dz, x, y + 0.75, new Vector3());
      box(buf, trs(q2.x, q2.y, q2.z, ry, 0.1, 0.5, 0.1, m), COL.rail);
    }
  }
}
