// r6 effect presets (fx unit, SPEC §24): the four elements and the seven reactions, plus the gag and meme
// skills that need their own look (a banana peel, a pie, a trash can, tears, a fish). All of them read the
// same BurstOpts as the older presets and reuse the particle atlas, so no new shader program is needed.
import { Vector3 } from 'three';
import { FRAME } from '../particles/atlas';
import { groundRing, smoke } from './ground';
import { ring } from './impacts';
import { inherit, launch, type BurstOpts, type Kit, type Preset } from './kit';
import type { Vec3Like } from '../../core/types';

const d = new Vector3();

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

/** An inked spark (reads on a bright road where an additive one would wash out). */
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

/** Fire: orange embers rising out of a hot flash (the flame of a skill, a rocket, a firecracker). */
export const embers: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  flash(k, pos, o, 0.55 * sc, '#ffb04d', 0.16);
  for (let i = 0; i < k.n(12, o); i++) {
    const s = k.at(pos, 0.12 * sc);
    k.p.colors(s, i % 3 === 0 ? '#ffe14d' : '#ff6a1e', '#c22b0a');
    s.frame = i % 2 ? FRAME.spark4 : FRAME.puff; s.mode = 1; s.k = 0.04;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.55), k.range(2, 5.5) * sc);
    s.vy = Math.abs(s.vy) + 1.6;
    s.life = k.range(0.3, 0.55); s.size0 = k.range(0.1, 0.18) * sc; s.size1 = s.size0 * 0.4;
    s.rot = k.range(0, 6.28); s.spin = k.range(-6, 6); s.drag = 2.2; s.gravity = -1.4;
    inherit(s, o, 0.85);
    k.p.emit(s);
  }
  inkSpark(k, pos, o, '#fff3b0', 0.22 * sc);
};

/** Ice: pale blue shards flying off a cold flash, plus a couple of twinkles. */
export const iceShards: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  flash(k, pos, o, 0.5 * sc, '#dff3ff', 0.14);
  for (let i = 0; i < k.n(9, o); i++) {
    const s = k.at(pos, 0.14 * sc);
    k.p.colors(s, '#eaf9ff', '#7fd8ff');
    s.frame = FRAME.shard; s.realtime = true;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.8), k.range(2.5, 5.5) * sc);
    s.life = k.range(0.3, 0.5); s.size0 = k.range(0.12, 0.2) * sc; s.size1 = s.size0 * 0.6;
    s.rot = k.range(0, 6.28); s.spin = k.range(-12, 12); s.drag = 2.4; s.gravity = 8;
    inherit(s, o, 0.9);
    k.p.emit(s);
  }
  for (let i = 0; i < 3; i++) star(k, pos, o, '#ffffff', 0.13 * sc, k.range(2, 3.5) * sc);
};

/** Water: a spray of blue droplets (a water gun, a bubble shield, a rain cloud). */
export const droplets: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.6;
  for (let i = 0; i < k.n(12, o); i++) {
    const s = k.at(pos, 0.14 * sc);
    k.p.colors(s, '#ffffff', '#5fc4ff');
    s.frame = FRAME.drop; s.mode = 1; s.k = 0.03;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.65), k.range(2.5, 6) * sc);
    s.vy = Math.abs(s.vy) + 1.6;
    s.life = k.range(0.35, 0.65); s.size0 = k.range(0.1, 0.16) * sc; s.size1 = s.size0 * 0.7;
    s.gravity = 13; s.drag = 1; s.ground = ground + 0.03;
    inherit(s, o, 0.45, 2);
    k.p.emit(s);
  }
  flash(k, pos, o, 0.4 * sc, '#bfeaff', 0.12);
};

