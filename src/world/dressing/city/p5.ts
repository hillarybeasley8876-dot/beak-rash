// P5 street presence beyond the canyon: big red/black P5 boards on legs facing the road (on the outside
// of every corner where the camera looks, then every ~170 m), giant P5 banner pylons framing the
// boulevard, the scramble and the way into the sprint, and red/black hazard stripes at the crest jump
// and tunnel portals.
import { Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import { tunnelHalfW, CROWN } from '../../features/tunnel';
import { box, trs } from '../../kit/shapes';
import { CPAL } from '../../scenery/props/city-kit';
import type { AtlasRect, SignAtlas } from '../../scenery/signs/atlas';
import { cell } from '../../scenery/signs/faces';
import type { City } from './city';
import { mounted, neonFrame, P5_ASPECT, p5Rect } from './canyon';
import { sign } from './neon';
import { p5BladeFace } from './neon-faces';
import { ahead, hdr, mount, signInset, towardRiders, zoneAt, zoneRuns } from './util';

const m = new Matrix4();

/** Zones without street boards: narrow, walled, elevated, or already full of signs. */
const NO_BOARDS = ['arcade', 'underpass', 'tunnel', 'ramp', 'expressway', 'crest', 'drop', 'bridge', 'sprint', 'start', 'finish'];
const BOARD = { w: 6.2, turn: 0.9, lift: 2.2 };
const BANNERS = ['暴力鹈鹕', '霓虹夜城'];
const PYLON = { w: 5, h: 15, base: 4.5 };

/** One P5 board on two legs at (s, side); false when there is no room. */
function boardAt(c: City, s: number, side: -1 | 1, n: number): boolean {
  const { ctx, place } = c.d;
  const h = BOARD.w * P5_ASPECT;
  const mt = mount(c, s, side, signInset(BOARD.w, BOARD.turn));
  if (!mt || mt.onDeck || !place.free(mt.sp.pos.x, mt.sp.pos.z, 1.2, 0.2)) return false;
  const yaw = towardRiders(ctx, s, side, BOARD.turn);
  const centre = new Vector3(mt.sp.pos.x, mt.y + BOARD.lift + h / 2, mt.sp.pos.z);
  const buf = c.cb.body.at(centre.x, centre.z).setAux(0);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  for (const k of [-0.38, 0.38]) box(buf, trs(centre.x + rx * k * BOARD.w, mt.y + (BOARD.lift + 0.2) / 2, centre.z + rz * k * BOARD.w, yaw, 0.14, BOARD.lift + 0.2, 0.14, m), CPAL.trim);
  const rect = p5Rect(c, n + 2);
  if (rect) mounted(c, centre, yaw, BOARD.w, h, rect, false, n);
  return true;
}

/** Boards on the outside of each corner (seen through the turn), then one every ~170 m with alternating sides. */
export function streetP5Boards(c: City): number {
  const { ctx } = c.d;
  let n = 0;
  const placed: number[] = [];
  for (const [s0, s1] of zoneRuns(ctx, ['corner', 'chicane', 'hairpin'])) {
    const sm = (s0 + s1) / 2, outside: -1 | 1 = ctx.q.frameVis(sm).curvature > 0 ? -1 : 1;
    for (const ds of [0, 8, -8, 16, -16]) if (boardAt(c, sm + ds, outside, n)) { placed.push(sm + ds); n++; break; }
  }
  let side: -1 | 1 = 1;
  for (let s = 120; s < ctx.L.length - 120; s += 170) {
    for (let tries = 0; tries < 6; tries++) {
      const ss = s + tries * 9;
      side = side < 0 ? 1 : -1;
      if (NO_BOARDS.includes(zoneAt(ctx, ss)) || placed.some((p) => Math.abs(p - ss) < 60)) continue;
      if (boardAt(c, ss, side, n)) { n++; break; }
    }
  }
  return n;
}

/** Giant vertical P5 banner on a black steel frame (5 x 15 m face from 4.5 m up), neon-framed in red. */
function pylonAt(c: City, s: number, side: -1 | 1, k: number): boolean {
  const { ctx, place, rng } = c.d;
  const mt = mount(c, s, side, 2.8);
  if (!mt || mt.onDeck) return false;
  const yaw = towardRiders(ctx, s, side, 0.75);
  const legs = [-0.45, 0.45].map((f) => ahead(mt.sp.pos, yaw - Math.PI / 2, f * PYLON.w));
  if (!legs.every((l) => place.free(l.x, l.z, 0.4, 0.1))) return false;
  const top = PYLON.base + PYLON.h + 0.6;
  const buf = c.cb.body.at(mt.sp.pos.x, mt.sp.pos.z).setAux(0);
  for (const l of legs) box(buf, trs(l.x, mt.y + top / 2, l.z, yaw, 0.32, top, 0.32, m), CPAL.trim);
  const text = BANNERS[k % BANNERS.length] ?? '';
  const rect = c.d.face(`pylon:${text}`, () => p5BladeFace(c.neonAtlas, rng.fork(0x9b + k), text));
  const centre = new Vector3(mt.sp.pos.x, mt.y + PYLON.base + PYLON.h / 2, mt.sp.pos.z);
  if (!rect) return false;
  mounted(c, centre, yaw, PYLON.w, PYLON.h, rect, false, k);
  neonFrame(c, centre, yaw, PYLON.w + 0.5, PYLON.h + 0.5, hdr('#ff1e3c', 2.4));
  return true;
}

/** Two pylons on the boulevard, two at the scramble corners, one on the avenue into the sprint. */
export function p5Pylons(c: City): number {
  const { ctx } = c.d;
  const at = (name: string): [number, number] | null => {
    const r = zoneRuns(ctx, [name])[0];
    return r ? [r[0], r[1]] : null;
  };
  const spots: Array<[number, -1 | 1]> = [];
  const blvd = at('boulevard'), scr = at('scramble'), approach = zoneRuns(ctx, ['avenue'])[1];
  if (blvd) spots.push([blvd[0] + 70, 1], [blvd[0] + 205, -1]);
  if (scr) spots.push([(scr[0] + scr[1]) / 2 - 34, -1], [(scr[0] + scr[1]) / 2 + 30, 1]);
  // The sprint's sides are full of canyon scaffolds: its pylon stands on the avenue leading into it.
  if (approach) spots.push([approach[1] - 30, -1]);
  let n = 0;
  spots.forEach(([s, side], k) => {
    const sides: Array<-1 | 1> = [side, side < 0 ? 1 : -1];
    if (sides.some((sd) => [0, 7, -7, 14, -14, 21].some((ds) => pylonAt(c, s + ds, sd, k)))) n++;
    else console.warn(`[track] city P5 pylon at s=${Math.round(s)} skipped (no room behind the kerb)`);
  });
  return n;
}

/** Red/black diagonal hazard stripes, `wpx` x `hpx` px (stripes run at 40°). */
function hazardFace(atlas: SignAtlas, wpx: number, hpx: number): AtlasRect | null {
  return cell(atlas, wpx, hpx, (g, w, h) => {
    g.fillStyle = '#0b0b0f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e5191c';
    const band = Math.min(w, h) * 0.38, run = Math.min(w, h) * 0.84;
    for (let t = -Math.max(w, h); t < w + h; t += band * 2) {
      g.beginPath();
      g.moveTo(t, h); g.lineTo(t + run, 0); g.lineTo(t + run + band, 0); g.lineTo(t + band, h);
      g.closePath();
      g.fill();
    }
  });
}

/** Hazard panels inside both tunnel portals (band under the vault + wall posts) and parapet stripes before the crest jump. */
export function hazardStripes(c: City, crest: number | null, rng: Rng): number {
  const { ctx, field } = c.d;
  const { q } = ctx;
  const tall = c.d.face('hazard:tall', () => hazardFace(c.neonAtlas, 48, 256));
  const wide = c.d.face('hazard:wide', () => hazardFace(c.neonAtlas, 256, 40));
  if (!tall || !wide) return 0;
  const p = new Vector3();
  let n = 0;
  for (const f of ctx.L.features.filter((ft) => ft.kind === 'tunnel')) {
    // The portal opening is as wide as the cutting, so the stripes hang under the vault just inside
    // both portals (wide band, facing the riders) with tall panels flush on the walls beside it.
    const halfW = tunnelHalfW(field, f);
    for (const s of [f.s0 + 3, f.s1 - 4]) {
      q.toWorld(s, 0, CROWN - 1.3, p);
      sign(c.cb.neon.at(p.x, p.z), p, towardRiders(ctx, s, 1, 0), 6.4, 1.0, wide, 1.2);
      const fr = q.frameVis(s);
      for (const side of [-1, 1] as const) {
        // Flush on the tiled wall (facing the road): nothing stands inside the drivable shoulder.
        q.toWorld(s, side * (halfW - 0.08), 1.9, p);
        sign(c.cb.neon.at(p.x, p.z), p, Math.atan2(fr.right.x * side, fr.right.z * side), 1.6, 3.0, tall, 1.1);
      }
      n += 3;
    }
  }
  if (crest === null) return n;
  for (let s = crest - 64; s < crest - 4; s += 6 + rng.range(0, 1)) {
    for (const side of [-1, 1] as const) {
      if (q.edgeKindAt(s, side) !== 'parapet') continue;
      const fr = q.frameVis(s);
      q.toWorld(s, side * (field.bound(s, side) - 0.02), 0.45, p);
      const yaw = Math.atan2(fr.right.x * side, fr.right.z * side);
      sign(c.cb.neon.at(p.x, p.z), p, yaw, 2.4, 0.38, wide, 1.0);
      n++;
    }
  }
  return n;
}
