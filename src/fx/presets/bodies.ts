// Body presets: feathers, fur, bike debris, dizzy stars, KO bursts, weapon bits, skill poofs.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { koPow, ring } from './impacts';
import { smoke } from './ground';
import { inherit, launch, type BurstOpts, type Kit, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();

function flutter(k: Kit, pos: Vec3Like, o: BurstOpts, count: number, frame: number, size: number, life: number): void {
  const sc = o.scale ?? 1;
  const a = o.color ?? '#ffffff';
  const b = o.color2 ?? a;
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.2 * sc);
    k.p.colors(s, i % 3 === 2 ? b : a, b);
    s.frame = frame; s.mode = 3; s.k = k.range(0.12, 0.3);
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.85), k.range(2.5, 6) * sc);
    s.life = life * k.range(0.75, 1.3); s.size0 = size * sc * k.range(0.8, 1.25); s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-3, 3);
    s.drag = 3.2; s.gravity = 2.4;
    inherit(s, o, 0.55, 1.2);
    k.p.emit(s);
  }
}

export const feathers: Preset = (k, pos, o) => flutter(k, pos, o, k.n(10, o), FRAME.feather, 0.28, 1.8);
export const fur: Preset = (k, pos, o) => flutter(k, pos, o, k.n(9, o), FRAME.fur, 0.2, 1.3);

/** Bolts and spokes that bounce onto the road and slide to a stop. */
export const debris: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const count = k.n(8, o);
  const ground = o.ground ?? pos.y - 0.8;
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.15);
    k.p.colors(s, '#ffffff', i % 4 === 0 ? (o.color ?? '#ffffff') : '#ffffff');
    s.frame = i % 3 === 0 ? FRAME.stick : FRAME.bolt;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.7), k.range(3.5, 7.5) * sc);
    s.vy = Math.abs(s.vy) + 2;
    s.life = k.range(1.6, 2.4); s.size0 = (s.frame === FRAME.stick ? 0.24 : 0.13) * sc; s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-14, 14);
    s.drag = 0.6; s.gravity = 15; s.ground = ground + 0.04;
    inherit(s, o, 0.6, 1.4);
    k.p.emit(s);
  }
};

/** Stars circling a rider's head; `follow` = anchor slot, `life` = stun time. */
export const dizzy: Preset = (k, pos, o) => {
  const count = Math.min(5, k.n(4, o));
  const life = o.life ?? 1.2;
  for (let i = 0; i < count; i++) {
    const s = k.p.spec();
    if (o.follow === undefined) { s.x = pos.x; s.y = pos.y + 0.3; s.z = pos.z; } else { s.y = 0.3; s.follow = o.follow; }
    k.p.colors(s, i % 2 ? '#ffffff' : (o.color ?? '#ffe600'));
    s.frame = FRAME.star5; s.mode = 4;
    s.vx = 0.34 * (o.scale ?? 1); s.vy = 0.05;
    s.rot = (i / count) * Math.PI * 2; s.spin = 5.5;
    s.life = life; s.size0 = 0.15 * (o.scale ?? 1); s.size1 = s.size0;
    k.p.emit(s);
  }
};

/** The final blow already burst on combat:hit; the KO adds the big POW, body bits, bike parts, smoke. */
function koBurst(k: Kit, pos: Vec3Like, o: BurstOpts, body: Preset): void {
  koPow(k, pos, o);
  body(k, pos, { ...o, count: k.n(16, o) });
  debris(k, pos, { ...o, color: o.color2 });
  smoke(k, pos, { ...o, count: 3 });
}

export const koFeathers: Preset = (k, pos, o) => koBurst(k, pos, o, feathers);
export const koFur: Preset = (k, pos, o) => koBurst(k, pos, o, fur);

/** Weapon bits: salted-fish scales, baguette crumbs, leek leaves, keyboard keys, slipper puff. */
export const scales: Preset = (k, pos, o) => flutter(k, pos, { ...o, color: o.color ?? '#dfe9f2', color2: '#9fb6c9' }, k.n(6, o), FRAME.scale, 0.16, 0.9);
export const crumbs: Preset = (k, pos, o) => flutter(k, pos, { ...o, color: '#f0c27a', color2: '#c98f3c' }, k.n(7, o), FRAME.puff, 0.13, 0.7);
export const leaves: Preset = (k, pos, o) => flutter(k, pos, { ...o, color: '#8fdc5a', color2: '#d9f5c0' }, k.n(6, o), FRAME.leaf, 0.2, 1.0);
export const keys: Preset = (k, pos, o) => flutter(k, pos, { ...o, color: '#ffffff' }, k.n(5, o), FRAME.keycap, 0.15, 0.8);
export const fries: Preset = (k, pos, o) => flutter(k, pos, { ...o, color: '#ffd23a', color2: '#ffb000' }, k.n(4, o), FRAME.fry, 0.18, 0.9);

/** Cartoon poof: smoke ring + puffs (ghost vanish/reappear, weapon drops). */
export const poof: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  ring(k, pos, o, 0.3 * sc, 1.4 * sc, 0.28, o.color ?? '#ffffff');
  const count = k.n(8, o);
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.1);
    k.p.colors(s, o.color ?? '#f4f4f8', o.color2 ?? '#b9b9c6');
    s.frame = FRAME.puff;
    launch(s, k.dir(d, undefined, 1), k.range(1.5, 3) * sc);
    s.life = k.range(0.4, 0.6); s.size0 = 0.25 * sc; s.size1 = 0.5 * sc;
    s.rot = k.range(0, 6.28); s.spin = k.range(-2, 2); s.drag = 5;
    inherit(s, o, 0.8);
    k.p.emit(s);
  }
};
