// Ground presets: wheel kick-up (dust, grass, sand, dirt), landing rings, splashes, oil, smoke.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { inherit, launch, type BurstOpts, type Kit, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();

interface PuffLook { a: string; b: string; size: number; grow: number; life: number; rise: number; spread: number }

const LOOKS: Record<'dust' | 'grass' | 'sand' | 'dirt' | 'smoke', PuffLook> = {
  dust: { a: '#f4ede0', b: '#d9cdb8', size: 0.2, grow: 2.6, life: 0.7, rise: 0.9, spread: 1.0 },
  grass: { a: '#c9e8a8', b: '#93c46c', size: 0.16, grow: 2.2, life: 0.5, rise: 0.7, spread: 0.8 },
  sand: { a: '#fbecc4', b: '#e8cf91', size: 0.22, grow: 2.8, life: 0.8, rise: 1.0, spread: 1.1 },
  dirt: { a: '#c9a57a', b: '#9a7650', size: 0.2, grow: 2.4, life: 0.7, rise: 0.8, spread: 0.9 },
  smoke: { a: '#9a9aa4', b: '#5c5c66', size: 0.3, grow: 3.0, life: 1.1, rise: 1.4, spread: 0.7 },
};

function puffs(k: Kit, pos: Vec3Like, o: BurstOpts, count: number, look: PuffLook): void {
  const sc = o.scale ?? 1;
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.12 * sc);
    k.p.colors(s, look.a, look.b);
    s.frame = FRAME.puff;
    launch(s, k.dir(d, o.dir, 0.9), look.spread * k.range(0.4, 1.4) * sc);
    s.vy = Math.abs(s.vy) * 0.5 + look.rise * k.range(0.5, 1.2);
    s.life = look.life * k.range(0.75, 1.25);
    s.size0 = look.size * sc * k.range(0.8, 1.2);
    s.size1 = s.size0 * look.grow;
    s.rot = k.range(0, 6.28); s.spin = k.range(-1.5, 1.5);
    s.drag = 3; s.gravity = -0.4;
    inherit(s, o, 0.2, 2);
    k.p.emit(s);
  }
}

function bits(k: Kit, pos: Vec3Like, o: BurstOpts, count: number, frame: number, a: string, b: string, size: number): void {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.6;
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.1);
    k.p.colors(s, a, b);
    s.frame = frame;
    launch(s, k.dir(d, o.dir, 0.6), k.range(2, 4.5) * sc);
    s.vy = Math.abs(s.vy) + k.range(1.5, 3);
    s.life = k.range(0.35, 0.6); s.size0 = size * sc * k.range(0.7, 1.3); s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-12, 12);
    s.drag = 1.5; s.gravity = 14; s.ground = ground;
    inherit(s, o, 0.25, 2);
    k.p.emit(s);
  }
}

export const dust: Preset = (k, pos, o) => puffs(k, pos, o, k.n(4, o), LOOKS.dust);
export const smoke: Preset = (k, pos, o) => puffs(k, pos, o, k.n(5, o), LOOKS.smoke);

export const grass: Preset = (k, pos, o) => {
  puffs(k, pos, o, k.n(2, o), LOOKS.grass);
  bits(k, pos, o, k.n(4, o), FRAME.fur, '#7ed957', '#3f9a2e', 0.12);
};

export const sand: Preset = (k, pos, o) => {
  puffs(k, pos, o, k.n(3, o), LOOKS.sand);
  bits(k, pos, o, k.n(4, o), FRAME.drop, '#f1d38b', '#d9b366', 0.07);
};

export const dirt: Preset = (k, pos, o) => {
  puffs(k, pos, o, k.n(3, o), LOOKS.dirt);
  bits(k, pos, o, k.n(3, o), FRAME.puff, '#7a5530', '#5a3b1e', 0.09);
};

function groundRing(k: Kit, pos: Vec3Like, o: BurstOpts, from: number, to: number, life: number, color: string): void {
  const s = k.at(pos);
  s.y = o.ground ?? pos.y;
  k.p.colors(s, color);
  s.frame = FRAME.ring; s.mode = 2; s.erode = true;
  s.life = life; s.size0 = from; s.size1 = to; s.rot = k.range(0, 6.28);
  inherit(s, o, 0.6, 3);
  k.p.emit(s);
}

/** Landing: dust ring on the road + puffs pushed outward along the ground. */
export const landing: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  groundRing(k, pos, o, 0.5 * sc, 3.2 * sc, 0.42, '#f6efe2');
  const count = k.n(10, o);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + k.range(-0.2, 0.2);
    const s = k.at({ x: pos.x + Math.cos(a) * 0.4, y: (o.ground ?? pos.y) + 0.12, z: pos.z + Math.sin(a) * 0.4 });
    k.p.colors(s, LOOKS.dust.a, LOOKS.dust.b);
    s.frame = FRAME.puff;
    s.vx = Math.cos(a) * 3.2 * sc; s.vy = k.range(0.3, 0.9); s.vz = Math.sin(a) * 3.2 * sc;
    s.life = k.range(0.45, 0.65); s.size0 = 0.22 * sc; s.size1 = 0.5 * sc;
    s.rot = k.range(0, 6.28); s.spin = k.range(-2, 2); s.drag = 4;
    inherit(s, o, 0.5, 3);
    k.p.emit(s);
  }
};

export const splash: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  groundRing(k, pos, o, 0.4 * sc, 2.4 * sc, 0.5, '#e4f7ff');
  const count = k.n(14, o);
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.15);
    k.p.colors(s, '#ffffff', '#7fd0ff');
    s.frame = FRAME.drop; s.mode = 1; s.k = 0.03;
    launch(s, k.dir(d, { x: 0, y: 1, z: 0 }, 0.55), k.range(3, 6.5) * sc);
    s.life = k.range(0.45, 0.8); s.size0 = 0.16 * sc; s.size1 = 0.1 * sc;
    s.drag = 0.8; s.gravity = 13; s.ground = (o.ground ?? pos.y) - 0.05;
    inherit(s, o, 0.4, 2);
    k.p.emit(s);
  }
  puffs(k, pos, o, k.n(3, o), { ...LOOKS.dust, a: '#ffffff', b: '#cdefff' });
};

export const oil: Preset = (k, pos, o) => {
  const s = k.at(pos);
  s.y = (o.ground ?? pos.y) + 0.01;
  k.p.colors(s, '#ffffff');
  s.frame = FRAME.smear; s.mode = 2; s.life = 3.5; s.size0 = 1.1 * (o.scale ?? 1); s.size1 = 1.5 * (o.scale ?? 1);
  s.rot = k.range(0, 6.28);
  k.p.emit(s);
  bits(k, pos, o, k.n(5, o), FRAME.drop, '#3a3442', '#1c1922', 0.08);
};

export const hopDust: Preset = (k, pos, o) => puffs(k, pos, o, k.n(3, o), { ...LOOKS.dust, size: 0.14, life: 0.45 });
