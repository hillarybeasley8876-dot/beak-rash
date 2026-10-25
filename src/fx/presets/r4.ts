// r4 effect presets (fx unit, SPEC §14-§19): the air-trick trail and landing burst, the pan parry, the
// throw release, the downed corgi, the tipped fish truck, the goose flock, the smashed fruit stall and the
// rubber duck. All of them read the same BurstOpts as the older presets.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { dust, groundRing, smoke } from './ground';
import { ring } from './impacts';
import { inherit, launch, type BurstOpts, type Kit, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();
const back = new Vector3();

/** The trick count of a landing (`o.level`, 1 = one trick): more tricks, a bigger burst. */
function trickScale(o: BurstOpts): number {
  const tricks = Math.max(1, o.level ?? 1);
  return (o.scale ?? 1) * (0.85 + 0.3 * (tricks - 1));
}

/** A soft additive glow blob (the flash of a big moment). */
function flash(k: Kit, pos: Vec3Like, o: BurstOpts, size: number, color: string, life: number): void {
  const s = k.at(pos);
  k.p.colors(s, color);
  s.frame = FRAME.glow; s.additive = true; s.realtime = true;
  s.life = life; s.size0 = size; s.size1 = size * 1.35;
  inherit(s, o, 0.9);
  k.p.emit(s);
}

/** A comic star spinning away from the burst. */
function star(k: Kit, pos: Vec3Like, o: BurstOpts, color: string, size: number, speed: number): void {
  const s = k.at(pos, 0.06);
  k.p.colors(s, color);
  s.frame = FRAME.star5;
  launch(s, k.dir(d, o.dir, 0.85), speed);
  s.vy = Math.abs(s.vy) + 2.2;
  s.life = k.range(0.4, 0.6); s.size0 = size; s.size1 = size * 0.7;
  s.rot = k.range(0, 6.28); s.spin = k.range(-9, 9); s.drag = 2.4; s.gravity = 9;
  inherit(s, o, 0.85);
  k.p.emit(s);
}

/** An inked comic spark (reads on a bright road where an additive one would wash out). */
function inkSpark(k: Kit, pos: Vec3Like, o: BurstOpts, color: string, size: number): void {
  const s = k.at(pos, 0.05);
  k.p.colors(s, color);
  s.frame = FRAME.spark4;
  launch(s, k.dir(d, o.dir, 0.8), k.range(2, 4.5));
  s.life = k.range(0.12, 0.2); s.size0 = size; s.size1 = size * 0.35;
  s.rot = k.range(0, 6.28); s.spin = k.range(-12, 12);
  inherit(s, o, 0.9);
  k.p.emit(s);
}

/**
 * The trick trail: bright ribbons and streaks shed by a rider who is spinning or flipping in the air.
 * Cheap by design (the emitter calls it every other frame while the trick runs): three stretched additive
 * streaks left behind the rider plus one inked spark, so the trick reads even in daylight.
 */
export const trickTrail: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const color = o.color ?? '#7ff0ff';
  back.set(-(o.dir?.x ?? 0), 0.25, -(o.dir?.z ?? -1)).normalize();
  for (let i = 0; i < 3; i++) {
    const s = k.at(pos, 0.1);
    k.p.colors(s, '#ffffff', color);
    s.frame = FRAME.streak; s.additive = true; s.mode = 1; s.k = 0.05;
    launch(s, k.dir(d, back, 0.35), k.range(4, 8) * sc);
    s.vy += 0.6;
    s.life = k.range(0.22, 0.34); s.size0 = 0.22 * sc; s.size1 = 0.06;
    s.drag = 2.4; s.gravity = 2;
    inherit(s, o, 0.95);
    k.p.emit(s);
  }
  inkSpark(k, pos, { ...o, dir: back }, color, 0.2 * sc);
};

/**
 * The landed trick: a star burst and a ring on the ground, bigger with the number of tricks in that air
 * (`o.level` = the trick count). The points are the punchline, so it is the brightest burst on the track.
 */
