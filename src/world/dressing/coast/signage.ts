// Coast signage: meme billboards (BILLBOARD_LINES + generated art when available), road signs,
// warnings, curve chevrons, distance markers, banners along the barriers.
import { BILLBOARDS, assetUrl } from '../../../data/assets';
import { BILLBOARD_LINES, ROAD_SIGNS } from '../../../data/memes';
import type { Dress } from '../dress';
import { billboard, panel, postSign, yawFor } from '../../scenery/signs/boards';
import {
  bannerFace, billboardFace, chevronFace, distanceFace, roadSignFace, roundSignFace, warnFace,
} from '../../scenery/signs/faces';
import type { AtlasRect } from '../../scenery/signs/atlas';

/** Load billboard art listed in the asset manifest (bounded wait; missing files are skipped). */
export async function loadBillboardArt(id: string, timeoutMs = 2500): Promise<HTMLImageElement[]> {
  const files = (BILLBOARDS as Record<string, string[] | undefined>)[id] ?? [];
  const load = (rel: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('[track] billboard art missing:', rel);
      resolve(null);
    };
    img.src = assetUrl(rel);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null[]>((resolve) => { timer = setTimeout(() => resolve([]), timeoutMs); });
  const imgs: Array<HTMLImageElement | null> = await Promise.race([Promise.all(files.map(load)), timeout]);
  if (timer) clearTimeout(timer);
  return imgs.filter((i): i is HTMLImageElement => i !== null);
}

/** Yaw for a face looking back down the road at riders on `side`, turned `turn` rad toward the road. */
function towardRiders(d: Dress, s: number, side: -1 | 1, turn = 0.3): number {
  const fr = d.ctx.q.frameVis(s);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1, rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const nx = (-fr.tangent.x / tl) * Math.cos(turn) - side * (fr.right.x / rl) * Math.sin(turn);
  const nz = (-fr.tangent.z / tl) * Math.cos(turn) - side * (fr.right.z / rl) * Math.sin(turn);
  return yawFor(nx, nz);
}

/** Find room for a billboard near s: tries both sides and a few offsets along the road. */
function billboardSpot(d: Dress, s: number): ReturnType<Dress['place']['spot']> | null {
  const { ctx, place, rng } = d;
  for (const ds of [0, 18, -18, 36]) {
    for (const side of rng.shuffle([-1, 1] as const)) {
      const ss = s + ds;
      if (ctx.q.edgeKindAt(ss, side) === 'tunnel' || d.field.ground(ss, side).detached) continue;
      const sp = place.spot(ss, side, rng.range(3, 7));
      const edge = d.field.edgeY(ss, side);
      if (sp.pos.y < 0.3 || Math.abs(sp.pos.y - edge) > 3 || place.slopeRange(sp, 1, 6) > 5) continue;
      if (place.free(sp.pos.x, sp.pos.z, 4.2, 2.5)) return sp;
    }
  }
  return null;
}

export function billboards(d: Dress, art: HTMLImageElement[], every = 230): void {
  const { ctx, b, atlas } = d;
  const lines = ctx.raceRng.shuffle(BILLBOARD_LINES);
  const at: string[] = [];
  let k = 0;
  for (let s = 150; s < ctx.L.length - 60; s += every * d.rng.range(0.8, 1.2)) {
    const sp = billboardSpot(d, s);
    if (!sp) continue;
    const line = lines[k % lines.length] ?? '';
    const img = art.length ? art[k % art.length] ?? null : null;
    const rect = d.face(`bb:${line}:${img?.src ?? ''}`, () => billboardFace(atlas, d.rng, line, img));
    k++;
    if (!rect) return;
    billboard(b.props.at(sp.pos.x, sp.pos.z), b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, towardRiders(d, sp.s, sp.side, 0.42), 8, img ? 4.5 : 4, 2.6, rect);
    at.push(`${Math.round(sp.s)}${sp.side < 0 ? 'L' : 'R'}`);
  }
  console.info(`[track] billboards: ${k} at s=${at.join(',')}`);
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
  let sp = d.place.spot(s, side, u);
  let y = mountY(d, s, side, sp.pos.y);
  if (y === null) {
    // On top of a wall: use the other side of the road instead.
    sp = d.place.spot(s, side < 0 ? 1 : -1, u);
    y = mountY(d, s, sp.side, sp.pos.y);
    if (y === null) return;
  }
  if (!d.place.claim(sp.pos.x, sp.pos.z, 0.6)) return;
  postSign(d.b.props.at(sp.pos.x, sp.pos.z), d.b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z, towardRiders(d, s, sp.side, 0.25), w, h, lift, rect, mirror);
}

export function roadSigns(d: Dress): void {
  const { atlas } = d;
  const [limit, fish, pelican, laneR, laneL, curves] = ROAD_SIGNS;
  signAt(d, 175, 1, roundSignFace(atlas, '限速', (limit ?? '限速：随缘').split('：')[1] ?? '随缘'), 1.4, 1.4);
  signAt(d, 1145, 1, warnFace(atlas, '鱼', fish ?? '注意落鱼'), 1.3, 1.5);
  signAt(d, 410, 1, warnFace(atlas, '鹕', pelican ?? '鹈鹕出没'), 1.3, 1.5);
  signAt(d, 930, 1, roadSignFace(atlas, curves ?? '前方连续弯道'), 2.6, 1.6);
  signAt(d, 2640, 1, roadSignFace(atlas, laneR ?? '内卷车道 →'), 2.4, 1.5);
  signAt(d, 2640, -1, roadSignFace(atlas, laneL ?? '← 躺平车道'), 2.4, 1.5);
  signAt(d, 1395, 1, roadSignFace(atlas, '鹈鹕湾灯塔 ←'), 2.4, 1.5);
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
    const side: -1 | 1 = d.ctx.q.edgeKindAt(s, 1) === 'tunnel' ? -1 : 1;
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
    const rect = d.face(`banner:${text}`, () => bannerFace(d.atlas, d.rng, text, (['red', 'black', 'white'] as const)[i % 3] ?? 'red'));
    k++;
    if (!rect) return;
    const sp = d.place.spot(s, side, 0.75);
    if (!d.place.claim(sp.pos.x, sp.pos.z, 1)) continue;
    const yaw = sp.faceRoad;
    panel(d.b.props.at(sp.pos.x, sp.pos.z), d.b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, yaw, 6, 0.75, 0.55, rect);
  }
}
