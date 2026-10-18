// Coast race-event and landmark dressing: gantries, grandstands, flags, the lighthouse, the pier,
// sailboats and buoys at sea, gull flocks.
import { Color, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import { flagPole, gantry, stand, type FlagStyle } from '../../scenery/props/event';
import { lighthouse, pier } from '../../scenery/props/landmarks';
import { buoy, sailboat } from '../../scenery/props/marine';
import { buildGulls, type Flock } from '../../scenery/gulls';
import { faceQuad } from '../../scenery/signs/boards';
import { bannerFace, finishFace, gantryFace } from '../../scenery/signs/faces';
import { finishArch } from '../../scenery/props/finish';
import type { Dress } from '../dress';

const RED = new Color('#e5191c'), INK = new Color('#16171c'), YELLOW = new Color('#ffe600'), WHITE = new Color('#f6f3ec');
/** Start flags: P5 star flags (some swallowtailed); the finish mixes in chequered flags. */
const START_FLAGS: Array<{ col: Color; style: FlagStyle; emblem: Color; swallow: boolean }> = [
  { col: RED, style: 'star', emblem: WHITE, swallow: false }, { col: INK, style: 'star', emblem: YELLOW, swallow: true },
  { col: YELLOW, style: 'star', emblem: RED, swallow: false }, { col: RED, style: 'star', emblem: INK, swallow: true },
];
const FINISH_FLAGS = [
  { col: WHITE, style: 'chequer' as const, emblem: WHITE, swallow: false }, { col: RED, style: 'star' as const, emblem: WHITE, swallow: true },
];

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
  if (fr) faceQuad(b.faces.at(g.front.x, g.front.z), frontFacesRiders ? g.front : g.back, frontFacesRiders ? frontYaw : backYaw, w, Math.min(2.5,
    h), fr);
  if (bk) faceQuad(b.faces.at(g.back.x, g.back.z), frontFacesRiders ? g.back : g.front, frontFacesRiders ? backYaw : frontYaw, w, Math.min(2.5, h),
    bk);
}

/** The FINISH arch over the line at s: ransom-note header toward the riders, tagline on the back. */
export function finishArchAt(d: Dress, s: number, word: string, sub: string, backWord: string, backSub: string): void {
  const { place, b, atlas, rng } = d;
  const l = place.spot(s, -1, 1.3), r = place.spot(s, 1, 1.3);
  const toRiders = place.spot(s, 1, 0).along + Math.PI;
  const g = finishArch(b.props.at(l.pos.x, l.pos.z), b.crowd.at(l.pos.x, l.pos.z), b.cloth.at(l.pos.x, l.pos.z), l.pos, r.pos, 7.2, toRiders, rng);
  const frontFacesRiders = Math.cos(g.yaw - toRiders) > 0;
  const fr = finishFace(atlas, rng.fork(0xf1), word, sub), bk = gantryFace(atlas, backWord, backSub);
  const w = g.span + 2.6, h = Math.min(g.headerH - 0.5, w / 5);
  const [pf, yf, pb, yb] = frontFacesRiders ? [g.front, g.yaw, g.back, g.yaw + Math.PI] : [g.back, g.yaw + Math.PI, g.front, g.yaw];
  if (fr) faceQuad(b.faces.at(pf.x, pf.z), pf, yf, w, h, fr);
  if (bk) faceQuad(b.faces.at(pb.x, pb.z), pb, yb, w, Math.min(2.5, h), bk);
}

/** Meme banners on the grandstand awnings (track-owned lines, like the barrier banners). */
export const STAND_BANNERS = ['V我50 小鱼干', '鹈鹕冲鸭', '今日宜：撞人', '前排出售瓜子'];

/** Grandstands behind the barriers in 26 m blocks, a meme banner along each awning edge. */
export function stands(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b, atlas } = d;
  let k = 0;
  for (let s = s0 + 14; s < s1 - 12; s += 34) {
    const sp = place.spot(s, side, 1.4);
    const c = place.spot(s, side, 4);
    if (!place.free(c.pos.x, c.pos.z, 4, 2.5)) continue;
    stand(b.props.at(sp.pos.x, sp.pos.z), b.crowd.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, 26, rng);
    const text = STAND_BANNERS[k++ % STAND_BANNERS.length] ?? '';
    const rect = d.face(`stand:${text}`, () => bannerFace(atlas, rng.fork(k), text, k % 2 ? 'black' : 'red'));
    if (!rect) continue;
    // Awning front edge: local (0, 3.95, −0.66) of the stand (local −Z faces the road).
    const yaw = sp.faceRoad, fx = -Math.sin(yaw) * 0.66, fz = -Math.cos(yaw) * 0.66;
    faceQuad(b.faces.at(sp.pos.x, sp.pos.z), new Vector3(sp.pos.x + fx, sp.pos.y + 3.95, sp.pos.z + fz), yaw, 12, 1.5, rect);
  }
}

export function flags(d: Dress, side: -1 | 1, s0: number, s1: number, every = 11, finish = false): void {
  const { place, rng, b } = d;
  const set = finish ? FINISH_FLAGS : START_FLAGS;
  let k = 0;
  for (let s = s0 + 3; s < s1; s += every) {
    const sp = place.spot(s, side, 0.9);
    if (!place.claim(sp.pos.x, sp.pos.z, 0.4)) continue;
    const f = set[k++ % set.length] ?? START_FLAGS[0];
    if (!f) continue;
    flagPole(b.props.at(sp.pos.x, sp.pos.z), b.cloth.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, 6.5, sp.along + Math.PI / 2,
      f.col, rng, f.style, f.swallow, f.emblem);
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