export const trickLand: Preset = (k, pos, o) => {
  const sc = trickScale(o);
  const color = o.color ?? '#ffe600';
  flash(k, pos, o, 0.7 * sc, '#fff3c8', 0.16);
  for (let i = 0; i < Math.ceil(k.n(5, o)); i++) star(k, pos, o, i % 2 ? '#ffffff' : color, 0.16 * sc, k.range(3, 5.5) * sc);
  const r = k.at(pos);
  k.p.colors(r, color);
  r.frame = FRAME.rays; r.realtime = true; r.life = 0.14; r.size0 = 1.1 * sc; r.size1 = 1.5 * sc; r.rot = k.range(0, 6.28);
  inherit(r, o, 0.95);
  k.p.emit(r);
  ring(k, { x: pos.x, y: pos.y + 0.2, z: pos.z }, o, 0.3 * sc, 1.5 * sc, 0.26, '#ffffff');
  groundRing(k, pos, { ...o, ground: o.ground ?? pos.y - 0.9 }, 0.4 * sc, 2.2 * sc, 0.3, color, 0.8);
  inkSpark(k, pos, o, color, 0.3 * sc);
};

/**
 * The pan parry ("当！"): a big metallic spark star in the middle of a white shock ring, with the metal
 * sparks flying off. The white ring is the punctuation, the star the hit.
 */
export const parry: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  flash(k, pos, o, 0.9 * sc, '#ffffff', 0.12);
  const star0 = k.at(pos);
  k.p.colors(star0, '#ffffff', '#ffe600');
  star0.frame = FRAME.spark4; star0.realtime = true; star0.life = 0.2;
  star0.size0 = 1.1 * sc; star0.size1 = 1.5 * sc; star0.rot = k.range(0, 6.28); star0.spin = k.range(-3, 3);
  inherit(star0, o, 0.9);
  k.p.emit(star0);
  ring(k, pos, o, 0.25 * sc, 2.2 * sc, 0.3, '#ffffff');
  for (let i = 0; i < k.n(14, o); i++) {
    const s = k.at(pos, 0.05);
    k.p.colors(s, '#fffbe0', '#ff7a00');
    s.frame = FRAME.spark; s.additive = true; s.mode = 1;
    launch(s, k.dir(d, o.dir, 0.8), k.range(6, 11) * sc);
    s.life = k.range(0.18, 0.3); s.size0 = 0.1 * sc; s.size1 = 0.03;
    s.drag = 5; s.gravity = 8; s.k = 0.04;
    inherit(s, o, 0.85);
    k.p.emit(s);
  }
  inkSpark(k, pos, o, '#ffffff', 0.34 * sc);
};

/**
 * The release of a thrown weapon: a short fan of streaks in the throw direction, plus the weapon's own
 * glow (the slipper's is pink, so the caller passes the colour).
 */
export const throwTrail: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const color = o.color ?? '#ffffff';
  const dir = d.set(o.dir?.x ?? 0, o.dir?.y ?? 0, o.dir?.z ?? -1);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();
  for (let i = 0; i < 3; i++) {
    const s = k.at(pos, 0.05);
    k.p.colors(s, '#ffffff', color);
    s.frame = FRAME.streak; s.additive = true; s.mode = 1; s.k = 0.05;
    launch(s, k.dir(d, dir, 0.22), k.range(5, 9) * sc);
    s.life = k.range(0.16, 0.26); s.size0 = 0.18 * sc; s.size1 = 0.05;
    s.drag = 3.5; s.gravity = 1.5;
    inherit(s, o, 0.9);
    k.p.emit(s);
  }
  const g = k.at(pos);
  k.p.colors(g, color, '#ffffff');
  g.frame = FRAME.glow; g.additive = true; g.realtime = true; g.life = 0.14; g.size0 = 0.45 * sc; g.size1 = 0.7 * sc;
  inherit(g, o, 0.95);
  k.p.emit(g);
  inkSpark(k, pos, o, color, 0.2 * sc);
};

/** A downed corgi: cartoon stars over its head, its police cap spinning off and a puff of road dust. */
export const policeDown: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  for (let i = 0; i < k.n(5, o); i++) star(k, { x: pos.x, y: pos.y + 0.5, z: pos.z }, o, i % 2 ? '#ffe600' : '#ffffff', 0.16 * sc, 3.4);
  const cap = k.at({ x: pos.x, y: pos.y + 0.9, z: pos.z });
  k.p.colors(cap, '#2f4fa8', '#12224d');
  cap.frame = FRAME.cap;
  launch(cap, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.6), k.range(3.5, 6) * sc);
  cap.vy = Math.abs(cap.vy) + 4.5;
  cap.life = 1.1; cap.size0 = 0.4 * sc; cap.size1 = 0.36 * sc;
  cap.rot = k.range(0, 6.28); cap.spin = k.range(-12, 12);
  cap.drag = 1.2; cap.gravity = 13; cap.ground = (o.ground ?? pos.y - 0.6) + 0.05;
  inherit(cap, o, 0.5, 1.5);
  k.p.emit(cap);
  dust(k, { x: pos.x, y: pos.y - 0.3, z: pos.z }, { ...o, count: k.n(5, o) });
  smoke(k, pos, { ...o, count: 2 });
};

