// Speed presets: drift sparks per level, boost bursts, wind streaks, wing trails, ult shockwave.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { ring } from './impacts';
import { inherit, launch, type BurstOpts, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();
const side = new Vector3();
const UP = new Vector3(0, 1, 0);

/** Drift colours: charging (pre-L1), L1 blue, L2 orange, L3 pink. */
export const DRIFT_COLORS: ReadonlyArray<readonly [string, string]> = [
  ['#ffffff', '#b8b8c8'], ['#bfeaff', '#1f7bff'], ['#ffe3a0', '#ff5a00'], ['#ffd0f4', '#d21fff'],
];

function driftColors(level: number | undefined): readonly [string, string] {
  return DRIFT_COLORS[Math.max(0, Math.min(3, level ?? 0))] ?? ['#ffffff', '#ffffff'];
}

/** One frame of drift sparks at the rear wheel (called continuously by the rider emitters). */
export const driftSpark: Preset = (k, pos, o) => {
  const [a, b] = driftColors(o.level);
  const count = k.n(o.level ? 3 : 1, o);
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.04);
    k.p.colors(s, a, b);
    s.frame = FRAME.spark; s.additive = true; s.mode = 1; s.k = 0.025;
    launch(s, k.dir(d, o.dir, 0.65), k.range(3, 6.5));
    s.vy = Math.abs(s.vy) + 1.5;
    s.life = k.range(0.16, 0.3); s.size0 = o.level ? 0.07 : 0.045; s.size1 = 0.02;
    s.drag = 3; s.gravity = 10;
    inherit(s, o, 0.75);
    k.p.emit(s);
  }
  if (o.level && k.rng.chance(0.35)) {
    const s = k.at(pos, 0.05);
    k.p.colors(s, '#ffffff', b);
    s.frame = FRAME.spark4; s.life = 0.14; s.size0 = 0.14; s.size1 = 0.06;
    s.rot = k.range(0, 6.28); s.spin = k.range(-8, 8);
    inherit(s, o, 0.8);
    k.p.emit(s);
  }
};

/** Mini-turbo level reached: a pop of the level colour. */
export const driftPop: Preset = (k, pos, o) => {
  const [a, b] = driftColors(o.level);
  ring(k, pos, o, 0.2, 1.3, 0.2, b);
  for (let i = 0; i < k.n(10, o); i++) driftSpark(k, pos, { ...o, count: 1 });
  const s = k.at(pos);
  k.p.colors(s, a, b);
  s.frame = FRAME.glow; s.additive = true; s.realtime = true; s.life = 0.14; s.size0 = 0.5; s.size1 = 0.8;
  inherit(s, o, 0.85);
  k.p.emit(s);
};

/** Wind streaks rushing past a moving rider; `dir` = travel direction. */
export const streaks: Preset = (k, pos, o) => {
  const fwd = d.set(o.dir?.x ?? 0, o.dir?.y ?? 0, o.dir?.z ?? -1).normalize();
  side.crossVectors(fwd, UP).normalize();
  const count = k.n(2, o);
  for (let i = 0; i < count; i++) {
    const a = k.range(0, Math.PI * 2);
    const r = k.range(0.9, 2.6) * (o.scale ?? 1);
    const ahead = k.range(1, 9);
    const s = k.p.spec();
    s.x = pos.x + fwd.x * ahead + side.x * Math.cos(a) * r;
    s.y = pos.y + 0.9 + Math.sin(a) * r * 0.6;
    s.z = pos.z + fwd.z * ahead + side.z * Math.cos(a) * r;
    k.p.colors(s, o.color ?? '#ffffff');
    s.frame = FRAME.streak; s.additive = true; s.mode = 1; s.k = 0.09;
    s.vx = -fwd.x * 6; s.vy = 0; s.vz = -fwd.z * 6;
    s.life = k.range(0.16, 0.26); s.size0 = 0.035; s.size1 = 0.02;
    k.p.emit(s);
  }
};

/** Boost start: glow + ring + a gust of streaks. */
export const boost: Preset = (k, pos, o) => {
  const s = k.at(pos);
  k.p.colors(s, '#ffffff', o.color ?? '#ffe600');
  s.frame = FRAME.glow; s.additive = true; s.realtime = true; s.life = 0.16; s.size0 = 0.7; s.size1 = 1.1;
  inherit(s, o, 0.9);
  k.p.emit(s);
  ring(k, pos, o, 0.4, 2.4, 0.24, o.color ?? '#ffffff');
  streaks(k, pos, { ...o, count: k.n(14, o) });
};

/** One trail dot at a wing tip (emitted along the swept segment every frame). */
export const wingTrail: Preset = (k, pos, o) => {
  const s = k.at(pos);
  k.p.colors(s, o.color ?? '#ffffff', '#9fdcff');
  s.frame = FRAME.streak; s.additive = true; s.mode = 1; s.k = 0.12;
  s.vx = -(o.dir?.x ?? 0) * 1.5; s.vy = 0; s.vz = -(o.dir?.z ?? 0) * 1.5;
  s.life = 0.32; s.size0 = 0.06; s.size1 = 0.02;
  k.p.emit(s);
};

/** SHOWTIME dive impact: flash glow + a ring of dust thrown out along the road (combat draws the rings). */
export const shockwave: Preset = (k, pos: Vec3Like, o: BurstOpts) => {
  const sc = o.scale ?? 1;
  const g = k.at(pos);
  k.p.colors(g, '#ffffff', '#ff8a00');
  g.frame = FRAME.glow; g.additive = true; g.realtime = true; g.life = 0.35; g.size0 = 3 * sc; g.size1 = 6 * sc;
  k.p.emit(g);
  const ground = o.ground ?? pos.y;
  for (let i = 0; i < k.n(28, o); i++) {
    const a = (i / 28) * Math.PI * 2 + k.range(-0.1, 0.1);
    const s = k.at({ x: pos.x + Math.cos(a) * 0.8, y: ground + 0.3, z: pos.z + Math.sin(a) * 0.8 });
    k.p.colors(s, '#f4ede0', '#cbbda6');
    s.frame = FRAME.puff;
    const v = k.range(7, 13) * sc;
    s.vx = Math.cos(a) * v; s.vy = k.range(0.6, 2.4); s.vz = Math.sin(a) * v;
    s.life = k.range(0.7, 1.1); s.size0 = 0.45 * sc; s.size1 = 1.2 * sc;
    s.rot = k.range(0, 6.28); s.spin = k.range(-2, 2); s.drag = 2.6;
    k.p.emit(s);
  }
};
