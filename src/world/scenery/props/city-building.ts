// City buildings at night: shop-houses (glowing storefront, fascia + blade sign slots, AC units,
// balconies, rooftop tanks), towers (podium, setback shafts with office grids and LED floor lines,
// crowns with aviation blinkers) and cheap far skyline blocks. Builders return sign slots that
// dressing/city/neon.ts fills. Local frame: origin at the front-centre ground point, front faces −Z.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { AuxBuf } from '../../dressing/city/batch';
import { box, cone, cylinder, trs } from '../../kit/shapes';
import { CPAL, fbox, winSpec } from './city-kit';

export interface BuildBufs { body: AuxBuf; lights: AuxBuf }
export type SlotKind = 'fascia' | 'blade' | 'roof' | 'screen';
/** A sign position: centre (world), yaw of the face normal (faces local −Z after yaw), size. */
export interface SignSlot { kind: SlotKind; pos: Vector3; yaw: number; w: number; h: number }

const GF = 4.4, FH = 3.2;
const lm = new Matrix4(), wm = new Matrix4();
const RED = new Color(1, 0.12, 0.1);
// Steady lamps (light-cycle role 6 = ×2.4): shop pier edge strips and the warm soffit line under the overhang.
const EDGE = [new Color(0.9, 0.2, 0.6), new Color(0.2, 0.75, 0.9), new Color(0.95, 0.55, 0.2), new Color(0.9, 0.15, 0.15)];
const SOFFIT = new Color(0.85, 0.6, 0.35);

function at(base: Matrix4, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).applyMatrix4(base);
}

function part(buf: AuxBuf, base: Matrix4, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color): void {
  buf.setAux(0);
  box(buf, wm.multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, lm)), col);
}

/** Rooftop clutter: water tank on legs or AC units; optional antenna with a red blinker. */
function rooftop(b: BuildBufs, base: Matrix4, w: number, d: number, top: number, rng: Rng, antenna: boolean): void {
  const tx = rng.range(-w * 0.25, w * 0.25), tz = rng.range(d * 0.35, d * 0.65);
  if (rng.chance(0.55)) {
    for (const [lx, lz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]] as Array<[number, number]>) part(b.body, base, tx + lx, top + 0.6, tz + lz, 0.12, 1.2, 0.12, CPAL.trim);
    b.body.setAux(0);
    cylinder(b.body, wm.multiplyMatrices(base, trs(tx, top + 1.2, tz, 0, 1.0, 1.6, 1.0, lm)), CPAL.tank, 10);
  } else {
    for (let i = 0; i < rng.int(1, 3); i++) part(b.body, base, tx + i * 1.3 - 1.3, top + 0.45, tz, 1.0, 0.9, 0.8, CPAL.ac);
  }
  if (!antenna) return;
  const ax = rng.range(-w * 0.3, w * 0.3), az = rng.range(d * 0.3, d * 0.7), h = rng.range(3, 7);
  part(b.body, base, ax, top + h / 2, az, 0.12, h, 0.12, CPAL.steel);
  const p = at(base, ax, top + h + 0.15, az);
  b.lights.setAux(rng.range(0, 3), 5);
  cylinder(b.lights, trs(p.x, p.y - 0.15, p.z, 0, 0.18, 0.3, 0.18, lm), RED, 6);
  b.lights.setAux(0);
}

/** AC units and balconies dotted over the front face of the upper floors. */
function facadeBits(b: BuildBufs, base: Matrix4, w: number, floors: number, rng: Rng, balconies: boolean): void {
  const bays = Math.max(1, Math.round(w / 2.4)), bw = w / bays;
  for (let f = 0; f < floors; f++) {
    const y = GF + f * FH;
    if (balconies && f % 2 === 0) part(b.body, base, 0, y + 0.12, -0.45, w * 0.92, 0.18, 0.9, CPAL.concrete);
    for (let i = 0; i < bays; i++) {
      if (!rng.chance(0.18)) continue;
      const x = -w / 2 + bw * (i + 0.5) + bw * 0.3;
      part(b.body, base, x, y + 0.75, -0.28, 0.75, 0.55, 0.5, CPAL.ac);
    }
  }
}

