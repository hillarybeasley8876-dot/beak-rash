// Water Town scenery placement: the houses along the lanes, the willows on the canal banks, the
// moored boats, the market stalls, the lantern strings, the archway, the tea house, the far
// roofline and the meme billboards.
import { Vector3, Matrix4, Color } from 'three';
import { BILLBOARD_LINES, TRACK_BILLBOARDS } from '../../../data/memes';
import { stall } from '../../scenery/props/landmarks';
import { lantern, lanternString } from '../../scenery/props/mountain-deco';
import { box, trs } from '../../kit/shapes';
import { billboard, faceQuad, postSign, yawFor } from '../../scenery/signs/boards';
import { billboardFace, roadSignFace } from '../../scenery/signs/faces';
import type { Spot } from '../../scenery/place';
import type { Dress } from '../dress';
import { wtArchway, wtBoat, wtPagoda, wtTeaHouse } from './landmarks';
import { wtFarHouse, wtHouse, wtWillow } from './props';
import { signFace } from './util';

const POST = new Color('#5e3a2a');

/** Yaw for a face looking back down the road at the riders, turned `turn` rad toward the road. */
function towardRiders(d: Dress, s: number, side: -1 | 1, turn = 0.3): number {
  const fr = d.ctx.q.frameVis(s);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1, rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const nx = (-fr.tangent.x / tl) * Math.cos(turn) - side * (fr.right.x / rl) * Math.sin(turn);
  const nz = (-fr.tangent.z / tl) * Math.cos(turn) - side * (fr.right.z / rl) * Math.sin(turn);
  return yawFor(nx, nz);
}

/** Smallest u beyond the drivable edge for a panel of width w so its inner end stays clear. */
function clearU(d: Dress, s: number, side: -1 | 1, yaw: number, w: number, gap = 0.3): number {
  const fr = d.ctx.q.frameVis(s);
  const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const across = Math.abs(Math.cos(yaw) * (fr.right.x / rl) - Math.sin(yaw) * (fr.right.z / rl));
  return (w / 2) * across + gap;
}

/** Rows of white-walled houses behind the lane wall: a front row at the kerb and a back row. */
export function houses(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  let n = 0;
  for (let s = s0 + rng.range(2, 7); s < s1 - 6; s += rng.range(9, 13)) {
    for (const [row, u0, u1] of [[0, 3.4, 4.8], [1, 8.6, 11.5]] as Array<[number, number, number]>) {
      if (row === 1 && !rng.chance(0.75)) continue;
      const u = rng.range(u0, u1);
      const sp = place.spot(s + row * rng.range(3, 7), side, u);
      const w = rng.range(5.5, 8.5) * (row ? 1.15 : 1), dd = rng.range(4.5, 6.5) * (row ? 1.15 : 1);
      const cx = sp.pos.x + Math.sin(sp.faceRoad) * dd * 0.5;
      const cz = sp.pos.z + Math.cos(sp.faceRoad) * dd * 0.5;
      if (place.slopeRange(sp, w, dd) > 2.6 || !place.free(cx, cz, Math.max(w, dd) * 0.6, 4)) continue;
      wtHouse(b.props.at(cx, cz), cx, sp.pos.y - 0.3, cz, sp.faceRoad, rng, { w, d: dd, floors: row ? 2 : undefined });
      n++;
    }
  }
  d.ctx.log(`houses ${Math.round(s0)}-${Math.round(s1)} side ${side}: ${n}`);
}

/** Willows on the far bank of the canal. */
export function willows(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  let n = 0;
  for (let s = s0 + rng.range(2, 9); s < s1 - 4; s += rng.range(9, 15)) {
    const u = rng.range(6.4, 9.5);
    const sp = place.spot(s, side, u);
    const cx = sp.pos.x + Math.sin(sp.faceRoad) * 0.5, cz = sp.pos.z + Math.cos(sp.faceRoad) * 0.5;
    if (!place.free(cx, cz, 2.2, 1.2)) continue;
    wtWillow(b.props.at(cx, cz), cx, sp.pos.y - 0.2, cz, rng, rng.range(0.85, 1.2));
    n++;
  }
  d.ctx.log(`willows ${Math.round(s0)}-${Math.round(s1)} side ${side}: ${n}`);
}

