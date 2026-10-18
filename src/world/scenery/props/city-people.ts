// Tiny animal pedestrians for the city crowds (cat, shiba, pigeon, penguin, capybara, goose,
// pelican, bunny): chunky toy body + head, species features (ears, beaks, bellies), dot eyes, legs,
// and often a bright umbrella against the drizzle. Written into a sway 'bob' buffer (uv = phase,
// amplitude) so groups breathe and bounce in place. Local −Z = the way the pedestrian faces.
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';
import { C } from './city-kit';

type Species = 'cat' | 'shiba' | 'pigeon' | 'penguin' | 'capybara' | 'goose' | 'pelican' | 'bunny';
const SPECIES: Species[] = ['cat', 'cat', 'shiba', 'pigeon', 'pigeon', 'penguin', 'capybara', 'goose', 'pelican', 'bunny'];
const FUR: Record<Species, Color[]> = {
  cat: [C('#ff9f45'), C('#2c2c33'), C('#f4f1ea'), C('#9aa7b4')], shiba: [C('#e8a050')], pigeon: [C('#8f9bb0')],
  penguin: [C('#23232b')], capybara: [C('#a0673f')], goose: [C('#f6f3ec')], pelican: [C('#f6f3ec')], bunny: [C('#f4f1ea'), C('#d9b8a0')],
};
const COATS = [C('#e5191c'), C('#ffe600'), C('#2f7fc1'), C('#16171c'), C('#ff5fa2'), C('#2a9d8f'), C('#f4f1ea'), C('#7b4bd1'), C('#ff8a1f')];
const UMBRELLAS = [C('#e5191c'), C('#ffe600'), C('#22d3ee'), C('#ff3d8b'), C('#f4f1ea'), C('#16171c'), C('#7cff5a'), C('#b46bff')];
const INK = C('#0b0b0f'), WHITE = C('#ffffff'), ORANGE = C('#ff9f1c'), PINK = C('#ffb3c7'), CREAM = C('#fff1d6'), YUZU = C('#ffc21f');
const LEGS = C('#26252e'), STICK = C('#3a3a44'), NECK = C('#2bbf8a');
const m = new Matrix4(), m2 = new Matrix4();

function part(buf: MeshBuf, base: Matrix4, local: Matrix4, fn: (b: MeshBuf, mm: Matrix4) => void): void {
  fn(buf, m2.multiplyMatrices(base, local));
}

/** Species head features (ears, beaks, muzzles) around a head centred at local (0, hy, 0), radius r. */
function features(buf: MeshBuf, base: Matrix4, sp: Species, hy: number, r: number, fur: Color, rng: Rng): void {
  const ear = (sx: number, h: number, w: number, col: Color): void =>
    part(buf, base, trs(sx * r * 0.55, hy + r * 0.75, 0, 0, w, h, w, m), (b, mm) => cone(b, mm, col, 5));
  const beak = (len: number, w: number, col: Color, dy = 0): void =>
    part(buf, base, trs(0, hy + dy, -r * 0.95, 0, w, w * 0.8, len, m).multiply(new Matrix4().makeRotationX(-Math.PI / 2)), (b, mm) => cone(b, mm, col, 5));
  switch (sp) {
    case 'cat': ear(-1, r * 0.6, r * 0.32, fur); ear(1, r * 0.6, r * 0.32, fur); break;
    case 'shiba':
      ear(-1, r * 0.55, r * 0.3, fur); ear(1, r * 0.55, r * 0.3, fur);
      part(buf, base, trs(0, hy - r * 0.3, -r * 0.7, 0, r * 0.5, r * 0.38, r * 0.45, m), (b, mm) => sphere(b, mm, CREAM, 6, 4));
      break;
    case 'bunny':
      for (const sx of [-1, 1]) part(buf, base, trs(sx * r * 0.35, hy + r * 1.3, 0, 0, r * 0.22, r * 0.75, r * 0.14, m), (b, mm) => sphere(b, mm, sx < 0 ? fur : PINK, 5, 4));
      break;
    case 'capybara':
      ear(-1, r * 0.25, r * 0.22, fur); ear(1, r * 0.25, r * 0.22, fur);
      if (rng.chance(0.5)) part(buf, base, trs(0, hy + r * 1.05, 0, 0, r * 0.32, r * 0.3, r * 0.32, m), (b, mm) => sphere(b, mm, YUZU, 6, 4));
      break;
    case 'pigeon': beak(r * 0.45, r * 0.18, INK); break;
    case 'penguin':
      beak(r * 0.45, r * 0.22, ORANGE);
      part(buf, base, trs(0, hy - r * 0.1, -r * 0.45, 0, r * 0.62, r * 0.6, r * 0.6, m), (b, mm) => sphere(b, mm, WHITE, 6, 4));
      break;
    case 'goose': beak(r * 0.7, r * 0.26, ORANGE); break;
    case 'pelican': beak(r * 1.7, r * 0.34, ORANGE, -r * 0.15); break;
  }
}

/** One pedestrian at (x, y, z) facing yaw; `umbrella` = chance of an open umbrella. */
export function pedestrian(crowd: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng, umbrella = 0.5): void {
  const sp = rng.pick(SPECIES);
  const fur = rng.pick(FUR[sp]);
  const k = rng.range(0.85, 1.1);
  const base = trs(x, y, z, yaw, k, k, k, new Matrix4());
  crowd.stamp(rng.range(0, Math.PI * 2), rng.range(0.25, 0.7));
  const coat = sp === 'penguin' ? fur : rng.pick(COATS);
  for (const sx of [-0.1, 0.1]) part(crowd, base, trs(sx, 0.16, 0, 0, 0.09, 0.32, 0.1, m), (b, mm) => box(b, mm, LEGS));
  part(crowd, base, trs(0, 0.55, 0, 0, 0.3, 0.36, 0.26, m), (b, mm) => sphere(b, mm, coat, 7, 5));
  const tall = sp === 'goose' ? 0.28 : 0;
  if (tall) part(crowd, base, trs(0, 0.9, -0.03, 0, 0.08, 0.32, 0.08, m), (b, mm) => cylinder(b, mm, fur, 6));
  const hy = 1.08 + tall, r = sp === 'capybara' ? 0.27 : 0.24;
  if (sp === 'pigeon') part(crowd, base, trs(0, hy - r * 0.85, 0, 0, r * 0.75, r * 0.3, r * 0.72, m), (b, mm) => sphere(b, mm, NECK, 6, 3));
  part(crowd, base, trs(0, hy, 0, 0, r, r * (sp === 'capybara' ? 0.85 : 1), r * (sp === 'capybara' ? 1.15 : 1), m), (b, mm) => sphere(b, mm, fur, 7, 5));
  features(crowd, base, sp, hy, r, fur, rng);
  for (const sx of [-1, 1]) part(crowd, base, trs(sx * r * 0.38, hy + r * 0.12, -r * 0.9, 0, 0.05, 0.07, 0.03, m), (b, mm) => box(b, mm, INK));
  if (rng.chance(umbrella)) {
    const side = rng.chance(0.5) ? 1 : -1;
    part(crowd, base, trs(side * 0.17, 1.15 + tall, -0.05, 0, 0.03, 1.1, 0.03, m), (b, mm) => box(b, mm, STICK));
    const col = rng.pick(UMBRELLAS);
    part(crowd, base, trs(side * 0.1, 1.62 + tall, -0.04, rng.range(0, 1), 0.62, 0.28, 0.62, m), (b, mm) => cylinder(b, mm, col, 8, 1, 0.08, true, col));
  }
  crowd.stamp(0, 0);
}