/** The tipped fish truck: a big cloud of road dust and a few bits of grit. */
export const truckDust: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.4;
  for (let i = 0; i < k.n(11, o); i++) {
    const s = k.at({ x: pos.x, y: ground + 0.2, z: pos.z }, 0.5 * sc);
    k.p.colors(s, i % 3 === 0 ? '#d9c9ad' : '#f4ede0', i % 3 === 0 ? '#a8977c' : '#d9cdb8');
    s.frame = FRAME.puff;
    const a = k.range(0, Math.PI * 2);
    const v = k.range(2, 5.5) * sc;
    s.vx = Math.cos(a) * v; s.vy = k.range(0.3, 1.4); s.vz = Math.sin(a) * v;
    s.life = k.range(0.6, 1.1); s.size0 = k.range(0.4, 0.8) * sc; s.size1 = s.size0 * 2.2;
    s.rot = k.range(0, 6.28); s.spin = k.range(-1.5, 1.5); s.drag = 2.6; s.gravity = -0.3;
    s.ground = ground + 0.02;
    inherit(s, o, 0.3, 2);
    k.p.emit(s);
  }
  for (let i = 0; i < k.n(5, o); i++) {
    const s = k.at({ x: pos.x, y: ground + 0.1, z: pos.z }, 0.4);
    k.p.colors(s, '#8f7f66', '#5f5442');
    s.frame = i % 2 ? FRAME.drop : FRAME.stick; s.mode = 1; s.k = 0.03;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.7), k.range(3, 6.5) * sc);
    s.vy = Math.abs(s.vy) + 2;
    s.life = k.range(0.4, 0.6); s.size0 = 0.08 * sc; s.size1 = 0.05;
    s.gravity = 14; s.drag = 1; s.ground = ground + 0.04;
    inherit(s, o, 0.4, 2);
    k.p.emit(s);
  }
};

/** The spilled fish: little fish flopping out of the truck and the water they splashed. */
export const fishSplash: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.5;
  for (let i = 0; i < k.n(6, o); i++) {
    const s = k.at({ x: pos.x, y: ground + 0.2, z: pos.z }, 0.4);
    k.p.colors(s, '#cfe6f2', '#7fb6cf');
    s.frame = FRAME.fish; s.mode = 3; s.k = k.range(0.1, 0.22);
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.8), k.range(2.5, 5) * sc);
    s.vy = Math.abs(s.vy) + 3.4;
    s.life = k.range(0.9, 1.4); s.size0 = 0.24 * sc; s.size1 = 0.24 * sc;
    s.rot = k.range(0, 6.28); s.spin = k.range(-7, 7);
    s.drag = 1.6; s.gravity = 12; s.ground = ground + 0.05;
    inherit(s, o, 0.4, 1.6);
    k.p.emit(s);
  }
  for (let i = 0; i < k.n(10, o); i++) {
    const s = k.at({ x: pos.x, y: ground + 0.1, z: pos.z }, 0.3);
    k.p.colors(s, '#ffffff', '#8fd8ff');
    s.frame = FRAME.drop; s.mode = 1; s.k = 0.03;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.6), k.range(2.5, 5.5) * sc);
    s.life = k.range(0.4, 0.7); s.size0 = 0.13 * sc; s.size1 = 0.09 * sc;
    s.drag = 0.9; s.gravity = 13; s.ground = ground + 0.03;
    inherit(s, o, 0.4, 2);
    k.p.emit(s);
  }
  groundRing(k, pos, { ...o, ground }, 0.3 * sc, 1.8 * sc, 0.4, '#dff3ff', 0.5);
};

/** The goose flock: white feathers everywhere. */
export const gooseFeathers: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const count = k.n(12, o);
  for (let i = 0; i < count; i++) {
    const s = k.at(pos, 0.25 * sc);
    k.p.colors(s, i % 3 === 2 ? '#e8e4dc' : '#ffffff', '#d8d4cc');
    s.frame = FRAME.feather; s.mode = 3; s.k = k.range(0.12, 0.3);
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.85), k.range(2.5, 6) * sc);
    s.life = k.range(0.9, 1.4); s.size0 = 0.26 * sc * k.range(0.8, 1.25); s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-3, 3);
    s.drag = 3.2; s.gravity = 2.4;
    inherit(s, o, 0.55, 1.2);
    k.p.emit(s);
  }
};

