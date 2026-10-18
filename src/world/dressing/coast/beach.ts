// Beach life below a seawall (coast): umbrella clusters with loungers, towels and sunbathers from
// the wall down to the waterline, a row of striped beach huts along the wall foot, lifeguard towers
// near the water, sandcastles at the waterline and the odd volleyball net.
import { beachHut, lifeguardTower, sandcastle, sunbather, volleyballNet } from '../../scenery/props/beach';
import { lounger, towel, umbrella } from '../../scenery/props/street';
import type { Dress } from '../dress';
import { walk } from './nature';

/** Dry sand: the waterline sits at 0 and foam laps up to ~0.4 m above it near the shore. */
const DRY = 0.12;

export function beachLife(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  const count = { huts: 0, towers: 0, umbrellas: 0, castles: 0 };
  // Beach huts: one run of 5–8 along the wall foot.
  const hut0 = s0 + rng.range(10, Math.max(12, (s1 - s0) * 0.5));
  for (let k = 0, n = rng.int(5, 8); k < n; k++) {
    const sp = place.spot(hut0 + k * 4.2, side, rng.range(1.6, 2.0));
    if (sp.pos.y < DRY || sp.s > s1 || !place.free(sp.pos.x, sp.pos.z, 1.6, 1.0)) continue;
    beachHut(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad + Math.PI, rng);
    count.huts++;
  }
  // Lifeguard towers near the water every ~110 m; a volleyball net once.
  walk(rng, s0, s1, 110, (s) => {
    const sp = place.spot(s, side, rng.range(24, 32));
    if (sp.pos.y < DRY + 0.1 || !place.free(sp.pos.x, sp.pos.z, 2)) return;
    lifeguardTower(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad + Math.PI);
    count.towers++;
  });
  const net = place.spot(s0 + (s1 - s0) * rng.range(0.3, 0.7), side, rng.range(14, 19));
  if (net.pos.y > DRY && place.free(net.pos.x, net.pos.z, 4.6)) {
    volleyballNet(b.props.at(net.pos.x, net.pos.z), net.pos.x, net.pos.y, net.pos.z, net.faceRoad);
  }
  // Umbrella clusters: 1–3 umbrellas with loungers / towels / sunbathers, denser near the road.
  walk(rng, s0, s1, 4.5, (s) => {
    const sp = place.spot(s, side, 2.5 + Math.pow(rng.next(), 1.4) * 26);
    if (sp.pos.y < DRY) return;
    for (let k = 0, n = rng.int(2, 4); k < n; k++) {
      const x = sp.pos.x + rng.range(-2.5, 2.5), z = sp.pos.z + rng.range(-2.5, 2.5);
      if (place.onRoad(x, z, 2) || !place.claim(x, z, 1.6)) continue;
      const y = d.ctx.groundWorld(x, z);
      if (y < DRY) continue;
      umbrella(b.thin.at(x, z), x, y, z, rng);
      count.umbrellas++;
      const yaw = sp.faceRoad + Math.PI + rng.range(-0.5, 0.5);
      const lx = x + Math.cos(yaw) * 1.1, lz = z - Math.sin(yaw) * 1.1;
      const roll = rng.next();
      if (roll < 0.4) lounger(b.props.at(lx, lz), lx, y, lz, yaw, rng);
      else {
        towel(b.props.at(lx, lz), lx, y, lz, yaw, rng);
        if (roll < 0.8) sunbather(b.props.at(lx, lz), lx, y + 0.04, lz, yaw + Math.PI / 2, rng);
      }
    }
  });
  // Sandcastles at the waterline.
  walk(rng, s0, s1, 28, (s) => {
    for (let u = 30; u < 60; u += 2) {
      const sp = place.spot(s, side, u);
      if (sp.pos.y > 0.35) continue;
      if (sp.pos.y > DRY && place.free(sp.pos.x, sp.pos.z, 0.8)) {
        sandcastle(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, rng);
        count.castles++;
      }
      return;
    }
  });
  d.ctx.log(`beach ${Math.round(s0)}–${Math.round(s1)}: ${JSON.stringify(count)}`);
}
