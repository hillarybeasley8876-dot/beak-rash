// Coast signage: meme billboards (BILLBOARD_LINES + generated art when available), road signs,
// warnings, curve chevrons, distance markers, banners along the barriers.
import { BILLBOARD_LINES, ROAD_SIGNS } from '../../../data/memes';
import type { Dress } from '../dress';
import { billboard, panel, postSign, yawFor } from '../../scenery/signs/boards';
import {
  bannerFace, billboardFace, chevronFace, distanceFace, roadSignFace, roundSignFace, warnFace,
} from '../../scenery/signs/faces';
import type { AtlasRect } from '../../scenery/signs/atlas';

/** Billboard art loader (moved to scenery/signs/art.ts; re-exported for city / mountain imports). */
export { loadBillboardArt } from '../../scenery/signs/art';

/** Yaw for a face looking back down the road at riders on `side`, turned `turn` rad toward the road. */
function towardRiders(d: Dress, s: number, side: -1 | 1, turn = 0.3): number {
  const fr = d.ctx.q.frameVis(s);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1, rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const nx = (-fr.tangent.x / tl) * Math.cos(turn) - side * (fr.right.x / rl) * Math.sin(turn);
  const nz = (-fr.tangent.z / tl) * Math.cos(turn) - side * (fr.right.z / rl) * Math.sin(turn);
  return yawFor(nx, nz);
}

/**
 * Smallest u (beyond the drivable edge) for a panel of width w at yaw so its inner end stays
 * `gap` m outside the bound: the half-width's reach across the road plus the gap.
 */
function clearU(d: Dress, s: number, side: -1 | 1, yaw: number, w: number, gap = 0.3): number {
  const fr = d.ctx.q.frameVis(s);
  const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const across = Math.abs(Math.cos(yaw) * (fr.right.x / rl) - Math.sin(yaw) * (fr.right.z / rl));
  return (w / 2) * across + gap;
}

/** Billboard size (m) and how far the face turns from facing straight down the road toward riders. */
const BB = { w: 10, h: 5.6, hNoArt: 5, lift: 3, turn: 0.75 } as const;

/** Find room for a billboard near s: tries both sides and a few offsets along the road. */
function billboardSpot(d: Dress, s: number): ReturnType<Dress['place']['spot']> | null {
  const { ctx, place, rng } = d;
  for (const ds of [0, 18, -18, 36]) {
    for (const side of rng.shuffle([-1, 1] as const)) {
      const ss = s + ds;
      if (ctx.q.edgeKindAt(ss, side) === 'tunnel' || d.field.ground(ss, side).detached) continue;
      const u = clearU(d, ss, side, towardRiders(d, ss, side, BB.turn), BB.w + 0.5) + rng.range(0, 2.5);
      const sp = place.spot(ss, side, u);
      const edge = d.field.edgeY(ss, side);
      if (sp.pos.y < 0.3 || Math.abs(sp.pos.y - edge) > 3 || place.slopeRange(sp, 1, 6) > 5) continue;
      if (place.free(sp.pos.x, sp.pos.z, BB.w / 2 + 0.4, 2.5)) return sp;
    }
  }
  return null;
}

/** Meme billboards every ~`every` m, face-on enough to read at speed (BB). */
export function billboards(d: Dress, art: HTMLImageElement[], every = 150): void {
  const { ctx, b, atlas } = d;
  const lines = ctx.raceRng.shuffle(BILLBOARD_LINES);
  const at: string[] = [];
  let k = 0;
  for (let s = 150; s < ctx.L.length - 60; s += every * d.rng.range(0.8, 1.2)) {
    const sp = billboardSpot(d, s);
    if (!sp) continue;
    const line = lines[k % lines.length] ?? '';
    const img = art.length ? art[k % art.length] ?? null : null;
    // The race seed picks the lines; a forked rng draws them so the rest of the dressing stays seed-free.
    const rect = d.face(`bb:${line}:${img?.src ?? ''}`, () => billboardFace(atlas, d.rng.fork(k + 1), line, img));
    k++;
    if (!rect) return;
    const yaw = towardRiders(d, sp.s, sp.side, BB.turn);
    const { x, y, z } = sp.pos;
    billboard(b.props.at(x, z), b.faces.at(x, z), x, y, z, yaw, BB.w, img ? BB.h : BB.hNoArt, BB.lift, rect);
    at.push(`${Math.round(sp.s)}${sp.side < 0 ? 'L' : 'R'}`);
  }
  d.ctx.log(`billboards: ${k} at s=${at.join(',')}`);
}

/**
 * Road-level mounting height for a roadside item: on the ground when it is near road level, on the
 * road edge over drops (rail-mounted), null on top of walls / cliffs (would float above the road).
 */
export function mountY(d: Dress, s: number, side: -1 | 1, groundY: number): number | null {
  const edge = d.field.edgeY(s, side);
  if (groundY > edge + 2.5) return null;
  return groundY < edge - 0.4 ? edge : groundY;
}