/** Wind: dust and leaves swirling in a spiral (a tornado, a brain fight). */
export const windDust: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const color = o.color ?? '#cfe8c8';
  for (let i = 0; i < k.n(10, o); i++) {
    const s = k.at(pos, 0.4 * sc);
    k.p.colors(s, color, '#8fae86');
    s.frame = FRAME.swirl; s.mode = 4; s.k = 0.2;
    const a = (i / 10) * Math.PI * 2;
    s.vx = Math.cos(a) * k.range(2.5, 5) * sc; s.vz = Math.sin(a) * k.range(2.5, 5) * sc;
    s.vy = k.range(0.4, 2.2);
    s.life = k.range(0.5, 0.9); s.size0 = k.range(0.3, 0.5) * sc; s.size1 = s.size0 * 0.5;
    s.rot = a; s.spin = 9;
    inherit(s, o, 0.7, 1.2);
    k.p.emit(s);
  }
  ring(k, pos, o, 0.3 * sc, 1.6 * sc, 0.3, color);
};

/** Steam: a white puff cloud (vaporize, a hot drink). */
export const steam: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  for (let i = 0; i < k.n(9, o); i++) {
    const s = k.at(pos, 0.16 * sc);
    k.p.colors(s, '#ffffff', '#d9ecf5');
    s.frame = FRAME.puff;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.9), k.range(1.2, 3) * sc);
    s.vy = Math.abs(s.vy) * 0.6 + k.range(1, 2.4);
    s.life = k.range(0.5, 0.9); s.size0 = k.range(0.25, 0.45) * sc; s.size1 = s.size0 * 2.1;
    s.rot = k.range(0, 6.28); s.spin = k.range(-1.5, 1.5); s.drag = 3; s.gravity = -0.8;
    inherit(s, o, 0.6, 1.4);
    k.p.emit(s);
  }
  flash(k, pos, o, 0.45 * sc, '#ffffff', 0.12);
};

/** Melt: hot orange drops falling into cold blue ones (fire on ice). */
export const meltSplash: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  for (let i = 0; i < k.n(12, o); i++) {
    const s = k.at(pos, 0.12 * sc);
    const hot = i % 2 === 0;
    k.p.colors(s, hot ? '#ff9a3c' : '#7fd8ff', hot ? '#c22b0a' : '#2a8cff');
    s.frame = FRAME.drop; s.mode = 1; s.k = 0.03;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.7), k.range(2, 5) * sc);
    s.vy = Math.abs(s.vy) + 1.2;
    s.life = k.range(0.35, 0.6); s.size0 = k.range(0.1, 0.17) * sc; s.size1 = s.size0 * 0.7;
    s.gravity = 13; s.drag = 1;
    inherit(s, o, 0.5, 2);
    k.p.emit(s);
  }
  ring(k, pos, o, 0.3 * sc, 1.7 * sc, 0.28, '#ffb04d');
  flash(k, pos, o, 0.5 * sc, '#ffd9a8', 0.14);
};

/** Freeze: a burst of ice shards inside a frost ring (the victim locks up). */
export const frostBurst: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  iceShards(k, pos, { ...o, count: Math.ceil(k.n(7, o)) });
  ring(k, pos, o, 0.3 * sc, 2.1 * sc, 0.34, '#bfeaff');
  for (let i = 0; i < 4; i++) star(k, pos, o, '#ffffff', 0.16 * sc, k.range(1.6, 3) * sc);
  groundRing(k, pos, { ...o, ground: o.ground ?? pos.y - 0.8 }, 0.4 * sc, 1.9 * sc, 0.34, '#dff3ff', 0.6);
};

/** Superconduct: a blue-white shatter (glass breaking around the slowed rider). */
export const shatter: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  flash(k, pos, o, 0.8 * sc, '#eaf9ff', 0.14);
  for (let i = 0; i < k.n(14, o); i++) {
    const s = k.at(pos, 0.16 * sc);
    k.p.colors(s, '#ffffff', i % 3 === 0 ? '#7fd8ff' : '#bfeaff');
    s.frame = FRAME.shard; s.realtime = true;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 1), k.range(3, 7) * sc);
    s.life = k.range(0.25, 0.45); s.size0 = k.range(0.12, 0.24) * sc; s.size1 = s.size0 * 0.5;
    s.rot = k.range(0, 6.28); s.spin = k.range(-16, 16); s.drag = 2.2; s.gravity = 9;
    inherit(s, o, 0.9);
    k.p.emit(s);
  }
  ring(k, pos, o, 0.25 * sc, 2.4 * sc, 0.26, '#ffffff');
};

