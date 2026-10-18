// Sunset Pass landmarks (env-mountain): the viewpoint pagoda by the summit crest (with the goose
// "already in position"), the capybara hot spring with its meme board, prayer-flag lines on poles.
import { Color, Matrix4, Vector3 } from 'three';
import { buildMist } from '../../env/mountain-waterfall';
import { capybara, goose } from '../../scenery/props/mountain-animals';
import { prayerFlags } from '../../scenery/props/mountain-deco';
import { pagoda } from '../../scenery/props/mountain-pagoda';
import { cylinder, sphere, trs } from '../../kit/shapes';
import { billboard } from '../../scenery/signs/boards';
import type { Spot } from '../../scenery/place';
import type { Dress } from '../dress';
import { hotSpringFace } from './faces';
import { towardRiders } from './signage';

const STONE = [new Color('#9d9387'), new Color('#b3a899'), new Color('#857c72')];
const WATER = new Color('#8fe0d6'), POLE = new Color('#6e4630'), YUZU = new Color('#ffc21a'), WOOD = new Color('#8a5a36');
const m = new Matrix4();

/** Flattest spot for a footprint of radius r near s (both sides unless `side` given, u in [u0, u1]). */
function flatSpot(d: Dress, s: number, r: number, u0: number, u1: number, side?: -1 | 1): Spot | null {
  let best: Spot | null = null, bestSlope = Infinity;
  for (const ds of [0, -10, 10, -20, 20]) {
    for (const sd of side ? [side] : ([-1, 1] as const)) {
      if (d.field.ground(s + ds, sd).detached) continue;
      for (let u = u0; u <= u1; u += 2) {
        const sp = d.place.spot(s + ds, sd, u);
        const slope = d.place.slopeRange({ ...sp, u: u - r }, 2 * r, 2 * r);
        if (slope < bestSlope && !d.place.onRoad(sp.pos.x, sp.pos.z, r + 1)) { best = sp; bestSlope = slope; }
      }
    }
  }
  return best;
}

/** Viewpoint pagoda beside the crest; the goose stands guard on the deck. */
export function pagodaViewpoint(d: Dress, s: number, side: -1 | 1): void {
  const sp = flatSpot(d, s, 5.6, 7.5, 13, side);
  if (!sp) return;
  const { b, rng, place } = d;
  const lo = Math.min(sp.pos.y, d.field.edgeY(sp.s, sp.side) + 0.2);
  place.claim(sp.pos.x, sp.pos.z, 7);
  pagoda(b.props.at(sp.pos.x, sp.pos.z), b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, lo, sp.pos.z, sp.faceRoad, rng);
  // Goose on the deck, front corner nearest the riders, glaring at the road.
  const g = new Vector3(-3.4, 1.0, -3.4).applyMatrix4(trs(sp.pos.x, lo, sp.pos.z, sp.faceRoad, 1, 1, 1, m));
  goose(b.props.at(g.x, g.z), g.x, g.y, g.z, sp.faceRoad, 1.5);
  console.info(`[mountain] pagoda at s=${Math.round(sp.s)} u=${sp.u.toFixed(1)} y=${lo.toFixed(1)}`);
}