/** Moored black-awning boats on the canal. */
export function boats(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  let n = 0;
  for (let s = s0 + rng.range(3, 10); s < s1 - 5; s += rng.range(11, 19)) {
    const u = rng.range(1.8, 5);
    const sp = place.spot(s, side, u);
    if (!place.free(sp.pos.x, sp.pos.z, 2.4, 0.6)) continue;
    wtBoat(b.boats.at(sp.pos.x, sp.pos.z), sp.pos.x, 0.05, sp.pos.z, sp.along + rng.range(-0.3, 0.3), rng);
    n++;
  }
  d.ctx.log(`boats ${Math.round(s0)}-${Math.round(s1)} side ${side}: ${n}`);
}

/** Market stalls on the town side of the promenade. */
export function stalls(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  let n = 0;
  for (let s = s0 + rng.range(2, 8); s < s1 - 6; s += rng.range(8, 13)) {
    const u = rng.range(2.6, 3.6);
    const sp = place.spot(s, side, u);
    if (!place.free(sp.pos.x, sp.pos.z, 2.4, 1.6)) continue;
    stall(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, rng);
    n++;
  }
  d.ctx.log(`stalls ${Math.round(s0)}-${Math.round(s1)} side ${side}: ${n}`);
}

/** The far roofline: simple houses that fill the horizon behind the town. */
export function roofline(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  let n = 0;
  for (let s = s0; s < s1; s += rng.range(6, 11)) {
    for (const u of [rng.range(16, 24), rng.range(28, 40)]) {
      const sp = place.spot(s, side, u);
      if (sp.pos.y < 0.4) continue;
      if (!place.free(sp.pos.x, sp.pos.z, 4, 3)) continue;
      wtFarHouse(b.far.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad + Math.PI, rng, rng.range(0.9, 1.4));
      n++;
    }
  }
  d.ctx.log(`roofline ${Math.round(s0)}-${Math.round(s1)} side ${side}: ${n}`);
}

/** A string of red lanterns across the road, hung between two posts. */
export function lanternLine(d: Dress, s: number): void {
  const { place, rng, b } = d;
  const l = place.spot(s, -1, 0.9), r = place.spot(s, 1, 0.9);
  if (!place.claim(l.pos.x, l.pos.z, 0.5) || !place.claim(r.pos.x, r.pos.z, 0.5)) return;
  // The string hangs from the road's height, not the ground: on the quay side the ground is below
  // the road (the water) and the lanterns would hang into the lane.
  const roadY = d.ctx.q.frameVis(s).pos.y;
  const top = roadY + 5.2;
  for (const p of [l, r]) {
    const base = Math.min(p.pos.y, d.field.edgeY(s, p.side));
    const px = p.pos.x + Math.sin(p.faceRoad) * 0.5, pz = p.pos.z + Math.cos(p.faceRoad) * 0.5;
    box(b.props.at(px, pz), trs(px, (base + top) / 2, pz, p.faceRoad, 0.16, Math.max(0.5, top - base), 0.16, new Matrix4()), POST);
    lantern(b.props.at(px, pz), b.glow.at(px, pz), px, top - 0.1, pz, rng, 1.1);
  }
  const a = new Vector3(l.pos.x, top - 0.2, l.pos.z);
  const c = new Vector3(r.pos.x, top - 0.2, r.pos.z);
  lanternString(b.props.at(a.x, a.z), b.glow.at(a.x, a.z), b.cloth.at(a.x, a.z), a, c, 0.9, 2.6, rng);
}

/** The memorial archway over the road. */
export function archway(d: Dress, s: number): void {
  const { b, atlas, rng } = d;
  const fr = d.ctx.q.frameVis(s);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1;
  const yaw = Math.atan2(-fr.tangent.x / tl, -fr.tangent.z / tl) + Math.PI;
  const cx = fr.pos.x, cz = fr.pos.z, cy = fr.pos.y;
  wtArchway(b.props.at(cx, cz), cx, cy, cz, yaw, rng);
  // The name plaque on the front face.
  const rect = signFace(d, 'paifang', () => roadSignFace(atlas, '水乡第一桥'));
  if (!rect) return;
  const off = 0.42;
  const px = cx + Math.sin(yaw) * off, pz = cz + Math.cos(yaw) * off;
  faceQuad(b.faces.at(px, pz), new Vector3(px, cy + 4.35, pz), yaw, 1.7, 0.75, rect);
}