/** Overload: a big orange explosion (a thunder mark on a burning rider goes bang). */
export const overload: Preset = (k, pos, o) => {
  const sc = (o.scale ?? 1) * 1.2;
  flash(k, pos, o, 1.1 * sc, '#ffd9a8', 0.16);
  ring(k, pos, o, 0.4 * sc, 3.2 * sc, 0.34, '#ff8a00');
  ring(k, pos, o, 0.2 * sc, 2.1 * sc, 0.22, '#ffffff');
  for (let i = 0; i < k.n(14, o); i++) {
    const s = k.at(pos, 0.18 * sc);
    k.p.colors(s, i % 2 ? '#ffe14d' : '#ff6a1e', '#c22b0a');
    s.frame = i % 3 === 0 ? FRAME.puff : FRAME.spark4; s.mode = 1; s.k = 0.04;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.7), k.range(4, 9) * sc);
    s.vy = Math.abs(s.vy) + 2;
    s.life = k.range(0.35, 0.6); s.size0 = k.range(0.12, 0.22) * sc; s.size1 = s.size0 * 0.4;
    s.rot = k.range(0, 6.28); s.spin = k.range(-8, 8); s.drag = 2.4; s.gravity = 6;
    inherit(s, o, 0.85);
    k.p.emit(s);
  }
  groundRing(k, pos, { ...o, ground: o.ground ?? pos.y - 0.8 }, 0.5 * sc, 2.6 * sc, 0.36, '#ffb04d', 0.7);
};

/** Swirl: a coloured dust spiral (the aura is blown onto the riders around). */
export const swirlBurst: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const color = o.color ?? '#9be7a0';
  for (let i = 0; i < k.n(12, o); i++) {
    const s = k.at(pos, 0.35 * sc);
    k.p.colors(s, color, '#6fbf7a');
    s.frame = FRAME.puff; s.mode = 4; s.k = 0.2;
    const a = (i / 12) * Math.PI * 2;
    s.vx = Math.cos(a) * k.range(3, 6) * sc; s.vz = Math.sin(a) * k.range(3, 6) * sc;
    s.vy = k.range(0.6, 2.4);
    s.life = k.range(0.5, 0.9); s.size0 = k.range(0.28, 0.46) * sc; s.size1 = s.size0 * 1.6;
    s.rot = a; s.spin = 7;
    inherit(s, o, 0.75, 1.2);
    k.p.emit(s);
  }
  ring(k, pos, o, 0.3 * sc, 1.8 * sc, 0.3, color);
};

/** Banana peel bits: yellow-green peel scraps spinning off the road. */
export const bananaBits: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.6;
  for (let i = 0; i < k.n(8, o); i++) {
    const s = k.at(pos, 0.2 * sc);
    k.p.colors(s, '#ffe14d', '#7fbf3a');
    s.frame = FRAME.leaf; s.mode = 3; s.k = k.range(0.12, 0.3);
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.8), k.range(2, 5) * sc);
    s.vy = Math.abs(s.vy) + 2;
    s.life = k.range(0.7, 1.2); s.size0 = k.range(0.16, 0.26) * sc; s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-9, 9); s.drag = 1.8; s.gravity = 12; s.ground = ground + 0.04;
    inherit(s, o, 0.5, 1.6);
    k.p.emit(s);
  }
};

/** Tears: fat blue drops falling out of a cat's eyes. */
export const tears: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  for (let i = 0; i < k.n(10, o); i++) {
    const s = k.at(pos, 0.22 * sc);
    k.p.colors(s, '#bfeaff', '#3aa0ff');
    s.frame = FRAME.drop; s.mode = 1; s.k = 0.03;
    s.vx = k.range(-0.8, 0.8); s.vy = k.range(-1.5, -0.4); s.vz = k.range(-0.8, 0.8);
    s.life = k.range(0.5, 0.9); s.size0 = k.range(0.12, 0.2) * sc; s.size1 = s.size0 * 0.8;
    s.gravity = 9; s.drag = 0.6;
    inherit(s, o, 0.85);
    k.p.emit(s);
  }
  flash(k, pos, o, 0.4 * sc, '#dff3ff', 0.14);
};

