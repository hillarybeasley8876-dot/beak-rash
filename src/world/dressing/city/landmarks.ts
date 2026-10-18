// City landmarks that claim their footprint before the street walls go up: the 24 h convenience
// store, subway entrances, the calling-card mural wall and the roundabout monument (a giant
// pelican-on-a-bicycle statue on a neon-ringed plinth in a flower bed).
import { Color, Matrix4, Vector3 } from 'three';
import { STREET } from '../../layouts/city';
import type { Rng } from '../../../core/rng';
import { box, cylinder, sphere, trs } from '../../kit/shapes';
import { convenienceStore, subwayEntrance } from '../../scenery/props/city-shops';
import { faceQuad } from '../../scenery/signs/boards';
import type { AuxBuf } from './batch';
import type { City } from './city';
import { metroFace, muralFace, storeFace } from './faces';
import { MURAL } from './lines';
import { sign } from './neon';
import { p5Face } from './neon-faces';
import { statue } from '../../scenery/props/city-statue';
import { ahead, hdr } from './util';

const m = new Matrix4();

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
  // Low hedge ring and three rings of flower beds (unlit so they keep their colour at night).
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    box(b.props.at(p.x, p.z), trs(p.x + Math.cos(a) * (R - 1.3), y + 0.8, p.z + Math.sin(a) * (R - 1.3), -a, 0.9, 0.6, 3.3, m), new Color('#1f4a2a'));
  }
  flowerBeds(c.cb.lit.at(p.x, p.z), p, y, c.d.rng.fork(0xf10));
  cylinder(b.props.at(p.x, p.z), trs(p.x, y, p.z, 0, 3.2, 4.2, 3.2, m), new Color('#c9c5bb'), 16);
  cylinder(b.props.at(p.x, p.z), trs(p.x, y + 4.2, p.z, 0, 3.6, 0.4, 3.6, m), new Color('#e5191c'), 16);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    box(b.glow.at(p.x, p.z), trs(p.x + Math.cos(a) * 3.66, y + 4.4, p.z + Math.sin(a) * 3.66, -a, 0.18, 0.12, 0.75, m), hdr(i % 2 ? '#22e8ff' : '#ff2d95', 2.6));
  }
  statue(c.cb.lit.at(p.x, p.z), p.x, y + 4.6, p.z, ctx.q.frameVis(s).tangent, 5);
  // Three warm uplights on the plinth rim aimed at the statue.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5, lx = p.x + Math.cos(a) * 2.9, lz = p.z + Math.sin(a) * 2.9;
    box(b.props.at(lx, lz), trs(lx, y + 4.75, lz, -a, 0.5, 0.35, 0.5, m), new Color('#1a1b22'));
    box(b.glow.at(lx, lz), trs(lx, y + 4.95, lz, -a, 0.4, 0.04, 0.4, m), hdr('#ffd9a0', 2.6));
  }
  plaque(c, s, p, y);
}

/** Flower beds: three rings of low toon mounds dotted with small self-lit blossoms. */
function flowerBeds(lit: AuxBuf, p: Vector3, y: number, rng: Rng): void {
  const GREEN = new Color('#2f7a3c'), FLOWERS = [new Color('#ff5fa2'), new Color('#ffe600'), new Color('#f4f1ea')];
  for (let ring = 0; ring < 3; ring++) {
    const r = 6 + ring * 2.4, n = 10 + ring * 3;
    for (let i = 0; i < n; i++) {
      const a = ((i + ring * 0.5) / n) * Math.PI * 2, mx = p.x + Math.cos(a) * r, mz = p.z + Math.sin(a) * r;
      lit.setAux(5, 0.12);
      sphere(lit, trs(mx, y + 0.42, mz, -a, 1.0, 0.32, 0.8, m), GREEN, 10, 5);
      lit.setAux(5, 0.55);
      for (let k = 0; k < 5; k++) {
        const fa = rng.range(0, Math.PI * 2), fr = rng.range(0.1, 0.7);
        box(lit, trs(mx + Math.cos(fa) * fr, y + 0.66 + rng.range(0, 0.06), mz + Math.sin(fa) * fr * 0.8, fa, 0.13, 0.08, 0.13, m), FLOWERS[ring] ?? GREEN);
      }
    }
  }
  lit.setAux(0);
}

/** P5 plaque on the drum, facing the road at s. */
function plaque(c: City, s: number, p: Vector3, y: number): void {
  const road = c.d.ctx.q.toWorld(s, 0, 0, new Vector3());
  const dx = road.x - p.x, dz = road.z - p.z, l = Math.hypot(dx, dz) || 1;
  const yaw = Math.atan2(-dx / l, -dz / l);
  const rect = c.d.face('roof:暴力鹈鹕:true', () => p5Face(c.neonAtlas, c.d.rng.fork(0x9a1), '暴力鹈鹕'));
  const at = new Vector3(p.x + (dx / l) * 3.3, y + 2.3, p.z + (dz / l) * 3.3);
  if (rect) sign(c.cb.neon.at(at.x, at.z), at, yaw, 4.4, 4.4 * (160 / 512), rect, 1.3);
}
