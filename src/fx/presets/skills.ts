// Skill flair presets: honk shout lines, chill aura, OIIA spin swirls, flash zaps, whistle notes,
// doge shield sparkles. Combat owns the skill meshes; these are the comic accents around them.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { ring } from './impacts';
import { inherit, launch, type Preset } from './kit';

const d = new Vector3();

/** Shout lines + ring bursting from a head (goose honk, bell). */
export const shout: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const s = k.at(pos);
  k.p.colors(s, o.color ?? '#ffffff');
  s.frame = FRAME.rays; s.realtime = true; s.life = 0.22; s.size0 = 1.2 * sc; s.size1 = 2.2 * sc; s.rot = k.range(0, 6.28);
  inherit(s, o, 0.95);
  k.p.emit(s);
  ring(k, pos, o, 0.3 * sc, 2.6 * sc, 0.3, o.color ?? '#ffffff');
};

/** Flat aura ring on the road + rising sparkles (capybara chill, shields). */
export const aura: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const g = k.at(pos);
  g.y = o.ground ?? pos.y;
  k.p.colors(g, o.color ?? '#9fe3ff');
  g.frame = FRAME.ring; g.mode = 2; g.erode = true; g.life = 0.9; g.size0 = 1; g.size1 = 6 * sc;
  inherit(g, o, 0.95);
  k.p.emit(g);
  for (let i = 0; i < k.n(10, o); i++) {
    const s = k.at(pos, 1.2 * sc);
    k.p.colors(s, '#ffffff', o.color2 ?? o.color ?? '#9fe3ff');
    s.frame = i % 3 ? FRAME.star5 : FRAME.spark4;
    s.vy = k.range(0.8, 1.8); s.life = k.range(0.6, 1.0); s.size0 = k.range(0.08, 0.14); s.size1 = 0.04;
    s.rot = k.range(0, 6.28); s.spin = k.range(-4, 4); s.drag = 1;
    inherit(s, o, 0.95);
    k.p.emit(s);
  }
};

/** Swirls orbiting a rider (needs `follow`) + fur flying off: the OIIA spin. */
export const spin: Preset = (k, pos, o) => {
  for (let i = 0; i < 4; i++) {
    const s = k.p.spec();
    if (o.follow === undefined) { s.x = pos.x; s.y = pos.y - 0.4; s.z = pos.z; } else { s.y = -0.4; s.follow = o.follow; }
    k.p.colors(s, i % 2 ? '#ffffff' : (o.color ?? '#f2a03d'));
    s.frame = FRAME.swirl; s.mode = 4; s.vx = 1.1 * (o.scale ?? 1); s.vy = 0.15;
    s.rot = (i / 4) * Math.PI * 2; s.spin = 14; s.life = 0.8; s.size0 = 0.4; // the 0.8 s OIIA spin s.size1 = 0.3;
    k.p.emit(s);
  }
  for (let i = 0; i < k.n(8, o); i++) {
    const s = k.at(pos, 0.3);
    k.p.colors(s, o.color ?? '#f2a03d', o.color2 ?? '#fff4e0');
    s.frame = FRAME.fur; s.mode = 3; s.k = 0.15;
    launch(s, k.dir(d, { x: 0, y: 0.3, z: 0 }, 1), k.range(3, 6));
    s.life = k.range(0.7, 1.1); s.size0 = 0.16; s.size1 = 0.16; s.drag = 3; s.gravity = 2;
    s.rot = k.range(0, 6.28); s.spin = k.range(-6, 6);
    inherit(s, o, 0.6, 1);
    k.p.emit(s);
  }
};

/** Lightning zaps crackling around a rider (sloth flash). */
export const zaps: Preset = (k, pos, o) => {
  for (let i = 0; i < k.n(6, o); i++) {
    const s = k.at(pos, 0.7);
    k.p.colors(s, '#fff9b0', '#ffd000');
    s.frame = FRAME.zap; s.life = k.range(0.12, 0.22); s.size0 = k.range(0.3, 0.45); s.size1 = s.size0 * 0.8;
    s.rot = k.range(-0.8, 0.8); s.delay = k.range(0, 0.25);
    inherit(s, o, 0.98);
    k.p.emit(s);
  }
  const g = k.at(pos);
  k.p.colors(g, '#fff6a0', '#ffd000');
  g.frame = FRAME.glow; g.additive = true; g.life = 0.25; g.size0 = 0.9; g.size1 = 1.4;
  inherit(g, o, 0.98);
  k.p.emit(g);
};

/** Music notes rising (corgi whistle, bell). */
export const notes: Preset = (k, pos, o) => {
  for (let i = 0; i < k.n(5, o); i++) {
    const s = k.at(pos, 0.25);
    k.p.colors(s, i % 2 ? '#ffffff' : (o.color ?? '#ffe600'));
    s.frame = FRAME.note; s.mode = 3; s.k = 0.12;
    s.vx = k.range(-0.8, 0.8); s.vy = k.range(1.6, 2.6); s.vz = k.range(-0.8, 0.8);
    s.life = k.range(0.6, 0.9); s.size0 = k.range(0.16, 0.22); s.size1 = s.size0; s.drag = 1.2; s.delay = i * 0.04;
    inherit(s, o, 0.95);
    k.p.emit(s);
  }
};
