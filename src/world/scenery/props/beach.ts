// Beach props: lifeguard towers, striped beach huts, sandcastles, a volleyball net and sunbathing
// animals (lying on towels). Chunky toon shapes; bases sink slightly into the sand.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const RED = C('#e5191c'), WHITE = C('#f6f3ec'), WOOD = C('#b7834f'), WOOD_D = C('#8a5f38'), SAND = C('#e8cf8f'), NET = C('#2b2d33');
const HUTS = [C('#2f7fc1'), C('#ffcf1f'), C('#2a9d8f'), C('#ff5fa2'), C('#e5191c')];
const FUR = [C('#ffffff'), C('#f2c46d'), C('#8a5a3c'), C('#9aa7b4'), C('#ff9f45'), C('#2c2c33')];
const SUIT = [C('#e5191c'), C('#ffe600'), C('#2f7fc1'), C('#ff5fa2'), C('#2a9d8f')];
const BEAK = C('#ff9f1c');
const m = new Matrix4(), base = new Matrix4(), part = new Matrix4();
const v = new Vector3();

/** Local box (centre cx, cy, cz in the prop's frame) through `base`. */
function lbox(buf: MeshBuf, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color): void {
  box(buf, part.multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, m)), col);
}

/** Red/white lifeguard tower on stilts, cabin facing yaw (local −Z), with a rescue flag. */
export function lifeguardTower(buf: MeshBuf, x: number, y: number, z: number, yaw: number): void {
  base.copy(trs(x, y, z, yaw, 1, 1, 1, m));
  for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]] as Array<[number, number]>) lbox(buf, lx, 1.1, lz, 0.16, 2.6, 0.16,
    WHITE);
  lbox(buf, 0, 2.45, 0, 2.2, 0.16, 2.2, WOOD);
  lbox(buf, 0, 3.15, 0.35, 2.0, 1.3, 1.3, RED);
  lbox(buf, 0, 3.35, -0.31, 2.0, 0.5, 0.06, WHITE);
  lbox(buf, 0, 3.9, 0.1, 2.5, 0.14, 2.3, WHITE);
  for (let i = 0; i < 6; i++) lbox(buf, 0, 0.3 + i * 0.36, -1.35 - i * 0.06, 0.8, 0.06, 0.3, WOOD_D);
  v.set(0.9, 3.9, 0.9).applyMatrix4(base);
  cylinder(buf, trs(v.x, v.y, v.z, 0, 0.04, 1.6, 0.04, m), WHITE, 5, 1, 1, false);
  v.set(0.9, 5.2, 0.6).applyMatrix4(base);
  box(buf, trs(v.x, v.y, v.z, yaw + Math.PI / 2, 0.7, 0.45, 0.03, m), RED);
}

/** Striped wooden beach hut (door toward local −Z). */
export function beachHut(buf: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng): void {
  base.copy(trs(x, y, z, yaw, 1, 1, 1, m));
  const col = rng.pick(HUTS);
  for (let i = 0; i < 5; i++) lbox(buf, -0.8 + i * 0.4, 1.0, 0, 0.4, 2.2, 1.8, i % 2 ? WHITE : col);
  lbox(buf, 0, 0.95, -0.91, 0.75, 1.6, 0.04, WOOD_D);
  // Pitched roof: two slabs.
  for (const s of [-1, 1]) {
    box(buf, part.multiplyMatrices(base, trs(s * 0.55, 2.35, 0, 0, 1, 1, 1,
      m).multiply(new Matrix4().makeRotationZ(-s * 0.55)).multiply(new Matrix4().makeScale(1.3, 0.1, 2.1))), col);
  }
}

/** Sandcastle: keep + four towers with cone roofs and a tiny red flag. */
export function sandcastle(buf: MeshBuf, x: number, y: number, z: number, rng: Rng): void {
  const s = rng.range(0.7, 1.1);
  box(buf, trs(x, y + 0.15 * s, z, rng.range(0, 3), 0.9 * s, 0.4 * s, 0.9 * s, m), SAND);
  for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as Array<[number, number]>) {
    cylinder(buf, trs(x + dx * s, y - 0.05, z + dz * s, 0, 0.16 * s, 0.6 * s, 0.16 * s, m), SAND, 7);
    cone(buf, trs(x + dx * s, y + 0.55 * s, z + dz * s, 0, 0.19 * s, 0.22 * s, 0.19 * s, m), SAND, 7);
  }
  box(buf, trs(x + 0.4 * s, y + 0.9 * s, z + 0.4 * s, 0, 0.16, 0.1, 0.02, m), RED);
}

/** Volleyball net between two posts, centred at (x, y, z), running along yaw. */
export function volleyballNet(buf: MeshBuf, x: number, y: number, z: number, yaw: number): void {
  base.copy(trs(x, y, z, yaw, 1, 1, 1, m));
  for (const lx of [-4.2, 4.2]) lbox(buf, lx, 1.1, 0, 0.12, 2.6, 0.12, WHITE);
  lbox(buf, 0, 2.15, 0, 8.4, 0.08, 0.03, WHITE);
  for (let i = 0; i < 8; i++) lbox(buf, 0, 1.4 + i * 0.1, 0, 8.4, 0.02, 0.02, NET);
  v.set(1.5, 0.2, 2.2).applyMatrix4(base);
  sphere(buf, trs(v.x, v.y, v.z, 0, 0.2, 0.2, 0.2, m), C('#ffe600'), 6, 4);
}

/** Sunbathing animal lying on its back (along yaw), with a swimsuit band and sometimes a beak. */
export function sunbather(buf: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng): void {
  const fur = rng.pick(FUR), suit = rng.pick(SUIT);
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  sphere(buf, trs(x, y + 0.16, z, yaw, 0.3, 0.18, 0.55, m), fur, 7, 4);
  sphere(buf, trs(x + dx * 0.1, y + 0.2, z + dz * 0.1, yaw, 0.32, 0.12, 0.2, m), suit, 6, 3);
  sphere(buf, trs(x - dx * 0.68, y + 0.2, z - dz * 0.68, yaw, 0.22, 0.2, 0.22, m), fur, 6, 4);
  if (fur === FUR[0]) cone(buf, trs(x - dx * 0.95, y + 0.3, z - dz * 0.95, yaw, 0.07, 0.3, 0.07, m), BEAK, 5);
}
