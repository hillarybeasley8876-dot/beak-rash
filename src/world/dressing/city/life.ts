// City life after the buildings are up: animal pedestrians waiting at the crossings, the scramble
// corners, bus stops and subway entrances (gently bobbing, always behind the kerb), night-market
// food stalls in the roomy plazas, the arcade's market gates with lantern strings, and overhead
// cables strung across the narrow streets.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import { box, trs } from '../../kit/shapes';
import { pedestrian } from '../../scenery/props/city-people';
import { foodStall } from '../../scenery/props/city-shops';
import type { City } from './city';
import { gateFace } from './faces';
import { fasciaFace } from './neon-faces';
import { board, sign } from './neon';
import { catenary, hdr, mount, segment, zoneRuns } from './util';

const m = new Matrix4();
const CABLE = new Color('#0b0b10');
const LANTERNS = [hdr('#ff3b2f', 2.4), hdr('#ff8a1f', 2.4), hdr('#ffd23d', 2.2)];
const ahead = (p: Vector3, yaw: number, d: number): Vector3 => new Vector3(p.x - Math.sin(yaw) * d, p.y, p.z - Math.cos(yaw) * d);

/** n pedestrians around (s ± ds, side) at u0..u1 beyond the kerb, facing the road. Returns how many. */
export function crowd(c: City, rng: Rng, s: number, side: -1 | 1, n: number, ds: number, u0: number, u1: number, umbrella = 0.55): number {
  let placed = 0;
  for (let i = 0; i < n * 3 && placed < n; i++) {
    const mt = mount(c, s + rng.range(-ds, ds), side, rng.range(u0, u1));
    if (!mt || mt.onDeck) continue;
    const { sp } = mt;
    // One pedestrian per 1 m occupancy cell (dense crowds), never inside a lot or on the road.
    if (c.lots.has(sp.pos.x, sp.pos.z) || !c.d.place.free(sp.pos.x, sp.pos.z, 0.05, 0.3)) continue;
    pedestrian(c.d.b.crowd.at(sp.pos.x, sp.pos.z), sp.pos.x, mt.y, sp.pos.z, sp.faceRoad + rng.range(-0.6, 0.6), rng, umbrella);
    placed++;
  }
  return placed;
}

/** Waiting crowds: crossings, the scramble corners, bus stops, subway entrances, a few strollers. */
export function crowds(c: City, cross: number[], scramble: number[], stops: Array<{ s: number; side: -1 | 1 }>, subways: Array<{ s: number; side: -1 | 1 }>): number {
  const rng = c.d.rng.fork(0x9e0b);
  let n = 0;
  for (const s of cross) for (const side of [-1, 1] as const) n += crowd(c, rng, s, side, rng.int(4, 8), 3.5, 0.45, 1.9);
  for (const s of scramble) {
    for (const ds of [-22, 22]) for (const side of [-1, 1] as const) n += crowd(c, rng, s + ds, side, rng.int(12, 18), 6, 0.45, 3.6, 0.65);
  }
  for (const st of stops) n += crowd(c, rng, st.s, st.side, rng.int(2, 4), 2, 0.9, 1.5, 0.2);
  for (const sw of subways) n += crowd(c, rng, sw.s - 5, sw.side, rng.int(2, 4), 2.5, 0.4, 2.0);
  for (const [s0, s1] of zoneRuns(c.d.ctx, ['start', 'boulevard', 'riverside', 'avenue', 'sprint', 'finish'])) {
    for (let s = s0 + rng.range(10, 40); s < s1 - 10; s += rng.range(35, 60)) n += crowd(c, rng, s, rng.chance(0.5) ? -1 : 1, rng.int(1, 3), 1.5, 0.6, 2.2);
  }
  return n;
}

/** Food stall pairs (烧烤 + 奶茶) wherever the strip behind the kerb is deep enough. */
export function stalls(c: City): number {
  const rng = c.d.rng.fork(0x57a1);
  const { d } = c;
  let n = 0;
  for (const [s0, s1] of zoneRuns(d.ctx, ['start', 'boulevard', 'scramble', 'riverside', 'avenue', 'finish'])) {
    for (let s = s0 + rng.range(12, 30); s < s1 - 8; s += rng.range(55, 90)) {
      const side: -1 | 1 = rng.chance(0.5) ? -1 : 1;
      (['bbq', 'tea'] as const).forEach((kind, i) => {
        for (const u of [1.6, 2.4, 3.2, 4.2]) {
          const mt = mount(c, s + i * 3.2, side, u);
          if (!mt || mt.onDeck || !d.place.free(mt.sp.pos.x, mt.sp.pos.z, 1.1, 0.4)) continue;
          const { sp } = mt;
          const slot = foodStall(d.b.props.at(sp.pos.x, sp.pos.z), d.b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, mt.y, sp.pos.z, sp.faceRoad, kind, rng);
          const text = kind === 'bbq' ? '烧烤' : '奶茶';
          const rect = d.face(`stall:${kind}`, () => fasciaFace(c.neonAtlas, rng.fork(i + 7), text, false));
          if (rect) sign(c.cb.neon.at(sp.pos.x, sp.pos.z), ahead(slot.pos, slot.yaw, 0.02), slot.yaw, slot.w, slot.h, rect, 2.2, 0, s * 0.1);
          n++;
          break;
        }
      });
    }
  }
  return n;
}

