// Neon pass: fills the sign slots the buildings offer — shop fascias, double-sided blade signs,
// rooftop letters / P5 boards on scaffolds, LED screens with the city poster art.
import { Matrix4, Vector3 } from 'three';
import { box, trs } from '../../kit/shapes';
import type { SignSlot } from '../../scenery/props/city-building';
import { CPAL } from '../../scenery/props/city-kit';
import type { AtlasRect } from '../../scenery/signs/atlas';
import { faceQuad } from '../../scenery/signs/boards';
import { billboardFace } from '../../scenery/signs/faces';
import type { AuxBuf } from './batch';
import type { City } from './city';
import { BLADES, P5_LINES, ROOF_LINES, SHOPS } from './lines';
import { bladeFace, fasciaFace, p5Face, roofFace } from './neon-faces';

const m = new Matrix4();
const ahead = (p: Vector3, yaw: number, d: number): Vector3 => new Vector3(p.x - Math.sin(yaw) * d, p.y, p.z - Math.cos(yaw) * d);

/** Sign quad with HDR intensity and optional flicker. */
export function sign(buf: AuxBuf, c: Vector3, yaw: number, w: number, h: number, rect: AtlasRect, glow: number, flicker = 0, phase = 0): void {
  buf.setAux(glow, phase, flicker);
  faceQuad(buf, c, yaw, w, h, rect);
  buf.setAux(0);
}

/** Thin board behind a face (outlined body geometry). */
export function board(c: City, p: Vector3, yaw: number, w: number, h: number, t: number): void {
  const buf = c.cb.body.at(p.x, p.z);
  buf.setAux(0);
  box(buf, trs(p.x, p.y, p.z, yaw, w, h, t, m), CPAL.trim);
}

function fascia(c: City, sl: SignSlot, k: number): void {
  const { d } = c;
  const i = k % SHOPS.length, name = SHOPS[i] ?? '';
  const lightbox = i % 5 === 1 || i % 5 === 3;
  const rect = d.face(`fascia:${name}:${lightbox}`, () => fasciaFace(c.neonAtlas, d.rng.fork(k), name, lightbox));
  if (!rect) return;
  board(c, ahead(sl.pos, sl.yaw, -0.04), sl.yaw, sl.w + 0.2, sl.h + 0.16, 0.16);
  sign(c.cb.neon.at(sl.pos.x, sl.pos.z), ahead(sl.pos, sl.yaw, 0.05), sl.yaw, sl.w, sl.h, rect, lightbox ? 1.25 : 2.3, k % 9 === 4 ? 1 : 0, k * 0.37);
}

function blade(c: City, sl: SignSlot, k: number): void {
  const { d } = c;
  const i = k % BLADES.length, text = BLADES[i] ?? '';
  const lightbox = i % 3 === 2;
  const rect = d.face(`blade:${text}:${lightbox}`, () => bladeFace(c.neonAtlas, d.rng.fork(k + 500), text, lightbox));
  if (!rect) return;
  board(c, sl.pos, sl.yaw, sl.w + 0.16, sl.h + 0.16, 0.12);
  const buf = c.cb.neon.at(sl.pos.x, sl.pos.z);
  for (const flip of [0, Math.PI]) sign(buf, ahead(sl.pos, sl.yaw + flip, 0.075), sl.yaw + flip, sl.w, sl.h, rect, lightbox ? 1.25 : 2.3, k % 7 === 3 ? 1 : 0, k * 0.61);
}

function roof(c: City, sl: SignSlot, k: number): void {
  const { d } = c;
  // 12 rooftop lines + 6 P5 boards cycle (atlas budget).
  const p5 = k % 4 === 2;
  const text = p5 ? P5_LINES[k % P5_LINES.length] ?? '' : ROOF_LINES[k % 12] ?? '';
  const rect = d.face(`roof:${text}:${p5}`, () => (p5 ? p5Face(c.neonAtlas, d.rng.fork(k + 900), text) : roofFace(c.neonAtlas, d.rng.fork(k + 900), text)));
  if (!rect) return;
  const h = p5 ? sl.w * (160 / 512) : sl.w / 4;
  // Scaffold: two legs and a top rail.
  const buf = c.cb.body.at(sl.pos.x, sl.pos.z);
  const rx = Math.cos(sl.yaw), rz = -Math.sin(sl.yaw);
  const base = sl.pos.y - sl.h / 2 - 1.2;
  for (const s of [-0.38, 0.38]) box(buf, trs(sl.pos.x + rx * s * sl.w, base + (h + 1.2) / 2, sl.pos.z + rz * s * sl.w, sl.yaw, 0.18, h + 1.2, 0.18, m), CPAL.trim);
  const centre = new Vector3(sl.pos.x, base + 1.2 + h / 2, sl.pos.z);
  board(c, ahead(centre, sl.yaw, -0.06), sl.yaw, sl.w + 0.3, h + 0.3, 0.12);
  sign(c.cb.neon.at(sl.pos.x, sl.pos.z), ahead(centre, sl.yaw, 0.02), sl.yaw, sl.w, h, rect, p5 ? 1.3 : 2.4, k % 6 === 5 ? 0.6 : 0, k * 0.29);
}

function screen(c: City, sl: SignSlot, k: number, art: HTMLImageElement[]): void {
  const { d } = c;
  // 12 screen designs cycle (art × line), so the 2048² screen atlas never overflows.
  const j = k % 12;
  const img = art.length ? art[j % art.length] ?? null : null;
  const text = ROOF_LINES[(j * 7 + 3) % ROOF_LINES.length] ?? '';
  const rect = d.face(`screen:${text}:${img?.src ?? ''}`, () => billboardFace(c.screenAtlas, d.rng.fork(k + 1300), text, img));
  if (!rect) return;
  board(c, ahead(sl.pos, sl.yaw, -0.12), sl.yaw, sl.w + 0.6, sl.h + 0.6, 0.3);
  sign(c.cb.screens.at(sl.pos.x, sl.pos.z), ahead(sl.pos, sl.yaw, 0.06), sl.yaw, sl.w, sl.h, rect, 1.15);
}

/** Fill every slot (slots arrive in street order; k cycles the text lists). */
export function neonSigns(c: City, art: HTMLImageElement[]): void {
  const counts = { fascia: 0, blade: 0, roof: 0, screen: 0 };
  for (const sl of c.slots) {
    const k = counts[sl.kind]++;
    if (sl.kind === 'fascia') fascia(c, sl, k);
    else if (sl.kind === 'blade') blade(c, sl, k);
    else if (sl.kind === 'roof') roof(c, sl, k);
    else screen(c, sl, k, art);
  }
  console.info(`[track] city neon: ${JSON.stringify(counts)}`);
}
