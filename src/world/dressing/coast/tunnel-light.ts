// Coast tunnel lighting overlays: a multiply layer that dims the road + shoulders inside the tube with
// long warm elliptical pools under every lamp (they nearly meet, so the road reads as a lit lane with a gentle
// rhythm, not dark bands), an additive warm layer on the pool cores and a warm wash on the walls round each
// wall lamp. Lamp positions are shared with the fixtures (tunnel.ts).
import {
  AddEquation, AdditiveBlending, Color, CustomBlending, DoubleSide, Mesh, MeshBasicMaterial, SrcColorFactor, Vector3, ZeroFactor,
  type Material,
} from 'three';
import { smoothstep } from '../../../core/math';
import type { TrackFeature } from '../../../core/types';
import { LAMP_EVERY, WALL_H } from '../../features/tunnel';
import { GridGeo, MeshBuf, rowsBetween } from '../../geom';
import type { Dress } from '../dress';

const DIM = 0.58;                     // road brightness between the pools (multiply)
const WARM = new Color('#ffd9a0');
const POOL_ADD = 0.3;                 // additive warm light at a pool core
const POOL = { len: 4.6, wide: 3.4 } as const;   // pool half length (along s) / half width under the vault strips
const WASH_ADD = 0.16;                // additive wash peak on the walls
const VAULT_X = [-2.2, 2.2];
const WALL_LAMP_Y = WALL_H - 0.35;

/** Vault strip centres along s (the wall lamps sit half a spacing after each). */
export const vaultLamps = (f: TrackFeature): number[] => {
  const out: number[] = [];
  for (let s = f.s0 + 5; s < f.s1 - 3; s += LAMP_EVERY) out.push(s + 1.2);
  return out;
};

/** 1 inside a unit ellipse with a soft outer part, 0 outside (toon-style pool edge). */
const ellipse = (a: number, b: number): number => 1 - smoothstep(0.6, 1, Math.hypot(a, b));

/** Pool light on the road at (s, x), 0 … 1: ellipses under the vault strips and the wall lamps. */
function pool(s: number, x: number, lamps: number[], halfW: number): number {
  let l = 0;
  for (const sc of lamps) {
    const ds = s - sc;
    if (Math.abs(ds) > LAMP_EVERY) continue;
    for (const lx of VAULT_X) l = Math.max(l, ellipse(ds / POOL.len, (x - lx) / POOL.wide));
    const dw = ds - LAMP_EVERY / 2;
    for (const side of [-1, 1]) l = Math.max(l, 0.75 * ellipse(dw / 2.3, (x - side * (halfW - 0.5)) / 1.9));
  }
  return l;
}

function overlay(d: Dress, geo: GridGeo, mat: Material, name: string, order: number): void {
  const mesh = new Mesh(d.ctx.own(geo.build({ colors: true })), d.ctx.own(mat));
  mesh.name = name;
  mesh.renderOrder = order;
  d.ctx.group.add(mesh);
}

/** Road + shoulders: multiply dimming (ramped over the portals) and additive warm pool cores. */
function roadLight(d: Dress, f: TrackFeature, halfW: number, lamps: number[]): void {
  const { ctx } = d;
  const cols = Math.ceil((2 * halfW) / 0.5) + 1;
  const rows = rowsBetween(f.s0 - 8, f.s1 + 8, 0.5);
  const mul = new GridGeo(rows.length, cols), add = new GridGeo(rows.length, cols);
  const p = new Vector3(), c = new Color();
  const fr = ctx.q.frameVis(f.s0);
  rows.forEach((s, r) => {
    ctx.q.frameVis(s, fr);
    // Daylight spills ~16 m into both mouths (no dark band between the last pool and the portal).
    const inside = smoothstep(f.s0 - 2, f.s0 + 16, s) * (1 - smoothstep(f.s1 - 16, f.s1 + 2, s));
    for (let k = 0; k < cols; k++) {
      const x = -halfW + (2 * halfW * k) / (cols - 1);
      const l = pool(s, x, lamps, halfW);
      ctx.q.toWorld(s, x, 0.014, p);
      mul.set(r, k, p, fr.up, 0, 0);
      mul.color(r, k, c.setScalar(1 - inside * (1 - DIM) * (1 - l)));
      ctx.q.toWorld(s, x, 0.018, p);
      add.set(r, k, p, fr.up, 0, 0);
      add.color(r, k, c.copy(WARM).multiplyScalar(inside * POOL_ADD * l * l));
    }
  });
  const flat = { vertexColors: true, transparent: true, depthWrite: false, fog: false, polygonOffset: true } as const;
  overlay(d, mul, new MeshBasicMaterial({
    ...flat, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    blending: CustomBlending, blendEquation: AddEquation, blendSrc: ZeroFactor, blendDst: SrcColorFactor,
  }), 'tunnelShade', 2);
  overlay(d, add, new MeshBasicMaterial({ ...flat, polygonOffsetFactor: -4, polygonOffsetUnits: -4, blending: AdditiveBlending }), 'tunnelPools', 3);
}

/** Warm halo on the wall round each wall lamp (additive, both walls, one mesh). */
function wallWash(d: Dress, f: TrackFeature, halfW: number, lamps: number[]): void {
  const { ctx } = d;
  const ys = rowsBetween(0.15, WALL_H - 0.05, 0.35);
  const buf = new MeshBuf();
  const p = new Vector3(), c = new Color();
  for (const sc of lamps) {
    const sw = sc + LAMP_EVERY / 2;
    if (sw > f.s1 - 4) continue;
    const fr = ctx.q.frameVis(sw);
    for (const side of [-1, 1]) {
      const rows = rowsBetween(sw - 3, sw + 3, 0.5);
      const base = buf.count;
      for (const s of rows) {
        for (const y of ys) {
          ctx.q.toWorld(s, side * (halfW - 0.03), y, p);
          const e = ellipse((s - sw) / 3, (y - WALL_LAMP_Y) / 2.2);
          buf.vert(p, fr.right, c.copy(WARM).multiplyScalar(WASH_ADD * e * e));
        }
      }
      const n = ys.length;
      for (let r = 0; r < rows.length - 1; r++) {
        for (let k = 0; k < n - 1; k++) {
          const a = base + r * n + k;
          buf.quad(a, a + n, a + n + 1, a + 1);
        }
      }
    }
  }
  if (!buf.count) return;
  const mesh = new Mesh(ctx.own(buf.build()), ctx.own(new MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, fog: false, side: DoubleSide, blending: AdditiveBlending,
  })));
  mesh.name = 'tunnelWash';
  mesh.renderOrder = 3;
  ctx.group.add(mesh);
}

export function tunnelLight(d: Dress, f: TrackFeature, halfW: number): void {
  const lamps = vaultLamps(f);
  roadLight(d, f, halfW, lamps);
  wallWash(d, f, halfW, lamps);
}
