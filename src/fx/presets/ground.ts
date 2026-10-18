// Ground presets: wheel kick-up (dust, grass, sand, dirt), landing rings, splashes, oil, smoke.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { inherit, launch, type BurstOpts, type Kit, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();

/** `carry` = share of the source's velocity a puff keeps (high = it hangs by the wheel instead of rushing at the camera). */
interface PuffLook { a: string; b: string; size: number; grow: number; life: number; rise: number; spread: number; carry?: number }

const LOOKS: Record<'dust' | 'grass' | 'sand' | 'dirt' | 'smoke' | 'tyre', PuffLook> = {
  dust: { a: '#f4ede0', b: '#d9cdb8', size: 0.2, grow: 2.6, life: 0.7, rise: 0.9, spread: 1.0 },
  grass: { a: '#c9e8a8', b: '#93c46c', size: 0.16, grow: 2.2, life: 0.5, rise: 0.7, spread: 0.8 },
  sand: { a: '#fbecc4', b: '#e8cf91', size: 0.22, grow: 2.8, life: 0.8, rise: 1.0, spread: 1.1 },
  dirt: { a: '#c9a57a', b: '#9a7650', size: 0.2, grow: 2.4, life: 0.7, rise: 0.8, spread: 0.9 },
  smoke: { a: '#9a9aa4', b: '#5c5c66', size: 0.3, grow: 3.0, life: 1.1, rise: 1.4, spread: 0.7 },
  tyre: { a: '#ffffff', b: '#d4d4dc', size: 0.13, grow: 3.0, life: 0.42, rise: 0.45, spread: 0.5, carry: 0.75 },
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
    inherit(s, o, look.carry ?? 0.2, 2);
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
/** White tyre smoke behind a drifting wheel (continuous; one puff per call). */
export const driftSmoke: Preset = (k, pos, o) => puffs(k, pos, o, k.n(1, o), LOOKS.tyre);

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

/**
 * Flat comic shock ring on the road (o.ground), carried along with the source: 7 fat inked dashes that fly
 * outward from the `from` to the `to` ring (sprite sizes, as before) and shorten to nothing, over a soft
 * dust haze; nothing reaches past ~1.6 m.
 */
export function groundRing(k: Kit, pos: Vec3Like, o: BurstOpts, from: number, to: number, life: number, color: string, carry = 0.6): void {
  const y = (o.ground ?? pos.y) + 0.02;
  const r0 = Math.max(0.45, 0.4 * from);
  const r1 = Math.min(1.6, Math.max(r0 + 0.45, 0.5 * to));
  const n = 7;
  const spin = k.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2 + k.range(-0.12, 0.12);
    const s = k.at({ x: pos.x + Math.cos(a) * r0, y, z: pos.z + Math.sin(a) * r0 });
    k.p.colors(s, color);
    s.frame = FRAME.dash; s.mode = 2;
    const v = ((r1 - r0) / life) * k.range(0.85, 1.15);
    s.vx = Math.cos(a) * v; s.vz = Math.sin(a) * v;
    s.life = life * k.range(0.85, 1.1); s.size0 = ((Math.PI * 2 * r0) / n) * 1.1; s.size1 = 0;
    s.rot = a + Math.PI / 2; // long axis along the tangent, convex side outward
    inherit(s, o, carry, 3);
    k.p.emit(s);
  }
  const g = k.at({ x: pos.x, y: y - 0.01, z: pos.z });
  k.p.colors(g, '#6b6152', '#211d17');
  g.frame = FRAME.glow; g.additive = true; g.mode = 2;
  g.life = life * 1.2; g.size0 = 2 * r0; g.size1 = 2.3 * r1;
  inherit(g, o, carry, 3);
  k.p.emit(g);
}

/** Landing: a tapering shock ring on the road + a crescent of dust kicked out behind and to the sides of
 *  travel (big two-tone lead puffs of mixed sizes, then grit). The dust keeps most of the rider's speed so
 *  it stays round the wheel long enough to read from the chase camera; size and count grow with air time. */
export const landing: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y;
  groundRing(k, pos, o, 0.4 * sc, 2.0 * sc, 0.28, '#f6efe2', 0.85);
  const back = o.vel && Math.hypot(o.vel.x, o.vel.z) > 1 ? Math.atan2(-o.vel.z, -o.vel.x) : null;
  const angle = (): number => (back === null ? k.range(0, Math.PI * 2) : back + k.range(-1.92, 1.92));
  const lead = k.n(7, o);
  for (let i = 0; i < lead; i++) {
    const a = angle();
    const s = k.at({ x: pos.x + Math.cos(a) * 0.4, y: ground + 0.12, z: pos.z + Math.sin(a) * 0.4 });
    if (i % 3 === 0) k.p.colors(s, '#d9c9ad', '#a8977c');
    else k.p.colors(s, LOOKS.dust.a, LOOKS.dust.b);
    s.frame = FRAME.puff;
    const v = k.range(2, 4.6) * sc;
    s.vx = Math.cos(a) * v; s.vy = k.range(0.3, 1); s.vz = Math.sin(a) * v;
    const size = k.range(0.6, 1.4) * sc;
    s.life = k.range(0.4, 0.6); s.size0 = 0.3 * size; s.size1 = 0.7 * size;
    s.rot = k.range(0, 6.28); s.spin = k.range(-2, 2); s.drag = 3.5;
    inherit(s, o, 0.85, 1.5);
    k.p.emit(s);
  }
  for (let i = 0; i < k.n(6, o); i++) {
    const a = angle();
    const s = k.at({ x: pos.x + Math.cos(a) * 0.3, y: ground + 0.1, z: pos.z + Math.sin(a) * 0.3 });
    k.p.colors(s, '#cdbb9c', '#8f7f66');
    s.frame = i % 2 ? FRAME.stick : FRAME.drop; s.mode = 1; s.k = 0.03;
    const v = k.range(3, 6) * sc;
    s.vx = Math.cos(a) * v; s.vy = k.range(1.5, 3); s.vz = Math.sin(a) * v;
    s.life = k.range(0.3, 0.45); s.size0 = 0.07; s.size1 = 0.05; s.gravity = 14; s.drag = 1; s.ground = ground;
    inherit(s, o, 0.85, 1.5);
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
