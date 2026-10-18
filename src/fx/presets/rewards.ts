// Reward presets: finish confetti, coin sparkle, pickup bursts.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { inherit, launch, type BurstOpts, type Kit, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();
const CONFETTI = ['#e5191c', '#ffe600', '#ffffff', '#0b0b0f', '#2ad1ff', '#ff4fd8'] as const;

export const confetti: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const count = k.n(44, o);
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.4 * sc);
    const c = o.color && i % 2 === 0 ? o.color : (CONFETTI[i % CONFETTI.length] ?? '#ffffff');
    k.p.colors(s, c);
    s.frame = i % 5 === 0 ? FRAME.star5 : FRAME.confetti; s.mode = 3; s.k = k.range(0.15, 0.4);
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.45), k.range(5, 10) * sc);
    s.life = k.range(2.2, 3.2); s.size0 = k.range(0.09, 0.14) * sc; s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-6, 6); s.drag = 1.6; s.gravity = 4;
    inherit(s, o, 0.7, 0.8);
    k.p.emit(s);
  }
};

function glints(k: Kit, pos: Vec3Like, o: BurstOpts, count: number, color: string): void {
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.25);
    k.p.colors(s, '#ffffff', color);
    // Needle glints twinkle: pop in, hold, gone within 0.15 s (staggered so the set keeps flickering).
    const star = i % 3 === 2;
    s.frame = star ? FRAME.star5 : FRAME.glint;
    launch(s, k.dir(d, { x: 0, y: 1, z: 0 }, 0.8), k.range(1, 2.5));
    s.life = star ? k.range(0.3, 0.45) : k.range(0.1, 0.15); s.delay = star ? 0 : k.range(0, 0.18);
    s.size0 = star ? k.range(0.12, 0.18) : k.range(0.22, 0.32); s.size1 = star ? 0.04 : s.size0 * 0.8;
    s.rot = star ? k.range(0, 6.28) : k.range(-0.3, 0.3); s.spin = star ? k.range(-6, 6) : 0; s.drag = 3; s.gravity = -1;
    inherit(s, o, 0.9);
    k.p.emit(s);
  }
}

export const coin: Preset = (k, pos, o) => {
  const s = k.at(pos);
  k.p.colors(s, '#ffd23a', '#ffb000');
  s.frame = FRAME.coin; s.mode = 3; s.k = 0.02;
  s.vy = 3.2; s.life = 0.55; s.size0 = 0.3; s.size1 = 0.24; s.gravity = 9;
  inherit(s, o, 0.95);
  k.p.emit(s);
  const g = k.at(pos);
  k.p.colors(g, '#fff3a0', '#ffb000');
  g.frame = FRAME.glow; g.additive = true; g.life = 0.25; g.size0 = 0.6; g.size1 = 0.9;
  inherit(g, o, 0.95);
  k.p.emit(g);
  glints(k, pos, o, k.n(4, o), '#ffd23a');
};

/** Generic sparkle (SP can, perfect landing, combo): twinkling needle glints and a few stars. */
export const sparkle: Preset = (k, pos, o) => {
  glints(k, pos, o, k.n(8, o), o.color ?? '#ffe600');
};

/** Fish (+HP): green '+' glyphs and a couple of hearts floating up. */
export const heal: Preset = (k, pos, o) => {
  for (let i = 0; i < k.n(6, o); i++) {
    const s = k.at(pos, 0.35);
    const heart = i % 3 === 2;
    k.p.colors(s, heart ? '#ff4f9a' : '#7dff8a', heart ? '#ff7ab8' : '#19c45a');
    s.frame = heart ? FRAME.heart : FRAME.plus; s.vy = k.range(1.2, 2.2); s.vx = k.range(-0.5, 0.5); s.vz = k.range(-0.5, 0.5);
    s.life = k.range(0.6, 0.9); s.size0 = k.range(0.14, 0.2); s.size1 = s.size0; s.drag = 1.5;
    s.rot = k.range(-0.4, 0.4);
    inherit(s, o, 0.95);
    k.p.emit(s);
  }
};

/** Weapon crate: wooden slats + dust. */
export const crate: Preset = (k, pos, o) => {
  const count = k.n(8, o);
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.15);
    k.p.colors(s, '#d79a55', '#a8682e');
    s.frame = i % 3 === 0 ? FRAME.bolt : FRAME.stick;
    launch(s, k.dir(d, { x: 0, y: 1, z: 0 }, 0.7), k.range(3, 6));
    s.life = k.range(0.7, 1.1); s.size0 = s.frame === FRAME.stick ? 0.22 : 0.08; s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-12, 12); s.gravity = 14; s.drag = 0.8;
    s.ground = o.ground ?? pos.y - 0.6;
    inherit(s, o, 0.8, 1);
    k.p.emit(s);
  }
  glints(k, pos, o, 3, '#ffe600');
};