function signAt(d: Dress, s: number, side: -1 | 1, rect: AtlasRect | null, w: number, h: number, u = 0.9, lift = 1.6, mirror = false): void {
  if (!rect) return;
  const spotFor = (sd: -1 | 1) => d.place.spot(s, sd, Math.max(u, clearU(d, s, sd, towardRiders(d, s, sd, 0.25), w + 0.1)));
  let sp = spotFor(side);
  let y = mountY(d, s, side, sp.pos.y);
  if (y === null) {
    // On top of a wall: use the other side of the road instead.
    sp = spotFor(side < 0 ? 1 : -1);
    y = mountY(d, s, sp.side, sp.pos.y);
    if (y === null) return;
  }
  if (!d.place.claim(sp.pos.x, sp.pos.z, 0.6)) return;
  const { x, z } = sp.pos;
  postSign(d.b.props.at(x, z), d.b.faces.at(x, z), x, y, z, towardRiders(d, s, sp.side, 0.25), w, h, lift, rect, mirror);
}

/** Sharp-bend caption (content's ROAD_SIGNS has one; the first six entries are positional). */
const SHARP = ROAD_SIGNS.find((t) => t.startsWith('急弯')) ?? '急弯 别急';

/** Road sign placed by a layout mark { kind: 'sign', data: { sign } } so signs follow the corners. */
export function roadSign(d: Dress, s: number, side: -1 | 1, sign: string): void {
  const { atlas } = d;
  const [limit, fish, pelican, laneR, laneL, curves] = ROAD_SIGNS;
  switch (sign) {
    case 'limit': signAt(d, s, side, roundSignFace(atlas, '限速', (limit ?? '限速：随缘').split('：')[1] ?? '随缘'), 1.4, 1.4); break;
    case 'fish': signAt(d, s, side, warnFace(atlas, '鱼', fish ?? '注意落鱼'), 1.3, 1.5); break;
    case 'pelican': signAt(d, s, side, warnFace(atlas, '鹕', pelican ?? '鹈鹕出没'), 1.3, 1.5); break;
    case 'curves': signAt(d, s, side, roadSignFace(atlas, curves ?? '连续弯道 弯弯有鹅'), 2.6, 1.6); break;
    case 'sharp': signAt(d, s, side, warnFace(atlas, '弯', SHARP), 1.3, 1.5); break;
    case 'lighthouse': signAt(d, s, side, roadSignFace(atlas, '鹈鹕湾灯塔 ←'), 2.4, 1.5); break;
    case 'lanes':
      signAt(d, s, d.side(1), roadSignFace(atlas, laneR ?? '内卷车道 →'), 2.4, 1.5);
      signAt(d, s, d.side(-1), roadSignFace(atlas, laneL ?? '← 躺平车道'), 2.4, 1.5);
      break;
    default: console.warn('[track] unknown road sign', sign);
  }
}

/** Warnings tied to layout marks (crest, ramp). */
export function warning(d: Dress, s: number, side: -1 | 1, glyph: string, caption: string): void {
  signAt(d, s, side, warnFace(d.atlas, glyph, caption), 1.3, 1.5);
}

export function chevrons(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const rect = d.face('chevron', () => chevronFace(d.atlas));
  for (let s = s0 + 6; s < s1; s += 18) {
    const k = d.ctx.q.frameVis(s).curvature;
    // Arrows point into the turn: mirror for left turns.
    signAt(d, s, side, rect, 0.9, 0.9, 0.35, 0.55, k < 0);
  }
}

export function distanceMarkers(d: Dress): void {
  const L = d.ctx.L.length;
  for (let togo = 500; togo < L - 100; togo += 500) {
    const s = L - togo;
    const side: -1 | 1 = d.ctx.q.edgeKindAt(s, d.side(1)) === 'tunnel' ? d.side(-1) : d.side(1);
    if (d.ctx.q.edgeKindAt(s, side) === 'tunnel') continue;
    signAt(d, s, side, distanceFace(d.atlas, `${(togo / 1000).toFixed(1)} KM`), 1.2, 0.95, 0.9, 1.1);
  }
}

/** Banners on short legs just behind the barriers. */
export function banners(d: Dress, side: -1 | 1, s0: number, s1: number, texts: string[]): void {
  let k = 0;
  for (let s = s0 + 4; s < s1 - 4; s += 16) {
    const i = k % texts.length;
    const text = texts[i] ?? '';
    const tone = (['red', 'black', 'white'] as const)[i % 3] ?? 'red';
    const rect = d.face(`banner:${text}`, () => bannerFace(d.atlas, d.rng.fork(0xba00 + i), text, tone));
    k++;
    if (!rect) return;
    const sp = d.place.spot(s, side, 0.75);
    if (!d.place.claim(sp.pos.x, sp.pos.z, 1)) continue;
    const yaw = sp.faceRoad;
    panel(d.b.props.at(sp.pos.x, sp.pos.z), d.b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, yaw, 6, 0.75, 0.55, rect);
  }
}
