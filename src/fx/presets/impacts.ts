// Impact presets: comic hit bursts (two-layer POW star + manga impact lines), heavy/crit, blocks,
// metal sparks. Everything inherits the victim's velocity so it stays on the hit at speed.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { inherit, launch, type BurstOpts, type Kit, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();

function glow(k: Kit, pos: Vec3Like, o: BurstOpts, size: number, color: string, life = 0.1): void {
  const s = k.at(pos);
  k.p.colors(s, color);
  s.frame = FRAME.glow; s.additive = true; s.realtime = true; s.life = life; s.size0 = size; s.size1 = size * 1.3;
  inherit(s, o, 0.9);
  k.p.emit(s);
}

/** One sprite that pops in place; real-time so it reads instantly even during hit-stop / slow-mo. */
function pop(k: Kit, pos: Vec3Like, o: BurstOpts, frame: number, size: number, grow: number, life: number, a: string, b = a): void {
  const s = k.at(pos);
  k.p.colors(s, a, b);
  s.frame = frame; s.life = life; s.size0 = size; s.size1 = size * grow; s.realtime = true;
  s.rot = k.range(-0.6, 0.6); s.spin = k.range(-1.5, 1.5);
  inherit(s, o, 0.9);
  k.p.emit(s);
}

function sparks(k: Kit, pos: Vec3Like, o: BurstOpts, count: number, speed: number, a: string, b: string): void {
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.05);
    k.p.colors(s, a, b);
    s.frame = FRAME.spark; s.additive = true; s.mode = 1;
    launch(s, k.dir(d, o.dir, 0.75), speed * k.range(0.6, 1.3) * (o.scale ?? 1));
    s.life = k.range(0.18, 0.32); s.size0 = 0.08 * (o.scale ?? 1); s.size1 = 0.03;
    s.drag = 5; s.gravity = 7; s.k = 0.035;
    inherit(s, o, 0.85);
    k.p.emit(s);
  }
}

function stars(k: Kit, pos: Vec3Like, o: BurstOpts, count: number, colors: readonly string[]): void {
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.08);
    k.p.colors(s, colors[i % colors.length] ?? '#ffe600');
    s.frame = i % 2 === 0 ? FRAME.star5 : FRAME.spark4;
    launch(s, k.dir(d, o.dir, 0.8), k.range(2.5, 4.5) * (o.scale ?? 1));
    s.vy += 2;
    s.life = k.range(0.35, 0.55); s.size0 = k.range(0.12, 0.2) * (o.scale ?? 1); s.size1 = s.size0 * 0.7;
    s.rot = k.range(0, 6.28); s.spin = k.range(-9, 9); s.drag = 2.5; s.gravity = 9;
    inherit(s, o, 0.85);
    k.p.emit(s);
  }
}

/** Thin expanding ring that erodes to a hairline. */
export function ring(k: Kit, pos: Vec3Like, o: BurstOpts, from: number, to: number, life: number, color: string): void {
  const s = k.at(pos);
  k.p.colors(s, color);
  s.frame = FRAME.ring; s.life = life; s.size0 = from; s.size1 = to; s.erode = true; s.realtime = true;
  inherit(s, o, 0.9);
  k.p.emit(s);
}

/** Two-layer POW star: coloured jagged outer + white inner, both inked. */
function pow(k: Kit, pos: Vec3Like, o: BurstOpts, size: number, outer: string, outerEnd: string, life: number): void {
  pop(k, pos, o, FRAME.burst, size, 1.2, life, outer, outerEnd);
  pop(k, pos, o, FRAME.burst, size * 0.58, 1.1, life * 0.85, '#ffffff');
}

export const hit: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  glow(k, pos, o, 0.55 * sc, '#ffe08a');
  pow(k, pos, o, 0.62 * sc, '#ffe600', '#ff8a00', 0.15);
  pop(k, pos, o, FRAME.rays, 1.0 * sc, 1.35, 0.1, '#ffffff');
  sparks(k, pos, o, k.n(8, o), 7, '#fff6b0', '#ff6a00');
  stars(k, pos, o, Math.ceil(k.n(3, o)), ['#ffe600', '#ffffff', '#ff1e3c']);
};

export const hitHeavy: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  glow(k, pos, o, 0.6 * sc, '#ffb060', 0.1);
  pow(k, pos, o, 1.0 * sc, '#ff1e3c', '#ff8a00', 0.2);
  pop(k, pos, o, FRAME.rays, 1.8 * sc, 1.35, 0.12, '#ffffff');
  sparks(k, pos, o, k.n(14, o), 9, '#fff6b0', '#ff3c00');
  stars(k, pos, o, Math.ceil(k.n(5, o)), ['#ffe600', '#ffffff', '#ff1e3c']);
};

/** KO punctuation: an oversized red POW over a white one, wide manga lines (real-time). */
export function koPow(k: Kit, pos: Vec3Like, o: BurstOpts): void {
  const sc = (o.scale ?? 1) * 1.3;
  pow(k, pos, o, 1.15 * sc, '#ff1e3c', '#ffe600', 0.32);
  pop(k, pos, o, FRAME.rays, 2.3 * sc, 1.3, 0.2, '#ffffff');
  glow(k, pos, o, 0.8 * sc, '#ffd0a0', 0.12);
}

export const crit: Preset = (k, pos, o) => {
  hitHeavy(k, pos, o);
  pop(k, pos, o, FRAME.burst, 0.7 * (o.scale ?? 1), 1.3, 0.24, '#ffe600', '#ff1e3c');
  stars(k, pos, o, Math.ceil(k.n(6, o)), ['#ff1e3c', '#ffe600']);
};

export const block: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  glow(k, pos, o, 0.6 * sc, '#8fe3ff');
  ring(k, pos, o, 0.4 * sc, 1.5 * sc, 0.18, '#9be7ff');
  pop(k, pos, o, FRAME.spark4, 0.55 * sc, 1.2, 0.14, '#ffffff', '#5ad1ff');
  sparks(k, pos, o, k.n(10, o), 6, '#e8fbff', '#2a8cff');
};

/** Metal sparks (pan hits, wall scrapes, crashes). */
export const metalSparks: Preset = (k, pos, o) => {
  sparks(k, pos, o, k.n(16, o), 8, '#fffbe0', '#ff7a00');
};