/** Shop-house: storefront under an overhang, 1–6 upper floors. (x, y, z) = front-centre ground. */
export function shophouse(b: BuildBufs, x: number, y: number, z: number, yaw: number, w: number, d: number, floors: number, rng: Rng): SignSlot[] {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const wall = rng.pick(CPAL.walls);
  const seed = rng.range(0, 100);
  const H = GF + floors * FH;
  // Ground floor: glass front recessed only 0.3 m between two shallow wall-coloured piers with neon edge
  // strips (deep dark piers hid the glass from the outer lanes), back block behind it, warm soffit strip.
  fbox(b.body, base, 0, GF / 2, d / 2 + 0.15, w, GF, d - 0.3, wall, null, CPAL.roof, 0b11110);
  fbox(b.body, base, 0, 1.7, 0.28, w - 0.7, 3.0, 0.04, wall, winSpec(4, seed, 1, 0, rng.range(1.6, 2.6), 3.0, 0.2), undefined, 0b00001);
  const edge = rng.pick(EDGE);
  for (const sx of [-1, 1]) {
    part(b.body, base, sx * (w / 2 - 0.17), GF / 2, 0.15, 0.34, GF, 0.3, wall);
    b.lights.setAux(0, 6);
    box(b.lights, wm.multiplyMatrices(base, trs(sx * (w / 2 - 0.36), 1.95, -0.01, 0, 0.06, 3.3, 0.04, lm)), edge);
  }
  b.lights.setAux(0, 6);
  box(b.lights, wm.multiplyMatrices(base, trs(0, GF - 0.15, 0.2, 0, w - 1.0, 0.03, 0.1, lm)), SOFFIT);
  b.lights.setAux(0);
  // Upper floors (front overhangs the storefront by 0.8 m) + cornice.
  const style = rng.chance(0.7) ? 1 : 3;
  fbox(b.body, base, 0, GF + (floors * FH) / 2, d / 2, w, floors * FH, d, wall, winSpec(style, seed, rng.range(0.35, 0.75), 0, 2.0, FH, GF), CPAL.roof);
  part(b.body, base, 0, GF - 0.06, 0.4, w + 0.1, 0.12, 0.84, CPAL.trim);
  part(b.body, base, 0, H + 0.15, d / 2, w + 0.3, 0.3, d + 0.3, CPAL.trim);
  facadeBits(b, base, w, floors, rng, style === 1 && rng.chance(0.5));
  rooftop(b, base, w, d, H + 0.3, rng, floors >= 4 && rng.chance(0.35));
  const slots: SignSlot[] = [{ kind: 'fascia', pos: at(base, 0, 3.95, -0.06), yaw, w: w - 0.8, h: 0.85 }];
  if (floors >= 2 && rng.chance(0.7)) {
    const side = rng.chance(0.5) ? -1 : 1, h = Math.min(floors * FH - 0.6, rng.range(4.5, 8));
    slots.push({ kind: 'blade', pos: at(base, side * (w / 2 - 0.5), GF + 0.5 + h / 2, -0.75), yaw: yaw + Math.PI / 2, w: 1.1, h });
  }
  if (floors <= 3 && rng.chance(0.35)) slots.push({ kind: 'roof', pos: at(base, 0, H + 1.6, d * 0.3), yaw, w: Math.min(w - 1, 9), h: 2.2 });
  return slots;
}

/** Tower on a two-storey podium; shafts step back; office or mixed windows, optional LED lines. */
export function tower(b: BuildBufs, x: number, y: number, z: number, yaw: number, w: number, d: number, floors: number, rng: Rng): SignSlot[] {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const wall = rng.pick(CPAL.towers), seed = rng.range(0, 100);
  const pod = GF + 4;
  fbox(b.body, base, 0, pod / 2, d / 2, w, pod, d, rng.pick(CPAL.walls), winSpec(4, seed, 1, 0, 2.6, pod / 2, 0), CPAL.roof);
  const style = rng.chance(0.65) ? 2 : 3, led = rng.chance(0.45) ? rng.int(1, 4) : 0;
  const fh = 3.4;
  let sw = w - rng.range(2, 4), sd = d - rng.range(2, 4), y0 = pod, left = floors;
  const tiers = floors > 18 ? 2 : 1;
  const slots: SignSlot[] = [];
  for (let t = 0; t < tiers && left > 0; t++) {
    const fl = t === tiers - 1 ? left : Math.round(left * rng.range(0.6, 0.75));
    fbox(b.body, base, 0, y0 + (fl * fh) / 2, d / 2, sw, fl * fh, sd, wall, winSpec(style, seed + t * 13, rng.range(0.4, 0.8), led, 2.8, fh, y0), CPAL.roof);
    if (t === 0 && rng.chance(0.4)) slots.push({ kind: 'screen', pos: at(base, 0, y0 + Math.min(fl * fh * 0.5, 14), d / 2 - sd / 2 - 0.25), yaw, w: Math.min(sw - 2, 14), h: Math.min(sw - 2, 14) * 0.5625 });
    y0 += fl * fh;
    left -= fl;
    sw -= rng.range(2, 4);
    sd -= rng.range(2, 4);
  }
  part(b.body, base, 0, y0 + 0.6, d / 2, sw + 1.6, 1.2, sd + 1.6, CPAL.trim);
  rooftop(b, base, sw, sd, y0 + 1.2, rng, true);
  slots.push({ kind: 'fascia', pos: at(base, 0, GF - 0.45, -0.06), yaw, w: w * 0.7, h: 0.9 });
  if (rng.chance(0.3)) slots.push({ kind: 'roof', pos: at(base, 0, y0 + 3.4, d / 2), yaw, w: Math.min(sw, 16), h: 3.6 });
  return slots;
}

