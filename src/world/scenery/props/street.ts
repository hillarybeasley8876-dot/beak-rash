// Small street / beach props: beach umbrellas, towels, loungers, lamp posts, benches, flower pots.
import { Color, Matrix4 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const STRIPES: Array<[Color, Color]> = [
  [C('#e5191c'), C('#f6f3ec')], [C('#2f7fc1'), C('#f6f3ec')], [C('#ffcf1f'), C('#f6f3ec')], [C('#2a9d8f'), C('#ffe9c7')],
  [C('#ff5fa2'), C('#f6f3ec')],
];
const TOWELS = [C('#e5191c'), C('#2f7fc1'), C('#ffcf1f'), C('#2a9d8f'), C('#ff8a3d'), C('#9b5de5')];
const POLE = C('#f3efe6'), DARK = C('#23252b'), WOOD = C('#a8744a'), LAMP = C('#fff1b8'), GREEN = C('#4f9a3a');

const m = new Matrix4(), m2 = new Matrix4();

/** Beach umbrella: pole + striped 8-panel canopy. */
export function umbrella(buf: MeshBuf, x: number, y: number, z: number, rng: Rng): void {
  const [a, b] = rng.pick(STRIPES);
  const tilt = rng.range(-0.18, 0.18);
  const H = rng.range(2.2, 2.6), R = rng.range(1.2, 1.5);
  cylinder(buf, trs(x, y - 0.3, z, 0, 0.035, H + 0.3, 0.035, m), POLE, 5, 1, 1, false);
  const top = y + H;
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    // One panel = a thin cone slice; build as a small cone rotated per panel for colour.
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const col = i % 2 ? a : b;
    const p0 = { x: x + Math.cos(a0) * R, y: top - 0.45 + Math.sin(a0) * tilt * R, z: z + Math.sin(a0) * R };
    const p1 = { x: x + Math.cos(a1) * R, y: top - 0.45 + Math.sin(a1) * tilt * R, z: z + Math.sin(a1) * R };
    const apex = { x, y: top, z };
    const nx = (Math.cos(a0) + Math.cos(a1)) * 0.25, nz = (Math.sin(a0) + Math.sin(a1)) * 0.25;
    const n = { x: nx, y: 0.9, z: nz };
    const i0 = buf.vert(apex, n, col), i1 = buf.vert(p1, n, col), i2 = buf.vert(p0, n, col);
    buf.tri(i0, i1, i2);
    // Underside 4 cm lower (not coincident) so the outline hull wraps the canopy.
    const d = { x: -nx, y: -0.9, z: -nz };
    const low = (v: { x: number; y: number; z: number }): { x: number; y: number; z: number } => ({ x: v.x, y: v.y - 0.04, z: v.z });
    const j0 = buf.vert(low(apex), d, col), j1 = buf.vert(low(p0), d, col), j2 = buf.vert(low(p1), d, col);
    buf.tri(j0, j1, j2);
  }
  sphere(buf, trs(x, top + 0.05, z, 0, 0.08, 0.08, 0.08, m), a, 5, 3);
}

/** Striped beach towel lying flat (ry = yaw). */
export function towel(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng): void {
  const c1 = rng.pick(TOWELS), c2 = rng.pick(TOWELS);
  const base = trs(x, y + 0.02, z, ry, 1, 1, 1, m2);
  for (let i = 0; i < 4; i++) {
    box(buf, new Matrix4().multiplyMatrices(base, trs(0, 0, -0.75 + i * 0.5, 0, 0.95, 0.03, 0.5, m)), i % 2 ? c1 : c2);
  }
}

/** Wooden sun lounger. */
export function lounger(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng): void {
  const base = trs(x, y, z, ry, 1, 1, 1, m2);
  const cloth = rng.pick(TOWELS);
  const part = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color, rx = 0): void => {
    const local = trs(cx, cy, cz, 0, 1, 1, 1, new Matrix4()).multiply(new Matrix4().makeRotationX(rx)).multiply(new Matrix4().makeScale(sx, sy, sz));
    box(buf, new Matrix4().multiplyMatrices(base, local), col);
  };
  part(0, 0.3, 0.2, 0.7, 0.08, 1.3, WOOD);
  part(0, 0.36, 0.2, 0.62, 0.05, 1.2, cloth);
  part(0, 0.62, -0.62, 0.62, 0.05, 0.7, cloth, -0.9);
  for (const [lx, lz] of [[-0.3, 0.75], [0.3, 0.75], [-0.3, -0.3], [0.3, -0.3]] as Array<[number, number]>) part(lx, 0.15, lz, 0.06, 0.3, 0.06, WOOD);
}

/** Promenade lamp: dark pole with a curved arm; the globe goes to the glow buffer. */
export function lampPost(buf: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, ry: number): void {
  cylinder(buf, trs(x, y - 0.2, z, 0, 0.09, 4.4, 0.09, m), DARK, 6, 1, 0.7, false);
  cylinder(buf, trs(x, y - 0.2, z, 0, 0.18, 0.6, 0.18, m), DARK, 6, 1, 0.8);
  const ax = x + Math.sin(ry) * 0.6, az = z + Math.cos(ry) * 0.6;
  box(buf, trs((x + ax) / 2, y + 4.25, (z + az) / 2, ry, 0.08, 0.08, 0.7, m), DARK);
  cone(buf, trs(ax, y + 3.95, az, 0, 0.32, 0.3, 0.32, m), DARK, 8);
  sphere(glow, trs(ax, y + 3.85, az, 0, 0.2, 0.2, 0.2, m), LAMP, 6, 4);
}

export function bench(buf: MeshBuf, x: number, y: number, z: number, ry: number): void {
  const base = trs(x, y, z, ry, 1, 1, 1, m2);
  const part = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color): void =>
    box(buf, new Matrix4().multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, m)), col);
  part(0, 0.45, 0, 1.8, 0.07, 0.45, WOOD);
  part(0, 0.75, 0.2, 1.8, 0.35, 0.06, WOOD);
  for (const lx of [-0.75, 0.75]) part(lx, 0.22, 0, 0.08, 0.45, 0.4, DARK);
}

export function flowerPot(buf: MeshBuf, x: number, y: number, z: number, rng: Rng): void {
  cylinder(buf, trs(x, y - 0.1, z, 0, 0.35, 0.55, 0.35, m), C('#c96a3f'), 8, 1, 1.15);
  sphere(buf, trs(x, y + 0.65, z, 0, 0.42, 0.32, 0.42, m), GREEN, 7, 4);
  for (let i = 0; i < 3; i++) {
    sphere(buf, trs(x + rng.range(-0.25, 0.25), y + 0.85, z + rng.range(-0.25, 0.25), 0, 0.1, 0.1, 0.1, m), rng.pick(TOWELS), 5, 3);
  }
}