/** Fish and food crumbs: what the five-second rule snatches up. */
export const fishBits: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.6;
  for (let i = 0; i < k.n(7, o); i++) {
    const s = k.at(pos, 0.25 * sc);
    k.p.colors(s, i % 2 ? '#cfe6f2' : '#ffd23a', '#7fb6cf');
    s.frame = i % 2 ? FRAME.fish : FRAME.fry; s.mode = 3; s.k = k.range(0.1, 0.2);
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.8), k.range(2, 5) * sc);
    s.vy = Math.abs(s.vy) + 3;
    s.life = k.range(0.8, 1.2); s.size0 = k.range(0.18, 0.26) * sc; s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-9, 9); s.drag = 1.5; s.gravity = 12; s.ground = ground + 0.05;
    inherit(s, o, 0.5, 1.6);
    k.p.emit(s);
  }
};

/** Trash: a scatter of bin bits (the lottery under the bin lid). */
export const trashBits: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.6;
  for (let i = 0; i < k.n(9, o); i++) {
    const s = k.at(pos, 0.2 * sc);
    k.p.colors(s, i % 3 === 0 ? '#9aa0a8' : i % 3 === 1 ? '#6f7a52' : '#c9a06a', '#4a4a52');
    s.frame = i % 2 ? FRAME.keycap : FRAME.stick;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.75), k.range(2.5, 5.5) * sc);
    s.vy = Math.abs(s.vy) + 2.4;
    s.life = k.range(0.7, 1.1); s.size0 = k.range(0.1, 0.2) * sc; s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-12, 12); s.drag = 1.6; s.gravity = 13; s.ground = ground + 0.04;
    inherit(s, o, 0.5, 1.6);
    k.p.emit(s);
  }
  smoke(k, pos, { ...o, count: 2 });
};

/** Pie: cream and filling crumbs, plus a flat pie disc. */
export const pieBits: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  const ground = o.ground ?? pos.y - 0.6;
  for (let i = 0; i < k.n(9, o); i++) {
    const s = k.at(pos, 0.18 * sc);
    k.p.colors(s, i % 2 ? '#f5dfa8' : '#e8a15c', '#b87a3a');
    s.frame = FRAME.puff; s.mode = 3; s.k = 0.14;
    launch(s, k.dir(d, o.dir ?? { x: 0, y: 1, z: 0 }, 0.8), k.range(1.5, 4) * sc);
    s.vy = Math.abs(s.vy) + 1.6;
    s.life = k.range(0.5, 0.9); s.size0 = k.range(0.12, 0.2) * sc; s.size1 = s.size0;
    s.rot = k.range(0, 6.28); s.spin = k.range(-6, 6); s.drag = 2.4; s.gravity = 9; s.ground = ground + 0.04;
    inherit(s, o, 0.5, 1.6);
    k.p.emit(s);
  }
  const disc = k.at(pos);
  k.p.colors(disc, '#f5dfa8', '#b87a3a');
  disc.frame = FRAME.hex; disc.realtime = true; disc.life = 0.3; disc.size0 = 0.5 * sc; disc.size1 = 0.8 * sc;
  disc.rot = k.range(0, 6.28);
  inherit(disc, o, 0.8);
  k.p.emit(disc);
};

/** Bubbles: a soap bubble shell that pops into drops. */
export const bubbles: Preset = (k, pos, o) => {
  const sc = o.scale ?? 1;
  for (let i = 0; i < k.n(6, o); i++) {
    const s = k.at(pos, 0.3 * sc);
    k.p.colors(s, '#ffffff', '#8fd8ff');
    s.frame = FRAME.hex; s.realtime = true; s.life = k.range(0.35, 0.6);
    s.size0 = k.range(0.25, 0.5) * sc; s.size1 = s.size0 * 1.3;
    s.vy = k.range(0.4, 1.4);
    s.rot = k.range(0, 6.28); s.spin = k.range(-2, 2);
    inherit(s, o, 0.9);
    k.p.emit(s);
  }
  droplets(k, pos, { ...o, count: Math.ceil(k.n(6, o)) });
};
