// Weapon models, part 1: salted fish, baguette, frying pan, leek. Built in "grip space": the hand
// holds the origin, the weapon extends along +Y, its flat/striking faces look along ±Z.
import {
  CapsuleGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, Shape, SphereGeometry, TorusGeometry, Vector3,
  type BufferGeometry,
} from 'three';
import type { CharacterBuilder } from '../kit/builder';
import { extrudeSmooth } from '../kit/shapes';

/** Add `geo` at pos/rot/scale with a flat colour (or colour fn) to bone 0; disposes the geometry. */
export function put(
  b: CharacterBuilder, geo: BufferGeometry, pos: readonly [number, number, number], rot: readonly [number, number, number],
  scale: readonly [number, number, number] | number, color: number | ((x: number, y: number, z: number) => number), outline = 1,
): void {
  const s = typeof scale === 'number' ? new Vector3(scale, scale, scale) : new Vector3(scale[0], scale[1], scale[2]);
  const m = new Matrix4().compose(new Vector3(pos[0], pos[1], pos[2]), new Quaternion().setFromEuler(new Euler(rot[0], rot[1], rot[2])), s);
  b.part({ geometry: geo, matrix: m, color: typeof color === 'number' ? color : (x, y, z) => color(x, y, z), bone: 0, outline });
  geo.dispose();
}

export function saltfish(b: CharacterBuilder): void {
  const s = new Shape();
  s.moveTo(-0.055, -0.01);
  s.quadraticCurveTo(-0.01, 0.03, 0, 0.055);
  s.quadraticCurveTo(0.01, 0.03, 0.055, -0.01);
  s.quadraticCurveTo(0.03, 0.05, 0.013, 0.085);
  s.quadraticCurveTo(0.065, 0.17, 0.058, 0.26);
  s.quadraticCurveTo(0.05, 0.37, 0.012, 0.425);
  s.lineTo(-0.012, 0.425);
  s.quadraticCurveTo(-0.05, 0.37, -0.058, 0.26);
  s.quadraticCurveTo(-0.065, 0.17, -0.013, 0.085);
  s.quadraticCurveTo(-0.03, 0.05, -0.055, -0.01);
  const body = extrudeSmooth(s, { depth: 0.034, bevel: 0.5, curveSegments: 5 });
  put(b, body, [0, 0, 0], [0, 0, 0], 1, (x, y) => (y < 0.09 ? 0x8f7b62 : x > 0.028 ? 0x7a6650 : x < -0.03 ? 0xd8c8a8 : 0xbfa98a));
  const eye = new SphereGeometry(1, 10, 8);
  for (const z of [-1, 1]) {
    put(b, eye.clone(), [0.016, 0.37, z * 0.026], [0, 0, 0], [0.013, 0.013, 0.006], 0xffffff, 0.4);
    put(b, eye.clone(), [0.016, 0.372, z * 0.031], [0, 0, 0], [0.006, 0.006, 0.003], 0x111111, 0);
  }
  eye.dispose();
  // A little string loop at the tail: it's a dried fish from the market.
  put(b, new TorusGeometry(0.022, 0.004, 4, 12), [0, -0.025, 0], [0, Math.PI / 2, 0], 1, 0xe8dcc0, 0.5);
}

export function baguette(b: CharacterBuilder): void {
  const geo = new CapsuleGeometry(0.042, 0.6, 6, 12);
  put(b, geo, [0, 0.33, 0], [0, 0, 0.04], [1.15, 1, 1], (x, y, z) => {
    const band = (((y * 6.5 + z * 4) % 1) + 1) % 1;
    return x > 0.018 && band < 0.2 && y > 0.12 && y < 0.6 ? 0xf6dc9a : y < 0.06 || y > 0.62 ? 0xb8742c : 0xd9963a;
  });
}

export function pan(b: CharacterBuilder): void {
  put(b, new CapsuleGeometry(0.017, 0.19, 4, 8), [0, 0.12, 0], [0, 0, 0], 1, (_x, y) => (y < 0.07 ? 0xc0392b : 0x26262b));
  const body = new CylinderGeometry(0.13, 0.112, 0.04, 22, 1);
  put(b, body, [0, 0.345, 0], [Math.PI / 2, 0, 0], 1, (_x, _y, z) => (z > 0.015 ? 0x8d929c : 0x34343a));
  put(b, new TorusGeometry(0.128, 0.008, 5, 26), [0, 0.345, 0.019], [0, 0, 0], 1, 0xc9cdd4, 0.6);
  put(b, new SphereGeometry(1, 8, 6), [0, 0.22, 0], [0, 0, 0], [0.024, 0.02, 0.02], 0x26262b, 0.6);
}

export function leek(b: CharacterBuilder): void {
  put(b, new CylinderGeometry(0.024, 0.027, 0.34, 10, 3), [0, 0.17, 0], [0, 0, 0], 1, (_x, y) => (y > 0.3 ? 0xc8e6a0 : y > 0.26 ? 0xe6f2cf : 0xf6f6ee));
  const root = new CapsuleGeometry(0.004, 0.03, 2, 4);
  for (let i = 0; i < 5; i++) put(b, root.clone(), [Math.cos(i * 1.3) * 0.012, -0.012, Math.sin(i * 1.3) * 0.012], [Math.sin(i) * 0.6, 0, Math.cos(i) * 0.6], 1, 0xd9cfa6, 0.3);
  root.dispose();
  const leaf = new CapsuleGeometry(0.02, 0.32, 4, 8);
  const tilts = [-0.22, 0.05, 0.28];
  tilts.forEach((t, i) => {
    const y = 0.34 + 0.16 * Math.cos(t);
    put(b, leaf.clone(), [Math.sin(-t) * 0.16, y, (i - 1) * 0.012], [0, 0, t], [1.5, 1, 0.55], i === 1 ? 0x3f9c3a : 0x58b848);
  });
  leaf.dispose();
}