/** The tea house beside the road. */
export function teahouse(d: Dress, s: number, side: -1 | 1): void {
  const { place, b, atlas, rng } = d;
  const sp = place.spot(s, side, 4.2);
  const cx = sp.pos.x + Math.sin(sp.faceRoad) * 3, cz = sp.pos.z + Math.cos(sp.faceRoad) * 3;
  if (!place.free(cx, cz, 6, 3)) return;
  wtTeaHouse(b.props.at(cx, cz), cx, sp.pos.y - 0.3, cz, sp.faceRoad, rng);
  const rect = signFace(d, 'teahouse', () => roadSignFace(atlas, '茶'));
  if (!rect) return;
  const off = 3.4;
  const fx = cx + Math.sin(sp.faceRoad) * off, fz = cz + Math.cos(sp.faceRoad) * off;
  faceQuad(b.faces.at(fx, fz), new Vector3(fx, sp.pos.y + 4.35, fz), sp.faceRoad, 1.5, 1.1, rect);
}

/** The distant pagoda on the plain. */
export function pagoda(d: Dress, s: number, x: number): void {
  const fr = d.ctx.q.frameVis(s);
  const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const wx = fr.pos.x + (fr.right.x / rl) * x, wz = fr.pos.z + (fr.right.z / rl) * x;
  const p = d.place.world(wx, wz);
  if (!d.place.free(p.x, p.z, 8, 2)) return;
  wtPagoda(d.b.far.at(p.x, p.z), p.x, p.y, p.z, d.rng.range(0, 1), d.rng, 1.5);
}

/** A roadside sign board with a track line on it. */
export function wtSign(d: Dress, s: number, side: -1 | 1, text: string): void {
  const { place, b, atlas } = d;
  const w = 2.2, h = 1.3;
  const yaw = towardRiders(d, s, side, 0.25);
  const u = Math.max(0.9, clearU(d, s, side, yaw, w + 0.1));
  const sp = place.spot(s, side, u);
  if (!place.claim(sp.pos.x, sp.pos.z, 0.8)) return;
  const rect = signFace(d, `sign:${text}`, () => roadSignFace(atlas, text));
  if (!rect) return;
  postSign(b.props.at(sp.pos.x, sp.pos.z), b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, yaw, w, h, 1.4, rect);
}

/** Meme billboards along the road: the track's own lines first, then the shared ones. */
export function billboards(d: Dress, art: HTMLImageElement[], every = 170): void {
  const { ctx, place, rng, b, atlas } = d;
  const lines = ctx.raceRng.shuffle([...TRACK_BILLBOARDS.watertown, ...BILLBOARD_LINES]);
  const w = 9, h = 5;
  let k = 0;
  for (let s = 120; s < ctx.L.length - 60; s += every * rng.range(0.8, 1.25)) {
    let spot: Spot | null = null;
    for (const ds of [0, 20, -20, 40]) {
      for (const side of rng.shuffle([-1, 1] as const)) {
        const ss = s + ds;
        if (d.field.ground(ss, side).detached) continue;
        const yaw = towardRiders(d, ss, side, 0.75);
        const u = clearU(d, ss, side, yaw, w + 0.5) + rng.range(0, 2.5);
        const sp = place.spot(ss, side, u);
        if (sp.pos.y < 0.3 || Math.abs(sp.pos.y - d.field.edgeY(ss, side)) > 3) continue;
        if (!place.free(sp.pos.x, sp.pos.z, w / 2 + 0.4, 2.5)) continue;
        spot = sp;
        break;
      }
      if (spot) break;
    }
    if (!spot) continue;
    const line = lines[k % lines.length] ?? '小桥流水人家';
    const img = art.length ? art[k % art.length] ?? null : null;
    const rect = d.face(`bb:${line}:${img?.src ?? ''}`, () => billboardFace(atlas, rng.fork(k + 1), line, img));
    k++;
    if (!rect) continue;
    const yaw = towardRiders(d, spot.s, spot.side, 0.75);
    billboard(b.props.at(spot.pos.x, spot.pos.z), b.faces.at(spot.pos.x, spot.pos.z), spot.pos.x, spot.pos.y, spot.pos.z, yaw, w,
      img ? h + 0.6 : h, 3, rect);
  }
  d.ctx.log(`billboards: ${k}`);
}