/** Capybara hot spring: stone-walled basin, steaming water with floating yuzu, soaking capybaras, board. */
export function hotSpring(d: Dress, s: number, side: -1 | 1): void {
  const R = 4.2;
  const sp = flatSpot(d, s, R + 0.8, 4.5, 12, side);
  if (!sp) return;
  const { b, rng, place, ctx } = d;
  const { x, z } = sp.pos;
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < 6.28; a += 0.5) {
    const y = ctx.groundWorld(x + Math.cos(a) * R, z + Math.sin(a) * R);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  place.claim(x, z, R + 1);
  const top = hi + 0.45, buf = b.props.at(x, z);
  cylinder(buf, trs(x, lo - 0.6, z, 0, R + 0.25, top - lo + 0.6, R + 0.25, m), STONE[0] as Color, 18);
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + rng.range(-0.05, 0.05), r = rng.range(0.55, 0.85);
    sphere(buf, trs(x + Math.cos(a) * (R + 0.1), top + 0.05, z + Math.sin(a) * (R + 0.1), rng.range(0, 6), r * 1.3, r * 0.7, r, m), rng.pick(STONE), 6, 4);
  }
  const wy = top - 0.12;
  cylinder(buf, trs(x, wy - 0.3, z, 0, R - 0.1, 0.32, R - 0.1, m), WATER, 18);
  for (let k = 0; k < 9; k++) {
    const a = rng.range(0, 6.28), r = rng.range(0.4, R - 0.8);
    sphere(buf, trs(x + Math.cos(a) * r, wy + 0.05, z + Math.sin(a) * r, 0, 0.17, 0.15, 0.17, m), YUZU, 6, 4);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rng.range(-0.3, 0.3), r = k === 0 ? 0 : rng.range(1.6, 2.6);
    const cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
    capybara(buf, cx, wy - 0.42, cz, sp.faceRoad + rng.range(-0.8, 0.8), rng, rng.range(1.4, 1.7));
  }
  // Wooden bucket on the rim, steam over the water.
  const bk = new Vector3(x + Math.cos(sp.faceRoad + 2) * (R + 0.9), 0, z + Math.sin(sp.faceRoad + 2) * (R + 0.9));
  cylinder(buf, trs(bk.x, ctx.groundWorld(bk.x, bk.z) - 0.05, bk.z, 0, 0.35, 0.5, 0.35, m), WOOD, 8, 0.9, 1.1);
  const puffs: Vector3[] = [];
  for (let k = 0; k < 14; k++) {
    const a = rng.range(0, 6.28), r = rng.range(0, R - 0.6);
    puffs.push(new Vector3(x + Math.cos(a) * r, wy, z + Math.sin(a) * r));
  }
  buildMist(ctx, puffs, { rise: 6, size: [1.6, 4.2], speed: 0.16, alpha: 0.32, color: '#fff3ef' });
  hotSpringBoard(d, sp);
  console.info(`[mountain] hot spring at s=${Math.round(sp.s)} side ${sp.side} u=${sp.u.toFixed(1)}`);
}

/** The meme board between the road and the pool, facing the riders. */
function hotSpringBoard(d: Dress, sp: Spot): void {
  const [title, l1, l2] = ['卡皮巴拉温泉', '情绪稳定', '包月价'];
  const rect = d.face('hotspring', () => hotSpringFace(d.atlas, d.rng.fork(77), title, l1, l2));
  if (!rect) return;
  const bs = d.place.spot(sp.s - 9, sp.side, 1.6);
  const y = Math.min(bs.pos.y, d.field.edgeY(bs.s, bs.side) + 0.2);
  d.place.claim(bs.pos.x, bs.pos.z, 1.8);
  billboard(d.b.props.at(bs.pos.x, bs.pos.z), d.b.faces.at(bs.pos.x, bs.pos.z), bs.pos.x, y, bs.pos.z, towardRiders(d, bs.s, bs.side, 0.5), 3.4, 2.0, 1.1, rect);
}

/** Prayer-flag lines zig-zagging between wooden poles beyond the edge on `side`. */
export function prayerFlagLine(d: Dress, side: -1 | 1, s0: number, s1: number): void {
  const { place, rng, b } = d;
  let prev: Vector3 | null = null;
  let k = 0;
  for (let s = s0; s <= s1; s += rng.range(14, 19)) {
    const sp = place.spot(s, side, k++ % 2 ? 7.5 : 1.4);
    if (!place.free(sp.pos.x, sp.pos.z, 0.4, 1)) { prev = null; continue; }
    const h = rng.range(4.6, 5.6);
    cylinder(b.props.at(sp.pos.x, sp.pos.z), trs(sp.pos.x, sp.pos.y - 0.3, sp.pos.z, 0, 0.1, h + 0.3, 0.1, m), POLE, 6);
    const top = new Vector3(sp.pos.x, sp.pos.y + h, sp.pos.z);
    if (prev) prayerFlags(b.cloth.at(top.x, top.z), prev, top, 1.0, rng);
    prev = top;
  }
}