/** A smashed fruit stall: watermelon wedges and fruit bouncing off the road. */
export const fruit: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.6;
  const melons = ['#ff4f6a', '#e5191c', '#ff7a94'];
  for (let i = 0; i < k.n(5, o); i++) {
    const s = k.at({ x: pos.x, y: pos.y + 0.3, z: pos.z }, 0.3);
    k.p.colors(s, melons[i % melons.length] ?? '#ff4f6a', '#2f9e4a');
    s.frame = FRAME.melon; s.mode = 3; s.k = k.range(0.08, 0.18);
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.7), k.range(3, 6.5) * sc);
    s.vy = Math.abs(s.vy) + 3;
    s.life = k.range(1, 1.5); s.size0 = 0.26 * sc; s.size1 = 0.26 * sc;
    s.rot = k.range(0, 6.28); s.spin = k.range(-9, 9);
    s.drag = 1.4; s.gravity = 13; s.ground = ground + 0.05;
    inherit(s, o, 0.5, 1.6);
    k.p.emit(s);
  }
  for (let i = 0; i < k.n(4, o); i++) {
    const s = k.at({ x: pos.x, y: pos.y + 0.3, z: pos.z }, 0.25);
    k.p.colors(s, i % 2 ? '#ffd23a' : '#ff9a3a', '#c96a12');
    s.frame = FRAME.fruit; s.mode = 3; s.k = k.range(0.1, 0.2);
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.75), k.range(3, 6) * sc);
    s.vy = Math.abs(s.vy) + 2.6;
    s.life = k.range(1, 1.4); s.size0 = 0.22 * sc; s.size1 = 0.22 * sc;
    s.rot = k.range(0, 6.28); s.spin = k.range(-8, 8);
    s.drag = 1.5; s.gravity = 13; s.ground = ground + 0.05;
    inherit(s, o, 0.5, 1.6);
    k.p.emit(s);
  }
  for (let i = 0; i < k.n(4, o); i++) {
    const s = k.at({ x: pos.x, y: pos.y + 0.2, z: pos.z }, 0.2);
    k.p.colors(s, '#ff9ec4', '#ff4f8a');
    s.frame = FRAME.drop; s.mode = 1; s.k = 0.03;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.8), k.range(2.5, 5) * sc);
    s.life = k.range(0.35, 0.6); s.size0 = 0.1 * sc; s.size1 = 0.07;
    s.drag = 1; s.gravity = 13; s.ground = ground + 0.03;
    inherit(s, o, 0.5, 2);
    k.p.emit(s);
  }
};

/** The rubber duck: yellow notes and a tiny duck popping up out of nowhere. */
export const quack: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  for (let i = 0; i < k.n(8, o); i++) {
    const s = k.at(pos, 0.2);
    k.p.colors(s, '#ffe600', '#ffb000');
    s.frame = FRAME.note; s.mode = 3; s.k = 0.12;
    s.vx = k.range(-0.8, 0.8); s.vy = k.range(1.8, 2.8) + i * 0.2; s.vz = k.range(-0.8, 0.8);
    s.life = k.range(0.7, 1.0); s.size0 = 0.2 * sc; s.size1 = 0.2 * sc;
    s.rot = k.range(-0.4, 0.4);
    inherit(s, o, 0.9);
    k.p.emit(s);
  }
  for (let i = 0; i < k.n(4, o); i++) {
    const s = k.at(pos, 0.15);
    k.p.colors(s, '#ffe600', '#ffb000');
    s.frame = FRAME.duck; s.mode = 3; s.k = 0.14;
    s.vx = k.range(-0.5, 0.5); s.vy = k.range(2.2, 3.2) + i * 0.3; s.vz = k.range(-0.5, 0.5);
    s.life = k.range(0.9, 1.2); s.size0 = 0.3 * sc; s.size1 = 0.3 * sc;
    s.rot = k.range(-0.3, 0.3); s.spin = k.range(-3, 3);
    inherit(s, o, 0.9);
    k.p.emit(s);
  }
  flash(k, pos, o, 0.4 * sc, '#fff3b0', 0.18);
};
