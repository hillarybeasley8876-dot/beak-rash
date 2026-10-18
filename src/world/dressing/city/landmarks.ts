// City landmarks that claim their footprint before the street walls go up: the 24 h convenience
// store, subway entrances, the calling-card mural wall and the roundabout monument (a giant
// pelican-on-a-bicycle statue on a neon-ringed plinth in a flower bed).
import { Color, Matrix4, Vector3 } from 'three';
import { STREET } from '../../layouts/city';
import { box, cylinder, trs } from '../../kit/shapes';
import { convenienceStore, subwayEntrance } from '../../scenery/props/city-shops';
import { faceQuad } from '../../scenery/signs/boards';
import type { City } from './city';
import { metroFace, muralFace, storeFace } from './faces';
import { MURAL } from './lines';
import { sign } from './neon';
import { statue } from '../../scenery/props/city-statue';
import { hdr } from './util';

const m = new Matrix4();
const ahead = (p: Vector3, yaw: number, d: number): Vector3 => new Vector3(p.x - Math.sin(yaw) * d, p.y, p.z - Math.cos(yaw) * d);

/** Convenience store lot at (s, side): claims it so the street wall leaves the gap. */
export function storeAt(c: City, s: number, side: -1 | 1): void {
  const d = c.d, place = d.place;
  const sp = place.spot(s, side, 2.2);
  const w = 10, dd = 11;
  if (!c.lots.fits(sp.pos.x, sp.pos.z, sp.faceRoad, w, dd)) return;
  c.lots.claim(sp.pos.x, sp.pos.z, sp.faceRoad, w, dd);
  const slot = convenienceStore(c.cb.body.at(sp.pos.x, sp.pos.z), d.b.props.at(sp.pos.x, sp.pos.z), d.b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, STREET, sp.pos.z, sp.faceRoad, w, dd, d.rng);
  const rect = d.face('city:store', () => storeFace(c.neonAtlas));
  if (rect) sign(c.cb.neon.at(sp.pos.x, sp.pos.z), ahead(slot.pos, slot.yaw, 0.02), slot.yaw, slot.w, slot.h, rect, 1.3);
}

/** Subway entrance just behind the kerb (stairs run along the street). */
export function subwayAt(c: City, s: number, side: -1 | 1): void {
  const d = c.d, place = d.place;
  const sp = place.spot(s, side, 0.7);
  if (!c.lots.fits(sp.pos.x, sp.pos.z, sp.faceRoad, 8.6, 3.2, 0.2)) return;
  c.lots.claim(sp.pos.x, sp.pos.z, sp.faceRoad, 8.6, 3.2);
  const slots = subwayEntrance(d.b.props.at(sp.pos.x, sp.pos.z), d.b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, STREET, sp.pos.z, sp.faceRoad);
  const rect = d.face('city:metro', () => metroFace(c.neonAtlas));
  if (!rect) return;
  for (const sl of slots) sign(c.cb.neon.at(sl.pos.x, sl.pos.z), ahead(sl.pos, sl.yaw, 0.02), sl.yaw, sl.w, sl.h, rect, 1.25);
}

/** Calling-card mural on a blank firewall facing the street, lit by two floodlights. */
export function muralAt(c: City, s: number, side: -1 | 1): void {
  const d = c.d, place = d.place;
  const sp = place.spot(s, side, 2.4);
  const W = 17, H = 10, T = 1.2;
  if (!c.lots.fits(sp.pos.x, sp.pos.z, sp.faceRoad, W, T)) return;
  c.lots.claim(sp.pos.x, sp.pos.z, sp.faceRoad, W, T);
  const yaw = sp.faceRoad;
  const body = c.cb.body.at(sp.pos.x, sp.pos.z);
  const centre = ahead(new Vector3(sp.pos.x, STREET + H / 2, sp.pos.z), yaw, -T / 2);
  body.setAux(0);
  box(body, trs(centre.x, centre.y, centre.z, yaw, W, H, T, m), new Color('#3b2f3f'));
  const rect = d.face('city:mural', () => muralFace(d.atlas, d.rng.fork(0x3a1), MURAL.title, MURAL.body, MURAL.sign));
  if (rect) faceQuad(d.b.faces.at(sp.pos.x, sp.pos.z), ahead(new Vector3(sp.pos.x, STREET + H / 2 + 0.3, sp.pos.z), yaw, 0.03), yaw, W - 1.2, (W - 1.2) / 2, rect);
  // Floodlights on short arms over the top edge.
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  for (const k of [-0.3, 0.3]) {
    const p = ahead(new Vector3(sp.pos.x + rx * k * W, STREET + H + 0.15, sp.pos.z + rz * k * W), yaw, 0.6);
    box(d.b.props.at(p.x, p.z), trs(p.x, p.y, p.z, yaw, 0.6, 0.3, 1.2, m), new Color('#1a1b22'));
    box(d.b.glow.at(p.x, p.z), trs(p.x, p.y - 0.16, p.z - 0, yaw, 0.5, 0.04, 0.5, m), hdr('#fff1d0', 2.4));
  }
}

/** Roundabout island inside the hairpin: kerb ring, flower bed, plinth with a neon ring, statue. */
export function roundaboutAt(c: City, s: number, x: number): void {
  const { ctx, b } = c.d;
  const p = ctx.q.toWorld(s, x, 0, new Vector3());
  const R = 15;
  c.lots.claimDisc(p.x, p.z, R + 2);
  const y = STREET;
  cylinder(b.props.at(p.x, p.z), trs(p.x, y, p.z, 0, R, 0.35, R, m), new Color('#9a98a6'), 40);
  cylinder(b.props.at(p.x, p.z), trs(p.x, y, p.z, 0, R - 0.5, 0.5, R - 0.5, m), new Color('#2f6b3a').multiplyScalar(1.3), 40);
  const rng = c.d.rng.fork(0x40d);
  for (let i = 0; i < 70; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(5, R - 1.2);
    const col = rng.pick([hdr('#ff5fa2', 1.6), hdr('#ffe600', 1.5), hdr('#f4f1ea', 1.5), hdr('#b46bff', 1.5)]);
    box(b.props.at(p.x, p.z), trs(p.x + Math.cos(a) * r, y + 0.62, p.z + Math.sin(a) * r, a, 0.5, 0.25, 0.5, m), col);
  }
  cylinder(b.props.at(p.x, p.z), trs(p.x, y, p.z, 0, 3.2, 4.2, 3.2, m), new Color('#c9c5bb'), 16);
  cylinder(b.props.at(p.x, p.z), trs(p.x, y + 4.2, p.z, 0, 3.6, 0.4, 3.6, m), new Color('#e5191c'), 16);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    box(b.glow.at(p.x, p.z), trs(p.x + Math.cos(a) * 3.66, y + 4.4, p.z + Math.sin(a) * 3.66, -a, 0.18, 0.12, 0.75, m), hdr(i % 2 ? '#22e8ff' : '#ff2d95', 2.6));
  }
  statue(b.props, p.x, y + 4.6, p.z, ctx.q.frameVis(s).tangent, 3.3);
}
