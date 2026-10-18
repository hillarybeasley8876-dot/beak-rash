// FINISH arch (the race's climax): chunky black/red striped pillars with yellow star-burst plates,
// inflatable pelican heads and balloons, a deep header with a chequered band, a walkway of
// flag-waving fans on top, and pennant strings spilling down to the ground on both sides.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, sphere, trs } from '../../kit/shapes';
import { fan, pennants } from './event';

const C = (h: string): Color => new Color(h);
const RED = C('#e5191c'), BLACK = C('#16171c'), WHITE = C('#f6f3ec'), YEL = C('#ffe600'), BEAK = C('#ff9f1c'), POUCH = C('#ff8f6b');
const BALLOONS = [RED, YEL, WHITE];
const m = new Matrix4(), q = new Quaternion();
const v = new Vector3(), scl = new Vector3(), UP = new Vector3(0, 1, 0);

export interface Arch { front: Vector3; back: Vector3; yaw: number; span: number; headerH: number }

/** Flat 10-point star (both faces) centred at c, facing along the local z of `yaw`. */
function starPlate(buf: MeshBuf, c: Vector3, yaw: number, r: number, col: Color): void {
  const ax = Math.cos(yaw), az = -Math.sin(yaw);       // local x (across)
  const nx = Math.sin(yaw), nz = Math.cos(yaw);         // local z (plate normal)
  for (const side of [1, -1]) {
    const n = new Vector3(nx * side, 0, nz * side);
    const o = new Vector3(c.x + nx * side * 0.03, c.y, c.z + nz * side * 0.03);
    const centre = buf.vert(o, n, col);
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, rr = i % 2 === 0 ? r : r * 0.45;
      ids.push(buf.vert(v.set(o.x + ax * Math.cos(a) * rr, o.y + Math.sin(a) * rr, o.z + az * Math.cos(a) * rr), n, col));
    }
    for (let i = 0; i < 10; i++) {
      const a = ids[i] ?? 0, b = ids[(i + 1) % 10] ?? 0;
      if (side > 0) buf.tri(centre, a, b); else buf.tri(centre, b, a);
    }
  }
}

/** Inflatable pelican head (red helmet, big beak with a pouch) on top of a pillar, beak toward `face`. */
function pelicanHead(buf: MeshBuf, x: number, y: number, z: number, face: number): void {
  const fx = -Math.sin(face), fz = -Math.cos(face);
  sphere(buf, trs(x, y, z, face, 1.05, 1.0, 1.05, m), WHITE, 10, 7);
  sphere(buf, trs(x, y + 0.45, z, face, 1.08, 0.62, 1.08, m), RED, 10, 5);
  for (const s of [-1, 1]) {
    const ex = x + fx * 0.8 + Math.cos(face) * s * 0.45, ez = z + fz * 0.8 - Math.sin(face) * s * 0.45;
    sphere(buf, trs(ex, y + 0.1, ez, 0, 0.2, 0.22, 0.2, m), WHITE, 6, 4);
    sphere(buf, trs(ex + fx * 0.12, y + 0.1, ez + fz * 0.12, 0, 0.1, 0.12, 0.1, m), BLACK, 5, 3);
  }
  box(buf, trs(x + fx * 1.4, y - 0.4, z + fz * 1.4, face, 0.75, 0.45, 1.5, m), POUCH);
  q.setFromUnitVectors(UP, v.set(fx, -0.25, fz).normalize());
  cone(buf, m.compose(v.set(x + fx * 0.85, y - 0.05, z + fz * 0.85), q, scl.set(0.4, 2.0, 0.3)), BEAK, 8);
}

/** Build the arch between two ground points; `face` = yaw the riders look along (heads face them). */
export function finishArch(
  buf: MeshBuf, crowd: MeshBuf, cloth: MeshBuf, left: Vector3, right: Vector3, height: number, face: number, rng: Rng,
): Arch {
  const mid = left.clone().add(right).multiplyScalar(0.5);
  const span = left.distanceTo(right);
  const yaw = Math.atan2(right.x - left.x, right.z - left.z) - Math.PI / 2;
  const ground = Math.min(left.y, right.y), topY = ground + height, headerH = 3.6;
  const dir = new Vector3(right.x - left.x, 0, right.z - left.z).normalize();
  for (const foot of [left, right]) {
    for (let y = foot.y - 0.3, k = 0; y < topY + headerH; y += 1.1, k++) {
      box(buf, trs(foot.x, y + 0.55, foot.z, yaw, 1.6, 1.1, 1.6, m), k % 2 ? RED : BLACK);
    }
    starPlate(buf, v.set(foot.x, ground + 3.6, foot.z).clone(), yaw, 1.25, YEL);
    pelicanHead(buf, foot.x, topY + headerH + 1.0, foot.z, face);
    for (let i = 0; i < 3; i++) {
      const bx = foot.x + rng.range(-1.4, 1.4), bz = foot.z + rng.range(-1.4, 1.4), by = topY + rng.range(-1.5, 2.5);
      sphere(buf, trs(bx, by, bz, 0, 0.42, 0.5, 0.42, m), rng.pick(BALLOONS), 7, 5);
      box(buf, trs((bx + foot.x) / 2, by - 0.7, (bz + foot.z) / 2, 0, 0.03, 1.2, 0.03, m), WHITE);
    }
  }
  box(buf, trs(mid.x, topY + headerH / 2, mid.z, yaw, span + 3.2, headerH, 1.4, m), BLACK);
  for (const yy of [topY + 0.1, topY + headerH - 0.1]) box(buf, trs(mid.x, yy, mid.z, yaw, span + 3.5, 0.24, 1.55, m), RED);
  // Chequered band under the header.
  const n = Math.round(span / 0.8);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    box(buf, trs(mid.x + dir.x * t * span, topY - 0.3, mid.z + dir.z * t * span, yaw, span / n, 0.5, 1.45, m), i % 2 ? WHITE : BLACK);
  }
  // Walkway with fans on top, facing the riders.
  box(buf, trs(mid.x, topY + headerH + 0.08, mid.z, yaw, span + 1.6, 0.16, 1.3, m), BLACK);
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9 - 0.5;
    fan(crowd, mid.x + dir.x * t * (span - 1), topY + headerH + 0.16, mid.z + dir.z * t * (span - 1), face, rng);
  }
  // Pennants spilling from the header ends to the ground outside the pillars.
  for (const [foot, s] of [[left, -1], [right, 1]] as Array<[Vector3, number]>) {
    const a = new Vector3(foot.x, topY + headerH, foot.z);
    const b = new Vector3(foot.x + dir.x * s * 6, foot.y + 0.4, foot.z + dir.z * s * 6);
    pennants(cloth, a, b, 0.6, rng);
  }
  const nx = -Math.sin(yaw), nz = -Math.cos(yaw), hy = topY + headerH / 2;
  const front = new Vector3(mid.x + nx * 0.72, hy, mid.z + nz * 0.72), back = new Vector3(mid.x - nx * 0.72, hy, mid.z - nz * 0.72);
  return { front, back, yaw, span, headerH };
}
