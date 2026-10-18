// Sunset Pass signage: hairpin chevron rows, SUNSET PASS road signs, brown scenic signs, meme
// billboards (TRACK_BILLBOARDS.mountain + general lines, BILLBOARDS.mountain poster art).
import { TRACK_BILLBOARDS, BILLBOARD_LINES } from '../../../data/memes';
import type { AtlasRect } from '../../scenery/signs/atlas';
import { billboard, postSign, yawFor } from '../../scenery/signs/boards';
import { billboardFace, chevronFace } from '../../scenery/signs/faces';
import { mountY } from '../coast/signage';
import type { Dress } from '../dress';
import { passSignFace, scenicFace } from './faces';

/** Yaw for a face looking back down the road at riders on `side`, turned `turn` rad toward the road. */
export function towardRiders(d: Dress, s: number, side: -1 | 1, turn = 0.3): number {
  const fr = d.ctx.q.frameVis(s);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1, rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const nx = (-fr.tangent.x / tl) * Math.cos(turn) - side * (fr.right.x / rl) * Math.sin(turn);
  const nz = (-fr.tangent.z / tl) * Math.cos(turn) - side * (fr.right.z / rl) * Math.sin(turn);
  return yawFor(nx, nz);
}

interface SignOpts { u?: number; lift?: number; mirror?: boolean; turn?: number; flip?: boolean }

/** Post sign at (s, side); hops to the other side when this side is a wall top. */
export function signAt(d: Dress, s: number, side: -1 | 1, rect: AtlasRect | null, w: number, h: number, o: SignOpts = {}): boolean {
  if (!rect) return false;
  const u = o.u ?? 0.9;
  for (const sd of o.flip === false ? [side] : [side, (side < 0 ? 1 : -1) as -1 | 1]) {
    if (d.ctx.q.edgeKindAt(s, sd) === 'tunnel') continue;
    const sp = d.place.spot(s, sd, u);
    const y = mountY(d, s, sd, sp.pos.y);
    if (y === null || !d.place.claim(sp.pos.x, sp.pos.z, 0.6)) continue;
    postSign(d.b.props.at(sp.pos.x, sp.pos.z), d.b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z,
      towardRiders(d, s, sd, o.turn ?? 0.25), w, h, o.lift ?? 1.6, rect, o.mirror ?? false);
    return true;
  }
  return false;
}

/** Red/white chevron boards along the outside of a bend (arrows point into the turn). */
export function chevronRow(d: Dress, side: -1 | 1, s0: number, s1: number, every = 10): void {
  const rect = d.face('chevron', () => chevronFace(d.atlas));
  for (let s = s0 + every * 0.5; s < s1; s += every) {
    const k = d.ctx.q.frameVis(s).curvature;
    signAt(d, s, side, rect, 1.05, 1.05, { u: 0.3, lift: 0.5, mirror: k < 0, turn: 0.12, flip: false });
  }
}

export function roadSign(d: Dress, s: number, side: -1 | 1, text: string): void {
  signAt(d, s, side, d.face(`pass:${text}`, () => passSignFace(d.atlas, text)), 2.5, 1.56);
}

export function scenicSign(d: Dress, s: number, side: -1 | 1, text: string, en: string): void {
  const [title = text, ...rest] = text.split(' ');
  signAt(d, s, side, d.face(`scenic:${text}`, () => scenicFace(d.atlas, title, rest.join(' '), en)), 2.6, 1.45, { lift: 1.4 });
}

/** Room for a billboard near s: road-level ground on either side, a few offsets along the road. */
function billboardSpot(d: Dress, s: number): ReturnType<Dress['place']['spot']> | null {
  const { ctx, place, rng } = d;
  for (const ds of [0, 16, -16, 32, -32]) {
    for (const side of rng.shuffle([-1, 1] as const)) {
      const ss = s + ds;
      if (ctx.q.edgeKindAt(ss, side) === 'tunnel' || d.field.ground(ss, side).detached) continue;
      const sp = place.spot(ss, side, rng.range(2.5, 6));
      const edge = d.field.edgeY(ss, side);
      if (Math.abs(sp.pos.y - edge) > 2.2 || place.slopeRange(sp, 1, 6) > 3.5) continue;
      if (place.free(sp.pos.x, sp.pos.z, 4.2, 2.5)) return sp;
    }
  }
  return null;
}

/** Meme billboards every ~`every` m: mountain lines first, then general ones (race-seeded order). */
export function billboards(d: Dress, art: HTMLImageElement[], every = 290): void {
  const { ctx, b, atlas } = d;
  const lines = [...ctx.raceRng.shuffle(TRACK_BILLBOARDS.mountain), ...ctx.raceRng.shuffle(BILLBOARD_LINES)];
  const at: string[] = [];
  let k = 0;
  for (let s = 200; s < ctx.L.length - 80; s += every * d.rng.range(0.8, 1.2)) {
    const sp = billboardSpot(d, s);
    if (!sp) continue;
    const line = lines[k % lines.length] ?? '';
    const img = art.length ? art[k % art.length] ?? null : null;
    const rect = d.face(`bb:${line}:${img?.src ?? ''}`, () => billboardFace(atlas, d.rng.fork(k + 1), line, img));
    k++;
    if (!rect) return;
    billboard(b.props.at(sp.pos.x, sp.pos.z), b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z,
      towardRiders(d, sp.s, sp.side, 0.42), 8, img ? 4.5 : 4, 2.6, rect);
    at.push(`${Math.round(sp.s)}${sp.side < 0 ? 'L' : 'R'}`);
  }
  console.info(`[mountain] billboards: ${k} at s=${at.join(',')}`);
}