/** Red aviation blinker (light-cycle role 5) at world point p. */
function blinker(lights: AuxBuf, p: Vector3, rng: Rng): void {
  lights.setAux(rng.range(0, 3), 5);
  cylinder(lights, trs(p.x, p.y - 0.2, p.z, 0, 0.3, 0.4, 0.3, lm), RED, 6);
  lights.setAux(0);
}

/**
 * Far skyline block (no outline, no slots): a windowed shaft with a rooftop kit so the skyline is not a
 * bar chart: stepped setback crowns, pyramid caps, antenna masts and spires with red blinkers (`lights`).
 */
export function skylineBlock(buf: AuxBuf, x: number, y: number, z: number, yaw: number, w: number, d: number, h: number, rng: Rng, lights?: AuxBuf): void {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const style = rng.chance(0.6) ? 2 : 3, led = rng.chance(0.35) ? rng.int(1, 4) : 0;
  const wall = rng.pick(CPAL.towers), seed = rng.range(0, 100), lit = rng.range(0.35, 0.7);
  fbox(buf, base, 0, h / 2, d / 2, w, h, d, wall, winSpec(style, seed, lit, led, 3.2, 3.6, 0), CPAL.roof);
  let top = h, tw = w, td = d;
  const roll = rng.next();
  if (h > 45 && roll < 0.4) {
    // Stepped setbacks: one or two smaller windowed boxes.
    for (let k = 0; k < (rng.chance(0.5) ? 2 : 1); k++) {
      tw *= rng.range(0.55, 0.75); td *= rng.range(0.55, 0.75);
      const sh = rng.range(5, 13);
      fbox(buf, base, 0, top + sh / 2, d / 2, tw, sh, td, wall, winSpec(style, seed + 7 + k, lit, 0, 3.2, 3.6, top), CPAL.roof);
      top += sh;
    }
  } else if (h > 45 && roll < 0.58) {
    // Pyramid cap (four-sided cone turned 45° so its faces line up with the walls).
    buf.setAux(0);
    cone(buf, wm.multiplyMatrices(base, trs(0, top, d / 2, Math.PI / 4, w * 0.62, rng.range(6, 12), d * 0.62, lm)), CPAL.roof, 4);
    top += 3;
  } else if (roll < 0.8) {
    part(buf, base, rng.range(-w * 0.2, w * 0.2), top + 1.2, d * rng.range(0.35, 0.65), rng.range(3, 6), 2.4, rng.range(3, 6), CPAL.ac);
  }
  if (!lights) return;
  if (h > 110) {
    // Landmark spire.
    const sh = rng.range(18, 30);
    buf.setAux(0);
    cone(buf, wm.multiplyMatrices(base, trs(0, top, d / 2, 0, 0.9, sh, 0.9, lm)), CPAL.steel, 8);
    blinker(lights, at(base, 0, top + sh + 0.2, d / 2), rng);
  } else if (rng.chance(0.45)) {
    const ax = rng.range(-tw * 0.3, tw * 0.3), az = d / 2 + rng.range(-td * 0.25, td * 0.25), ah = rng.range(6, 16);
    part(buf, base, ax, top + ah / 2, az, 0.25, ah, 0.25, CPAL.steel);
    blinker(lights, at(base, ax, top + ah + 0.2, az), rng);
  }
}
