// Coast race-event and landmark dressing: gantries, grandstands, flags, the lighthouse, the pier,
// sailboats and buoys at sea, gull flocks.
import { Color, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import { flagPole, gantry, stand } from '../../scenery/props/event';
import { lighthouse, pier } from '../../scenery/props/landmarks';
import { buoy, sailboat } from '../../scenery/props/marine';
import { buildGulls, type Flock } from '../../scenery/gulls';
import { faceQuad } from '../../scenery/signs/boards';
import { gantryFace } from '../../scenery/signs/faces';
import type { Dress } from '../dress';

const FLAG_COLS = [new Color('#e5191c'), new Color('#16171c'), new Color('#ffe600'), new Color('#ffffff')];

/** Gantry over the road at s with header faces (toward the riders and the back). */
export function gantryAt(d: Dress, s: number, word: string, sub: string, backWord: string, backSub: string): void {
  const { place, b, atlas } = d;
  const l = place.spot(s, -1, 1.1), r = place.spot(s, 1, 1.1);
  const g = gantry(b.props.at(l.pos.x, l.pos.z), l.pos, r.pos, 6.4);
  // gantry() faces: `front` is on the local −Z side of the beam; pick the side facing the riders.
  const toRiders = place.spot(s, 1, 0).along + Math.PI;
  const frontYaw = g.yaw, backYaw = g.yaw + Math.PI;
  const frontFacesRiders = Math.cos(frontYaw - toRiders) > 0;
  const fr = gantryFace(atlas, word, sub), bk = gantryFace(atlas, backWord, backSub);
  const w = g.span + 0.6, h = w / 6;
  if (fr) faceQuad(b.faces.at(g.front.x, g.front.z), frontFacesRiders ? g.front : g.back, frontFacesRiders ? frontYaw : backYaw, w, Math.min(2.5, h), fr);
  if (bk) faceQuad(b.faces.at(g.back.x, g.back.z), frontFacesRiders ? g.back : g.front, frontFacesRiders ? backYaw : frontYaw, w, Math.min(2.5, h), bk);
}

/** Grandstands behind the barriers in 26 m blocks. */
export function stands(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  for (let s = s0 + 14; s < s1 - 12; s += 34) {
    const sp = place.spot(s, side, 1.4);
    const c = place.spot(s, side, 4);
    if (!place.free(c.pos.x, c.pos.z, 4, 2.5)) continue;
    stand(b.props.at(sp.pos.x, sp.pos.z), b.crowd.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, 26, rng);
  }
}

export function flags(d: Dress, side: -1 | 1, s0: number, s1: number, every = 11): void {
  const { place, rng, b } = d;
  let k = 0;
  for (let s = s0 + 3; s < s1; s += every) {
    const sp = place.spot(s, side, 0.9);
    if (!place.claim(sp.pos.x, sp.pos.z, 0.4)) continue;
    flagPole(b.props.at(sp.pos.x, sp.pos.z), b.cloth.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, 6.5, sp.along + Math.PI / 2, FLAG_COLS[k++ % FLAG_COLS.length] as Color, rng);
  }
}

export function lighthouseAt(d: Dress, s: number, x: number): void {
  const fr = d.ctx.q.frameVis(s);
  const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const wx = fr.pos.x + (fr.right.x / rl) * x, wz = fr.pos.z + (fr.right.z / rl) * x;
  // Climb to the highest nearby point of the promontory.
  let best = d.place.world(wx, wz);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    for (const r of [6, 12, 18]) {
      const p = d.place.world(wx + Math.cos(a) * r, wz + Math.sin(a) * r);
      if (p.y > best.y) best = p;
    }
  }
  d.place.claim(best.x, best.z, 9);
  lighthouse(d.b.props.at(best.x, best.z), d.b.glow.at(best.x, best.z), best.x, best.y, best.z, d.rng);
}

export function pierAt(d: Dress, s: number): void {
  const sp = d.place.spot(s, -1, 0.35);
  const y = d.ctx.q.toWorld(s, sp.x, 0, new Vector3()).y;
  // faceRoad turns local −Z toward the road, so local +Z (the pier's length) points out to sea.
  const yaw = sp.faceRoad;
  pier(d.b.props.at(sp.pos.x, sp.pos.z), d.b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, y - 0.05, sp.pos.z, yaw, 64, d.rng);
  for (let k = 1; k <= 64; k += 2) {
    d.place.claim(sp.pos.x + Math.sin(yaw) * k, sp.pos.z + Math.cos(yaw) * k, 2.4);
  }
}

/** Sailboats and buoys offshore on `side` (u = metres beyond the edge). */
export function atSea(d: Dress, side: -1 | 1, s0: number, s1: number, u0: number, u1: number, spacing: number): void {
  const { place, rng, b } = d;
  for (let s = s0 + rng.range(0, spacing); s < s1; s += spacing * rng.range(0.6, 1.4)) {
    const sp = place.spot(s, side, rng.range(u0, u1));
    if (sp.pos.y > -1.5 || !place.claim(sp.pos.x, sp.pos.z, 6)) continue;
    if (rng.chance(0.7)) sailboat(b.boats.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.z, rng.range(0, 6.28), rng, rng.range(0.9, 1.3));
    else buoy(b.boats.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.z, rng);
  }
}

export function gulls(d: Dress, at: Array<[number, number]>, rng: Rng): void {
  const flocks: Flock[] = at.map(([s, x]) => {
    const fr = d.ctx.q.frameVis(s);
    return { centre: new Vector3(fr.pos.x + fr.right.x * x, 0, fr.pos.z + fr.right.z * x), count: rng.int(6, 9), radius: 16, height: fr.pos.y + 14 };
  });
  buildGulls(d.ctx, flocks, rng);
}
