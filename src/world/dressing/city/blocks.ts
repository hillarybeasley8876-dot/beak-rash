// Street walls: continuous rows of shop-houses along every street (front row), towers behind them,
// sparse tall skyline blocks further out. Per-zone settings shape each district (low dense arcade,
// Shibuya-style towers round the scramble, a billboard canyon on the sprint).
import type { Rng } from '../../../core/rng';
import { STREET } from '../../layouts/city';
import { shophouse, skylineBlock, tower } from '../../scenery/props/city-building';
import type { City } from './city';

interface WallDef {
  front: [number, number];    // facade distance beyond the drivable edge (m)
  tall: number;               // chance a front lot is a tower
  floors: [number, number];   // shop-house upper floors
  widths: [number, number];   // lot width along the street (m)
  back: number;               // chance of a tower behind each front lot
}

const W = (o: Partial<WallDef>): WallDef => ({ front: [3, 4.5], tall: 0.2, floors: [2, 6], widths: [8, 16], back: 0.7, ...o });
const WALLS: Record<string, WallDef> = {
  start: W({ front: [6, 8], tall: 0.6, widths: [14, 22], back: 0.9 }),
  boulevard: W({ tall: 0.25 }),
  corner: W({ tall: 0.3, widths: [7, 12] }),
  street: W({ front: [2.6, 3.4], tall: 0.08, floors: [2, 5], widths: [7, 12] }),
  scramble: W({ front: [7, 10], tall: 0.85, widths: [16, 26], back: 0.9 }),
  arcade: W({ front: [1.6, 2.2], tall: 0, floors: [2, 4], widths: [6, 10], back: 0.8 }),
  chicane: W({ front: [2.5, 4], tall: 0.15, widths: [7, 12] }),
  ramp: W({ front: [4, 9], tall: 0.4, floors: [3, 7], widths: [10, 18] }),
  expressway: W({ front: [5, 10], tall: 0.5, floors: [4, 8], widths: [12, 20] }),
  crest: W({ front: [5, 10], tall: 0.5, floors: [4, 8], widths: [12, 20] }),
  drop: W({ front: [4, 8], tall: 0.3, floors: [3, 6], widths: [10, 16] }),
  riverside: W({ front: [3, 5], tall: 0.45, floors: [3, 7], widths: [10, 18] }),
  underpass: W({ front: [2.5, 4], tall: 0.3, floors: [3, 6], widths: [10, 16] }),
  tunnel: W({ front: [3, 6], tall: 0.4, floors: [3, 6], widths: [12, 20] }),
  avenue: W({ tall: 0.35, widths: [9, 16] }),
  hairpin: W({ front: [3, 5], tall: 0.6, widths: [12, 20] }),
  sprint: W({ front: [3, 5], tall: 0.75, floors: [5, 9], widths: [14, 22], back: 0.9 }),
  finish: W({ front: [6, 8], tall: 0.6, widths: [14, 22], back: 0.9 }),
};

/** Ground beyond this side is the river (no buildings). */
function isRiver(c: City, s: number, side: -1 | 1): boolean {
  const g = c.d.field.ground(s, side);
  return g.abs && g.step < STREET - 2;
}

/** One lot: front building at u beyond the edge, maybe a tower behind it. */
function lot(c: City, def: WallDef, s: number, side: -1 | 1, rng: Rng): void {
  const { place } = c.d;
  const w = rng.range(def.widths[0], def.widths[1]);
  const u = rng.range(def.front[0], def.front[1]);
  const sp = place.spot(s, side, u);
  if (Math.abs(sp.pos.y - STREET) > 0.6) return;
  const isTower = rng.chance(def.tall);
  const d = isTower ? rng.range(14, 22) : rng.range(9, 15);
  const yaw = sp.faceRoad;
  if (!c.lots.fits(sp.pos.x, sp.pos.z, yaw, w, d)) return;
  c.lots.claim(sp.pos.x, sp.pos.z, yaw, w, d);
  const bufs = { body: c.cb.body.at(sp.pos.x, sp.pos.z), lights: c.cb.lights.at(sp.pos.x, sp.pos.z) };
  const slots = isTower
    ? tower(bufs, sp.pos.x, STREET, sp.pos.z, yaw, w, d, rng.int(10, 30), rng)
    : shophouse(bufs, sp.pos.x, STREET, sp.pos.z, yaw, w, d, rng.int(def.floors[0], def.floors[1]), rng);
  c.slots.push(...slots);
  if (!rng.chance(def.back)) return;
  const bu = u + d + rng.range(3, 7), bw = rng.range(14, 24), bd = rng.range(14, 24);
  const bp = place.spot(s, side, bu);
  if (Math.abs(bp.pos.y - STREET) > 0.6 || !c.lots.fits(bp.pos.x, bp.pos.z, yaw, bw, bd, 2)) return;
  c.lots.claim(bp.pos.x, bp.pos.z, yaw, bw, bd);
  const bb = { body: c.cb.body.at(bp.pos.x, bp.pos.z), lights: c.cb.lights.at(bp.pos.x, bp.pos.z) };
  c.slots.push(...tower(bb, bp.pos.x, STREET, bp.pos.z, yaw, bw, bd, rng.int(14, 40), rng).filter((sl) => sl.kind !== 'fascia'));
}

/** Front rows along every zone with a wall definition (both sides, river sides skipped); `tick` yields. */
export async function streetWalls(c: City, tick: () => Promise<void>): Promise<void> {
  const { ctx } = c.d;
  const rng = c.d.rng.fork(0xb10c);
  for (const z of ctx.L.zones) {
    const def = WALLS[z.name];
    if (!def) continue;
    for (const side of [-1, 1] as const) {
      // Inside of the hairpin is the roundabout island.
      if (z.name === 'hairpin' && side > 0) continue;
      let s = z.s0 + rng.range(0, 3);
      while (s < z.s1) {
        const k = ctx.q.frameVis(s).curvature;
        const step = rng.range(def.widths[0], def.widths[1]) * 0.55;
        if (!isRiver(c, s, side)) lot(c, def, s, side, rng);
        // Facade-line spacing: shorter steps in s on the outside of a curve, longer on the inside.
        s += step / Math.max(0.35, 1 - side * k * 12);
        await tick();
      }
    }
  }
}

/** Tall skyline blocks 45–150 m out (fill the sky above the street walls); `tick` yields. */
export async function skyline(c: City, tick: () => Promise<void>): Promise<void> {
  const { ctx, place } = c.d;
  const rng = c.d.rng.fork(0x5c71);
  const L = ctx.L;
  for (let s = L.sMin + 20; s < L.sMin + L.n - 20; s += rng.range(14, 26)) {
    for (const side of [-1, 1] as const) {
      if (isRiver(c, s, side) || !rng.chance(0.7)) continue;
      const sp = place.spot(s, side, rng.range(45, 150));
      if (Math.abs(sp.pos.y - STREET) > 0.6) continue;
      const w = rng.range(16, 30), dd = rng.range(16, 30);
      if (!c.lots.fits(sp.pos.x, sp.pos.z, sp.faceRoad, w, dd, 6)) continue;
      c.lots.claim(sp.pos.x, sp.pos.z, sp.faceRoad, w, dd);
      skylineBlock(c.cb.far.at(sp.pos.x, sp.pos.z), sp.pos.x, STREET, sp.pos.z, sp.faceRoad, w, dd, rng.range(40, 130), rng, c.cb.lights.at(sp.pos.x, sp.pos.z));
    }
    await tick();
  }
}
