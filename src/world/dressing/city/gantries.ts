// Start / finish gantries for the night city: the truss gantry with neon headers (HDR atlas),
// glowing strips up the legs, and at the finish a giant LED screen on twin pylons over the road.
import { Color, Matrix4, Vector3 } from 'three';
import { box, trs } from '../../kit/shapes';
import { gantry } from '../../scenery/props/event';
import { gantryFace } from '../../scenery/signs/faces';
import type { City } from './city';
import { finishScreenFace } from './faces';
import { board, sign } from './neon';
import { hdr } from './util';

const m = new Matrix4();
const DARK = new Color('#16171c');
const ahead = (p: Vector3, yaw: number, d: number): Vector3 => new Vector3(p.x - Math.sin(yaw) * d, p.y, p.z - Math.cos(yaw) * d);

/** Neon gantry over the road at s; header words toward the riders and on the back. */
export function neonGantry(c: City, s: number, word: string, sub: string, back: string, backSub: string): void {
  const { d } = c;
  const l = d.place.spot(s, -1, 1.1), r = d.place.spot(s, 1, 1.1);
  for (const p of [l, r]) d.place.claim(p.pos.x, p.pos.z, 1.2);
  const g = gantry(d.b.props.at(l.pos.x, l.pos.z), l.pos, r.pos, 6.4);
  const toRiders = d.place.spot(s, 1, 0).along + Math.PI;
  const frontFaces = Math.cos(g.yaw - toRiders) > 0;
  const [fp, bp] = frontFaces ? [g.front, g.back] : [g.back, g.front];
  const [fy, by] = frontFaces ? [g.yaw, g.yaw + Math.PI] : [g.yaw + Math.PI, g.yaw];
  const w = g.span + 0.6, h = Math.min(2.5, w / 6);
  for (const [p, yaw, a, b2] of [[fp, fy, word, sub], [bp, by, back, backSub]] as Array<[Vector3, number, string, string]>) {
    // Headers live in the screen atlas (the neon atlas is full of shop signs).
    const rect = d.face(`gantry:${a}:${b2}`, () => gantryFace(c.screenAtlas, a, b2));
    if (rect) sign(c.cb.screens.at(p.x, p.z), ahead(p, yaw, 0.02), yaw, w, h, rect, 1.6);
  }
  // Neon tubes up both legs and along the header's top and bottom edges.
  const neon = [hdr('#ff2d95', 2.6), hdr('#22e8ff', 2.6)];
  [l, r].forEach((p, i) => {
    box(d.b.glow.at(p.pos.x, p.pos.z), trs(p.pos.x, p.pos.y + 3.6, p.pos.z, g.yaw, 0.16, 7.0, 1.0, m), neon[i] as Color);
  });
  const mid = new Vector3().lerpVectors(l.pos, r.pos, 0.5);
  const top = Math.min(l.pos.y, r.pos.y) + 6.4;
  for (const [yy, col] of [[top + 0.18, neon[1]], [top + 2.5, neon[0]]] as Array<[number, Color]>) {
    for (const p of [fp, bp]) {
      const q = new Vector3(mid.x + (p.x - mid.x) * 1.02, yy, mid.z + (p.z - mid.z) * 1.02);
      box(d.b.glow.at(q.x, q.z), trs(q.x, q.y, q.z, g.yaw, g.span + 1.2, 0.1, 0.08, m), col);
    }
  }
}

/** Giant LED screen spanning the road just past s, on two black pylons. */
export function finishScreen(c: City, s: number, art: HTMLImageElement[], word: string, sub: string): void {
  const { d } = c;
  const W = 22, H = W * 9 / 16, BOTTOM = 12.5;
  const l = d.place.spot(s, -1, 1.6), r = d.place.spot(s, 1, 1.6);
  const y = Math.min(l.pos.y, r.pos.y);
  for (const p of [l, r]) {
    d.place.claim(p.pos.x, p.pos.z, 1.6);
    box(d.b.props.at(p.pos.x, p.pos.z), trs(p.pos.x, y + (BOTTOM + H) / 2, p.pos.z, p.along, 1.4, BOTTOM + H, 1.4, m), DARK);
    box(d.b.glow.at(p.pos.x, p.pos.z), trs(p.pos.x, y + (BOTTOM + H) / 2, p.pos.z, p.along, 1.5, BOTTOM + H, 0.12, m), hdr('#ff2d95', 2.4));
  }
  const toRiders = d.place.spot(s, 1, 0).along + Math.PI;
  const centre = new Vector3().lerpVectors(l.pos, r.pos, 0.5).setY(y + BOTTOM + H / 2);
  board(c, ahead(centre, toRiders, -0.35), toRiders, W + 1.2, H + 1.2, 0.7);
  box(d.b.props.at(centre.x, centre.z), trs(centre.x, y + BOTTOM - 0.4, centre.z, toRiders, l.pos.distanceTo(r.pos) + 1.4, 0.8, 1.2, m), DARK);
  const rect = d.face('finish:screen', () => finishScreenFace(c.screenAtlas, d.rng.fork(0xf1), art[0] ?? null, word, sub));
  if (rect) sign(c.cb.screens.at(centre.x, centre.z), ahead(centre, toRiders, 0.02), toRiders, W, H, rect, 1.2);
}
