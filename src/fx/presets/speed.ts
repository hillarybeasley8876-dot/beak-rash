// Speed presets: drift sparks per level, boost bursts, wind lines, ult shockwave.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { groundRing } from './ground';
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

/** Inked star flat on the road under the wheel (rides with the source): the contact flash. */
function groundStar(k: Kit, pos: Vec3Like, o: BurstOpts, color: string, size: number, life: number): void {
  const s = k.at(pos);
  k.p.colors(s, '#ffffff', color);
  s.frame = FRAME.spark4; s.mode = 2; s.life = life; s.size0 = size; s.size1 = size * 0.7; s.rot = k.range(0, 6.28);
  inherit(s, o, 1);
  k.p.emit(s);
}

const INK_SIZE = [0, 0.22, 0.3, 0.38];

/** One frame of drift sparks at the rear wheel (called continuously by the rider emitters). Every level
 *  is bigger than the last: more and fatter hot streaks, more inked sparks, and zaps at L3. */
export const driftSpark: Preset = (k, pos, o) => {
  const [a, b] = driftColors(o.level);
  const lv = Math.max(0, Math.min(3, o.level ?? 0));
  if (!lv) {
    hotSparks(k, pos, o, k.n(1, o), 0.05, a, b);
    return;
  }
  hotSparks(k, pos, o, k.n(2 + lv, o), lv === 3 ? 0.16 : 0.1, a, b);
  const inked = lv === 1 ? (k.rng.chance(0.5) ? 1 : 0) : lv;
  for (let i = 0; i < inked; i++) inkSpark(k, pos, o, b, a, INK_SIZE[lv] ?? 0.22);
  if (k.rng.chance(0.35)) groundStar(k, pos, o, b, 0.45 + 0.15 * lv, 0.06);
  if (lv === 3 && k.rng.chance(0.2)) {
    const z = k.at(pos, 0.15);
    k.p.colors(z, '#ffffff', b);
    z.frame = FRAME.zap; z.life = 0.08; z.size0 = 0.45; z.size1 = 0.55; z.rot = k.range(0, 6.28); z.realtime = true;
    inherit(z, o, 1);
    k.p.emit(z);
  }
};

/** Mini-turbo level reached: a flat shock ring and a star on the road, a spray in the level colour. */
export const driftPop: Preset = (k, pos, o) => {
  const [a, b] = driftColors(o.level);
  groundRing(k, pos, { ...o, ground: pos.y }, 0.2, 1.6, 0.22, b, 1);
  hotSparks(k, pos, o, k.n(12, o), 0.12, a, b);
  for (let i = 0; i < 3; i++) inkSpark(k, pos, o, b, a, 0.3);
  groundStar(k, pos, o, b, 1, 0.14);
};

/** Wind lines the rider rushes through: thin world-space lines along the travel direction (mode 5, ~2.5 px
 *  wide, tapered) that converge in perspective like anime speed lines. Half run in a corridor 4-5.5 m to
 *  either side of the rider, half 2-3 m up (screen periphery from the chase camera), never across rivals
 *  or the sky ahead; `pos` = rider on the road, `dir` = travel direction, colour = additive brightness. */
export const streaks: Preset = (k, pos, o) => {
  const fwd = d.set(o.dir?.x ?? 0, 0, o.dir?.z ?? -1).normalize();
  side.crossVectors(fwd, UP).normalize();
  const count = k.n(2, o);
  const sc = o.scale ?? 1;
  for (let i = 0; i < count; i++) {
    const high = k.rng.chance(0.5);
    const lateral = (k.rng.chance(0.5) ? 1 : -1) * (high ? k.range(1.2, 4) : k.range(4, 5.5)) * sc;
    const ahead = k.range(-2.5, 2.5);
    const s = k.p.spec();
    s.x = pos.x + fwd.x * ahead + side.x * lateral;
    s.y = pos.y + (high ? k.range(2, 3) : k.range(0.4, 2.2));
    s.z = pos.z + fwd.z * ahead + side.z * lateral;
    k.p.colors(s, o.color ?? '#a6a6a6');
    s.frame = FRAME.streak; s.additive = true; s.mode = 5; s.k = k.range(0.2, 0.3);
    s.vx = -fwd.x * 8; s.vy = 0; s.vz = -fwd.z * 8;
    s.life = k.range(0.16, 0.26); s.size0 = 0.22; s.size1 = 0.1;
    k.p.emit(s);
  }
};

/** Boost start: a flat shock ring on the road at the rear wheel, a backward cone of spikes in the boost colour
 *  and a gust of wind lines. Nothing round the torso (a hoop there read as a debug gizmo, a glow washed the
 *  rider out). `pos` = body, `dir` = travel direction. */
export const boost: Preset = (k, pos, o) => {
  const color = o.color ?? '#ffe600';
  const ground = o.ground ?? pos.y - 1.3;
  aft.set(-(o.dir?.x ?? 0), 0.25, -(o.dir?.z ?? -1)).normalize();
  groundRing(k, { x: pos.x + aft.x * 0.55, y: ground, z: pos.z + aft.z * 0.55 }, { ...o, ground: ground + 0.04 }, 0.4, 2.4, 0.22, color, 0.9);
  const at = { x: pos.x + aft.x * 0.5, y: pos.y - 0.8, z: pos.z + aft.z * 0.5 };
  hotSparks(k, at, { ...o, dir: aft }, k.n(12, o), 0.12, '#ffffff', color);
  for (let i = 0; i < 3; i++) inkSpark(k, at, { ...o, dir: aft }, color, '#ffffff', 0.26);
  streaks(k, { x: pos.x, y: ground, z: pos.z }, { ...o, count: k.n(6, o), color: '#b3b3b3' });
};

/** SHOWTIME dive impact: a short flash, a flat shock ring racing out along the road and a few big, varied
 *  dust clouds hugging the road (combat draws the coloured rings); the victims stay the subject. */
export const shockwave: Preset = (k, pos: Vec3Like, o: BurstOpts) => {
  const sc = o.scale ?? 1;
  const g = k.at(pos);
  k.p.colors(g, '#ffffff', '#ff8a00');
  g.frame = FRAME.glow; g.additive = true; g.realtime = true; g.life = 0.25; g.size0 = 2.2 * sc; g.size1 = 4 * sc;
  k.p.emit(g);
  const ground = o.ground ?? pos.y;
  const r = k.at({ x: pos.x, y: ground + 0.06, z: pos.z });
  k.p.colors(r, '#ffffff', '#ffe2b8');
  r.frame = FRAME.shock; r.mode = 2; r.life = 0.45; r.size0 = 1.5 * sc; r.size1 = 18 * sc; r.erode = true; r.realtime = true;
  k.p.emit(r);
  const n = k.n(9, o);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + k.range(-0.3, 0.3);
    const s = k.at({ x: pos.x + Math.cos(a) * 0.6, y: ground + 0.35, z: pos.z + Math.sin(a) * 0.6 });
    const shade = i % 3 === 0;
    k.p.colors(s, shade ? '#dccdb2' : '#f6efe2', shade ? '#a8977c' : '#d7cab3');
    s.frame = FRAME.puff;
    const v = k.range(4, 8) * sc;
    s.vx = Math.cos(a) * v; s.vy = k.range(0.2, 1); s.vz = Math.sin(a) * v;
    const size = k.range(0.6, 1.6) * sc;
    s.life = k.range(0.32, 0.45); s.size0 = 0.6 * size; s.size1 = 1.5 * size;
    s.rot = k.range(0, 6.28); s.spin = k.range(-1.5, 1.5); s.drag = 3;
    k.p.emit(s);
  }
};
