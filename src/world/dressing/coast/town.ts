// Coast town dressing: terraced villas, beach life (umbrellas, loungers, towels, swim rings),
// promenade lamps and benches, the fish market (stalls, halls, moored boats, pennants).
import { Vector3 } from 'three';
import { villa } from '../../scenery/props/building';
import { stall } from '../../scenery/props/landmarks';
import { pennants } from '../../scenery/props/event';
import { fishingBoat } from '../../scenery/props/marine';
import { bench, flowerPot, lampPost, lounger, towel, umbrella } from '../../scenery/props/street';
import type { Dress } from '../dress';
import { walk } from './nature';

/** Villas in up to three terraces climbing the hillside on `side`. */
export function villas(d: Dress, side: -1 | 1, s0: number, s1: number, rows = 3): void {
  const { place, rng, b } = d;
  const bands: Array<[number, number]> = [[6, 10], [18, 26], [32, 42]];
  for (let r = 0; r < rows; r++) {
    const [u0, u1] = bands[r] as [number, number];
    walk(rng, s0, s1, 17 + r * 4, (s) => {
      const sp = place.spot(s, side, rng.range(u0, u1));
      if (sp.pos.y < 1.5) return;
      const w = rng.range(6, 8.5), dd = rng.range(5, 6.5);
      const range = place.slopeRange(sp, dd, w);
      if (range > 4.5) return;
      // Footprint centre sits half a depth further out.
      const c = place.spot(s, side, sp.u + dd / 2);
      if (!place.free(c.pos.x, c.pos.z, Math.max(w, dd) * 0.62)) return;
      // Sit the plinth on the highest corner so the front never floats.
      villa(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y + range * 0.35, sp.pos.z, sp.faceRoad + rng.range(-0.08, 0.08), rng, { w, d: dd, floors: r === 0 ? rng.int(1, 2) : rng.int(1, 3), sink: range + 1.5 });
    });
  }
}

/** Beach below a seawall: umbrellas with loungers and towels on dry sand. */
export function beachLife(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  walk(rng, s0, s1, 7, (s) => {
    const sp = place.spot(s, side, rng.range(2.5, 16));
    // Dry sand only (the waterline sits at 0; foam laps up to ~0.4 m).
    if (sp.pos.y < 0.12) return;
    if (!place.free(sp.pos.x, sp.pos.z, 2)) return;
    const buf = b.thin.at(sp.pos.x, sp.pos.z);
    umbrella(buf, sp.pos.x, sp.pos.y, sp.pos.z, rng);
    const yaw = sp.faceRoad + Math.PI + rng.range(-0.4, 0.4);
    if (rng.chance(0.6)) lounger(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x + Math.cos(yaw) * 1.1, sp.pos.y, sp.pos.z - Math.sin(yaw) * 1.1, yaw, rng);
    else towel(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x + Math.cos(yaw) * 1.1, sp.pos.y, sp.pos.z - Math.sin(yaw) * 1.1, yaw, rng);
  });
}

/** Towels on the drivable sand shoulder (flat, no collision needed) + swim rings in the shallows. */
export function sandShoulder(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { ctx, rng, b } = d;
  const hw = ctx.L.halfWidth;
  const p = new Vector3();
  walk(rng, s0, s1, 9, (s) => {
    const sh = ctx.q.shoulder(s, side);
    if (sh < 4) return;
    const x = side * (hw + rng.range(2.4, sh - 0.8));
    ctx.q.toWorld(s, x, 0, p);
    towel(b.props.at(p.x, p.z), p.x, p.y, p.z, d.place.spot(s, side, 0).along + rng.range(-0.5, 0.5), rng);
  });
}

/** Lamps along an edge (base at road height when the edge is a quay/seawall). */
export function lamps(d: Dress, side: -1 | 1, s0: number, s1: number, u: number, every = 32, onRoad = false): void {
  const { ctx, place, b } = d;
  for (let s = s0 + every / 2; s < s1; s += every) {
    const sp = place.spot(s, side, u);
    const y = onRoad ? ctx.q.toWorld(s, sp.x, 0, new Vector3()).y + 0.05 : sp.pos.y;
    if (!place.claim(sp.pos.x, sp.pos.z, 0.5)) continue;
    lampPost(b.props.at(sp.pos.x, sp.pos.z), b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z, sp.faceRoad + Math.PI);
    if (!onRoad && d.rng.chance(0.5)) {
      const bs = place.spot(s + 6, side, u + 0.4);
      if (place.claim(bs.pos.x, bs.pos.z, 1)) bench(b.props.at(bs.pos.x, bs.pos.z), bs.pos.x, bs.pos.y, bs.pos.z, bs.faceRoad + Math.PI);
    } else if (!onRoad) {
      const fp = place.spot(s + 5, side, u + 0.3);
      if (place.claim(fp.pos.x, fp.pos.z, 0.6)) flowerPot(b.props.at(fp.pos.x, fp.pos.z), fp.pos.x, fp.pos.y, fp.pos.z, d.rng);
    }
  }
}

/** Fish market: stalls along the kerb, market halls behind, boats along the quay, pennants overhead. */
export function market(d: Dress, s0: number, s1: number): void {
  const { ctx, place, rng, b } = d;
  for (let s = s0 + 4; s < s1 - 4; s += 5.2) {
    if (rng.chance(0.15)) continue;
    const sp = place.spot(s, 1, 1.1);
    if (!place.free(sp.pos.x, sp.pos.z, 1.9, 0.8)) continue;
    stall(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, rng);
  }
  villas(d, 1, s0 + 6, s1 - 6, 2);
  walk(rng, s0, s1, 12, (s) => {
    const sp = place.spot(s, -1, rng.range(3.2, 6));
    if (sp.pos.y > -0.6 || !place.free(sp.pos.x, sp.pos.z, 2.6, 2.4)) return;
    fishingBoat(b.boats.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.z, sp.along + (rng.chance(0.5) ? 0 : Math.PI), rng);
  });
  // Pennant strings across the street between poles on both sides.
  for (let s = s0 + 30; s < s1 - 20; s += 45) {
    const l = place.spot(s, -1, 0.15), r = place.spot(s, 1, 0.5);
    const ly = ctx.q.toWorld(s, l.x, 0, new Vector3()).y;
    const a = new Vector3(l.pos.x, ly + 6.2, l.pos.z), bb = new Vector3(r.pos.x, r.pos.y + 6.2, r.pos.z);
    pennants(b.cloth.at(a.x, a.z), a, bb, 0.9, rng);
    for (const [p, y] of [[l, ly], [r, r.pos.y]] as Array<[typeof l, number]>) {
      lampPost(b.props.at(p.pos.x, p.pos.z), b.glow.at(p.pos.x, p.pos.z), p.pos.x, y, p.pos.z, p.faceRoad + Math.PI);
    }
  }
}