/** Neon market gate spanning the street at s (posts just behind both kerbs). */
export function marketGate(c: City, s: number, title: string, sub: string): void {
  const { d } = c;
  const l = d.place.spot(s, -1, 0.15), r = d.place.spot(s, 1, 0.15);
  const y = d.field.edgeY(s, -1);
  for (const p of [l, r]) box(d.b.props.at(p.pos.x, p.pos.z), trs(p.pos.x, y + 3.6, p.pos.z, p.along, 0.36, 7.2, 0.36, m), new Color('#e5191c'));
  const mid = new Vector3().lerpVectors(l.pos, r.pos, 0.5).setY(y + 7.6);
  const span = l.pos.distanceTo(r.pos);
  const toRiders = d.place.spot(s, 1, 0).along + Math.PI;
  board(c, mid, toRiders, span + 0.8, span / 5 + 0.3, 0.4);
  const rect = d.face(`gate:${title}`, () => gateFace(c.neonAtlas, title, sub));
  if (!rect) return;
  for (const yaw of [toRiders, toRiders + Math.PI]) sign(c.cb.neon.at(mid.x, mid.z), ahead(mid, yaw, 0.22), yaw, span, span / 5, rect, 2.4);
}

/** Paper lanterns on zig-zag strings across the street between s0 and s1. */
export function lanternStrings(c: City, s0: number, s1: number): void {
  const { d } = c;
  const rng = d.rng.fork(0x1a7e);
  for (let s = s0 + 5; s < s1 - 5; s += rng.range(8, 11)) {
    const a = d.place.spot(s, -1, 0.3).pos, b = d.place.spot(s + rng.range(-4, 4), 1, 0.3).pos;
    const y = d.field.edgeY(s, -1);
    a.y = y + rng.range(5.8, 6.8);
    b.y = y + rng.range(5.8, 6.8);
    const pts = catenary(a, b, 1.0, 10);
    for (let i = 0; i < pts.length - 1; i++) segment(d.b.far.at(a.x, a.z), pts[i] as Vector3, pts[i + 1] as Vector3, 0.035, CABLE);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i] as Vector3;
      box(d.b.far.at(p.x, p.z), trs(p.x, p.y - 0.12, p.z, 0, 0.16, 0.1, 0.16, m), CABLE);
      box(d.b.glow.at(p.x, p.z), trs(p.x, p.y - 0.42, p.z, i * 0.7, 0.34, 0.46, 0.34, m), rng.pick(LANTERNS));
    }
  }
}

/** Facade point on `side` near s (first lot cell beyond the kerb), or null over open ground. */
function facade(c: City, s: number, side: -1 | 1): Vector3 | null {
  for (let u = 0.5; u < 9; u += 0.5) {
    const p = c.d.place.spot(s, side, u).pos;
    if (c.lots.has(p.x, p.z)) return c.d.place.spot(s, side, u - 0.3).pos;
  }
  return null;
}

/** Bundles of dark cables strung between facades across the narrow streets. */
export function cables(c: City): number {
  const { d } = c;
  const rng = d.rng.fork(0xcab1);
  let n = 0;
  for (const [s0, s1] of zoneRuns(d.ctx, ['boulevard', 'corner', 'street', 'chicane', 'avenue', 'sprint'])) {
    for (let s = s0 + rng.range(8, 20); s < s1 - 8; s += rng.range(22, 40)) {
      const a = facade(c, s, -1), b = facade(c, s + rng.range(-8, 8), 1);
      if (!a || !b) continue;
      const y = d.field.edgeY(s, -1), h = rng.range(7, 9.5);
      for (let k = 0; k < rng.int(1, 4); k++) {
        const pa = a.clone().setY(y + h + k * 0.35), pb = b.clone().setY(y + h + rng.range(-0.6, 0.6) + k * 0.35);
        const pts = catenary(pa, pb, rng.range(0.6, 1.4), 8);
        for (let i = 0; i < pts.length - 1; i++) segment(d.b.far.at(pa.x, pa.z), pts[i] as Vector3, pts[i + 1] as Vector3, 0.04, CABLE);
      }
      n++;
    }
  }
  return n;
}
