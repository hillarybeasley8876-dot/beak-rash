// Hill villages on the land side: a bell tower and a cluster of houses on the flattest inland
// ground near each site, seen across the farmland from the road.
import type { Dress } from '../dress';
import { bellTower, farHouse } from '../../scenery/props/village';

/** Height range of the ground on a ring of radius r around (x, z). */
function ringRange(d: Dress, x: number, z: number, r: number): number {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const y = d.ctx.groundWorld(x + Math.cos(a) * r, z + Math.sin(a) * r);
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return hi - lo;
}

/** Flattest dry spot at s on `side`, 150–400 m inland, or null. */
function siteNear(d: Dress, s: number, side: -1 | 1): { x: number; z: number; y: number; yaw: number } | null {
  let best: { x: number; z: number; y: number; yaw: number } | null = null, bestRange = 9;
  for (const ds of [-60, 0, 60]) {
    for (const u of [150, 200, 260, 320, 390]) {
      const sp = d.place.spot(s + ds, side, u);
      const y = d.ctx.groundWorld(sp.pos.x, sp.pos.z);
      if (y < 6 || y > 95) continue;
      const range = ringRange(d, sp.pos.x, sp.pos.z, 30);
      if (range < bestRange) { bestRange = range; best = { x: sp.pos.x, z: sp.pos.z, y, yaw: sp.faceRoad }; }
    }
  }
  return best;
}

export function hillVillages(d: Dress, sites: number[], side: -1 | 1 = 1): void {
  const { place, rng, b, ctx } = d;
  const placed: string[] = [];
  for (const s of sites) {
    const c = siteNear(d, s, side);
    if (!c || !place.free(c.x, c.z, 4, 40)) continue;
    bellTower(b.far.at(c.x, c.z), c.x, c.y, c.z, c.yaw, 3);
    let houses = 0;
    for (let tries = 0; tries < 40 && houses < 13; tries++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(9, 38);
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const ys = [[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([dx, dz]) => ctx.groundWorld(x + (dx ?? 0), z + (dz ?? 0)));
      const lo = Math.min(...ys), hi = Math.max(...ys);
      if (hi - lo > 3.5 || lo < 4 || !place.free(x, z, 5, 8)) continue;
      // Streets roughly follow the site's grid, each house turned a little.
      const yaw = c.yaw + rng.int(0, 3) * (Math.PI / 2) + rng.range(-0.15, 0.15);
      farHouse(b.far.at(x, z), x, hi - 0.2, z, yaw, rng, hi - lo + 1.2);
      houses++;
    }
    placed.push(`${s}:${houses}`);
  }
  d.ctx.log(`hill villages: ${placed.join(' ')}`);
}
