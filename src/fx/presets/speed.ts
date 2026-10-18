// Speed presets: drift sparks per level, boost bursts, wind lines, ult shockwave.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { ring } from './impacts';
import { inherit, launch, type BurstOpts, type Kit, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();
const side = new Vector3();
const aft = new Vector3();
const UP = new Vector3(0, 1, 0);

/** Drift colours: charging (pre-L1), L1 blue, L2 orange, L3 pink. */
export const DRIFT_COLORS: ReadonlyArray<readonly [string, string]> = [
  ['#ffffff', '#b8b8c8'], ['#bfeaff', '#1f7bff'], ['#ffe3a0', '#ff5a00'], ['#ffd0f4', '#d21fff'],
];

function driftColors(level: number | undefined): readonly [string, string] {
  return DRIFT_COLORS[Math.max(0, Math.min(3, level ?? 0))] ?? ['#ffffff', '#ffffff'];
}

/** Hot additive streak sparks thrown along `o.dir` (drift spray, boost flare). */
function hotSparks(k: Kit, pos: Vec3Like, o: BurstOpts, count: number, size: number, a: string, b: string): void {
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.04);
    k.p.colors(s, a, b);
    s.frame = FRAME.spark; s.additive = true; s.mode = 1; s.k = 0.045;
    launch(s, k.dir(d, o.dir, 0.6), k.range(4, 8));
    s.vy = Math.abs(s.vy) + 1.8;
    s.life = k.range(0.18, 0.32); s.size0 = size; s.size1 = size * 0.3;
    s.drag = 2.5; s.gravity = 11;
    inherit(s, o, 0.6);
    k.p.emit(s);
  }
}

/** Inked comic spark in the level colour: the part of the spray that still reads on a sunny road. */
function inkSpark(k: Kit, pos: Vec3Like, o: BurstOpts, color: string, pale: string, size: number): void {
  const s = k.at(pos, 0.06);
  k.p.colors(s, color, pale);
  s.frame = FRAME.spark4; s.life = k.range(0.1, 0.16); s.size0 = size * k.range(0.8, 1.2); s.size1 = size * 0.3;
  s.rot = k.range(0, 6.28); s.spin = k.range(-10, 10);
  launch(s, k.dir(d, o.dir, 0.8), k.range(1, 2.5));
  inherit(s, o, 0.85);
  k.p.emit(s);
}

/** Additive flare that rides with the source (wheel contact, level pop). */
function flare(k: Kit, pos: Vec3Like, o: BurstOpts, color: string, size: number, life: number): void {
  const s = k.at(pos);
  k.p.colors(s, color);
  s.frame = FRAME.glow; s.additive = true; s.life = life; s.size0 = size; s.size1 = size * 0.6;
  inherit(s, o, 1);
  k.p.emit(s);
}

/** One frame of drift sparks at the rear wheel (called continuously by the rider emitters). */
export const driftSpark: Preset = (k, pos, o) => {
  const [a, b] = driftColors(o.level);
  if (!o.level) {
    hotSparks(k, pos, o, k.n(1, o), 0.05, a, b);
    return;
  }
  hotSparks(k, pos, o, k.n(3, o), 0.1, a, b);
  if (k.rng.chance(0.5)) inkSpark(k, pos, o, b, a, 0.22);
  flare(k, pos, o, b, k.range(0.45, 0.6), 0.07);
};

/** Mini-turbo level reached: a pop of the level colour. */
export const driftPop: Preset = (k, pos, o) => {
  const [a, b] = driftColors(o.level);
  ring(k, pos, o, 0.2, 1.3, 0.2, b);
  hotSparks(k, pos, o, k.n(12, o), 0.12, a, b);
  for (let i = 0; i < 3; i++) inkSpark(k, pos, o, b, a, 0.3);
  flare(k, pos, o, b, 0.9, 0.14);
};

/** Wind lines the rider rushes through: world-space lines along the travel direction (mode 5), so they
 *  converge in perspective like anime speed lines; `dir` = travel direction. */
export const streaks: Preset = (k, pos, o) => {
  const fwd = d.set(o.dir?.x ?? 0, o.dir?.y ?? 0, o.dir?.z ?? -1).normalize();
  side.crossVectors(fwd, UP).normalize();
  const count = k.n(2, o);
  for (let i = 0; i < count; i++) {
    const a = k.range(0, Math.PI * 2);
    const r = k.range(1.2, 3) * (o.scale ?? 1);
    const ahead = k.range(0, 8);
    const s = k.p.spec();
    s.x = pos.x + fwd.x * ahead + side.x * Math.cos(a) * r;
    s.y = pos.y + Math.max(0.15, 1 + Math.sin(a) * r * 0.6);
    s.z = pos.z + fwd.z * ahead + side.z * Math.cos(a) * r;
    k.p.colors(s, o.color ?? '#ffffff');
    s.frame = FRAME.streak; s.additive = true; s.mode = 5; s.k = k.range(0.4, 0.6);
    s.vx = -fwd.x * 8; s.vy = 0; s.vz = -fwd.z * 8;
    s.life = k.range(0.16, 0.26); s.size0 = 0.22; s.size1 = 0.1; // the streak sprite lights ~20 % of the quad width
    k.p.emit(s);
  }
};

/** Boost start: a ring round the rider, a flare of the boost colour blasting out behind the wheel and a gust
 *  of wind lines. No glow on the body (it washed the rider out). `pos` = body, `dir` = travel direction. */
export const boost: Preset = (k, pos, o) => {
  const color = o.color ?? '#ffe600';
  ring(k, pos, o, 0.5, 2.2, 0.2, color);
  aft.set(-(o.dir?.x ?? 0), 0.25, -(o.dir?.z ?? -1)).normalize();
  const at = { x: pos.x + aft.x * 0.5, y: pos.y - 0.8, z: pos.z + aft.z * 0.5 };
  hotSparks(k, at, { ...o, dir: aft }, k.n(12, o), 0.12, '#ffffff', color);
  for (let i = 0; i < 3; i++) inkSpark(k, at, { ...o, dir: aft }, color, '#ffffff', 0.26);
  streaks(k, { x: pos.x, y: o.ground ?? pos.y - 1.3, z: pos.z }, { ...o, count: k.n(16, o) });
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
