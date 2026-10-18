// Sunset Pass signage: hairpin chevron rows, SUNSET PASS road signs, brown scenic signs, meme
// billboards (TRACK_BILLBOARDS.mountain + general lines, BILLBOARDS.mountain poster art).
import { TRACK_BILLBOARDS, BILLBOARD_LINES } from '../../../data/memes';
import { flatAxes } from '../../env/mountain-frame';
import type { AtlasRect } from '../../scenery/signs/atlas';
import { billboard, postSign, yawFor } from '../../scenery/signs/boards';
import { billboardFace, chevronFace } from '../../scenery/signs/faces';
import { mountY } from '../coast/signage';
import type { Dress } from '../dress';
import { passSignFace, scenicFace } from './faces';
import { signFace } from './util';

/** Yaw for a face looking back down the road at riders on `side`, turned `turn` rad toward the road. */
export function towardRiders(d: Dress, s: number, side: -1 | 1, turn = 0.3): number {
  const fr = d.ctx.q.frameVis(s);
  const a = flatAxes(fr);
  const nx = -a.tx * Math.cos(turn) - side * a.rx * Math.sin(turn);
  const nz = -a.tz * Math.cos(turn) - side * a.rz * Math.sin(turn);
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

/** Sharpest curvature over [s0, s1] (signed). */
function sharpest(d: Dress, s0: number, s1: number): number {
  let best = 0;
  for (let s = s0; s <= s1; s += 2) {
    const k = d.ctx.q.frameVis(s).curvature;
    if (Math.abs(k) > Math.abs(best)) best = k;
  }
  return best;
}

/** Direction of the bend a chevron row warns about: its own bend, or (approach rows on a straight) the next one. */
function bendDir(d: Dress, s0: number, s1: number): number {
  const own = sharpest(d, s0, s1);
  return Math.sign(Math.abs(own) > 1 / 400 ? own : sharpest(d, s1, s1 + 40));
}

/** Red/white chevron boards along the outside of a bend (arrows point into the turn). */
export function chevronRow(d: Dress, side: -1 | 1, s0: number, s1: number, every = 10): void {
  const rect = signFace(d, 'chevron', () => chevronFace(d.atlas));
  const mirror = bendDir(d, s0, s1) < 0;
  for (let s = s0 + every * 0.5; s < s1; s += every) {
    // Above a rail / stone parapet the whole face clears the barrier; elsewhere it sits low on its post.
    const edge = d.ctx.q.edgeKindAt(s, side);
    const lift = edge === 'rail' || edge === 'stone' ? 0.95 : 0.5;
    signAt(d, s, side, rect, 1.05, 1.05, { u: 0.3, lift, mirror, turn: 0.12, flip: false });
  }
}

export function roadSign(d: Dress, s: number, side: -1 | 1, text: string): void {
  signAt(d, s, side, signFace(d, `pass:${text}`, () => passSignFace(d.atlas, text)), 2.5, 1.56);
}

export function scenicSign(d: Dress, s: number, side: -1 | 1, text: string, en: string): void {
  const [title = text, ...rest] = text.split(' ');
  signAt(d, s, side, signFace(d, `scenic:${text}`, () => scenicFace(d.atlas, title, rest.join(' '), en)), 2.6, 1.45, { lift: 1.4 });
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

/** Meme billboards every ~`every` m: mountain lines first (minus `skip`, shown elsewhere), then general ones (race-seeded order). */
export function billboards(d: Dress, art: HTMLImageElement[], skip: readonly string[] = [], every = 290): void {
  const { ctx, b, atlas } = d;
  const own = TRACK_BILLBOARDS.mountain.filter((l) => !skip.includes(l));
  const lines = [...ctx.raceRng.shuffle(own), ...ctx.raceRng.shuffle(BILLBOARD_LINES)];
  const at: string[] = [];
  let k = 0;
  for (let s = 200; s < ctx.L.length - 80; s += every * d.rng.range(0.8, 1.2)) {
    const sp = billboardSpot(d, s);
    if (!sp) continue;
    const line = lines[k % lines.length] ?? '';
    const img = art.length ? art[k % art.length] ?? null : null;
    const rect = signFace(d, `bb:${line}:${img?.src ?? ''}`, () => billboardFace(atlas, d.rng.fork(k + 1), line, img));
    k++;
    if (!rect) continue;
    billboard(b.props.at(sp.pos.x, sp.pos.z), b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z,
      towardRiders(d, sp.s, sp.side, 0.42), 8, img ? 4.5 : 4, 2.6, rect);
    at.push(`${Math.round(sp.s)}${sp.side < 0 ? 'L' : 'R'}`);
  }
  d.ctx.log(`billboards: ${k} at s=${at.join(',')}`);
}
