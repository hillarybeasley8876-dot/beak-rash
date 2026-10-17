// Race-event dressing: start/finish gantries, grandstands with a bobbing animal crowd, flag poles
// and pennant strings. Crowd/flags go into sway buffers (uv = phase, amplitude weight).
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const RED = C('#e5191c'), WHITE = C('#f6f3ec'), BLACK = C('#16171c'), STEEL = C('#9aa3ad'), YEL = C('#ffe600');
const SEAT = [C('#e5191c'), C('#f6f3ec')];
const FUR = [C('#ffffff'), C('#f2c46d'), C('#8a5a3c'), C('#9aa7b4'), C('#ff9f45'), C('#2c2c33'), C('#e9d8c4'), C('#6d6f78')];
const SHIRT = [C('#e5191c'), C('#ffe600'), C('#2f7fc1'), C('#ffffff'), C('#16171c'), C('#ff5fa2'), C('#2a9d8f')];
const BEAK = C('#ff9f1c');
const m = new Matrix4(), q = new Quaternion(), UP = new Vector3(0, 1, 0);

/** Truss gantry over the road. Returns world centres of its two header faces (front, back). */
export function gantry(buf: MeshBuf, left: Vector3, right: Vector3, height: number): { front: Vector3; back: Vector3; yaw: number; span: number } {
  const mid = left.clone().add(right).multiplyScalar(0.5);
  const span = left.distanceTo(right);
  const yaw = Math.atan2(right.x - left.x, right.z - left.z) - Math.PI / 2;
  const ground = Math.min(left.y, right.y);
  for (const foot of [left, right]) {
    box(buf, trs(foot.x, foot.y + 0.3, foot.z, yaw, 1.4, 0.6, 1.4, m), C('#c9c5bb'));
    for (const [ox, oz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]] as Array<[number, number]>) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      cylinder(buf, trs(foot.x + ox * c + oz * s, foot.y, foot.z - ox * s + oz * c, 0, 0.09, ground + height - foot.y + 0.4, 0.09, m), STEEL, 6, 1, 1, false);
    }
    for (let k = 1; k < 6; k++) box(buf, trs(foot.x, foot.y + (k * (height + ground - foot.y)) / 6, foot.z, yaw, 0.8, 0.07, 0.8, m), STEEL);
  }
  const topY = ground + height;
  box(buf, trs(mid.x, topY + 1.3, mid.z, yaw, span + 1.2, 2.6, 1.0, m), BLACK);
  for (const yy of [topY - 0.05, topY + 2.65]) box(buf, trs(mid.x, yy, mid.z, yaw, span + 1.6, 0.16, 1.2, m), RED);
  // Little lights along the bottom edge.
  const dir = new Vector3(right.x - left.x, 0, right.z - left.z).normalize();
  for (let i = 0; i <= 10; i++) {
    const t = i / 10 - 0.5;
    sphere(buf, trs(mid.x + dir.x * t * span, topY - 0.22, mid.z + dir.z * t * span, 0, 0.12, 0.12, 0.12, m), i % 2 ? YEL : WHITE, 5, 3);
  }
  const nx = -Math.sin(yaw), nz = -Math.cos(yaw);
  return {
    front: new Vector3(mid.x + nx * 0.52, topY + 1.3, mid.z + nz * 0.52),
    back: new Vector3(mid.x - nx * 0.52, topY + 1.3, mid.z - nz * 0.52),
    yaw, span,
  };
}

/** Grandstand rows rising away from the road (base at ground y, facing yaw). */
export function stand(buf: MeshBuf, crowd: MeshBuf, x: number, y: number, z: number, yaw: number, len: number, rng: Rng): void {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const part = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color): void =>
    box(buf, new Matrix4().multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, m)), col);
  const rows = 3;
  part(0, -0.6, 2.2, len, 1.6, 5.4, C('#c9c5bb'));
  for (let r = 0; r < rows; r++) {
    const ry = 0.25 + r * 0.55, rz = 0.6 + r * 1.1;
    part(0, ry, rz, len, 0.5, 1.1, SEAT[r % 2] as Color);
    const n = Math.floor(len / 0.9);
    for (let i = 0; i < n; i++) {
      if (rng.chance(0.3)) continue;
      const lx = -len / 2 + 0.45 + i * 0.9 + rng.range(-0.1, 0.1);
      const p = new Vector3(lx, ry + 0.25, rz + 0.1).applyMatrix4(base);
      fan(crowd, p.x, p.y, p.z, yaw, rng);
    }
  }
  // Back wall with railing.
  part(0, 2.6, 5.1, len, 2.0, 0.2, C('#c9c5bb'));
  part(0, 3.7, 5.1, len, 0.12, 0.25, RED);
}

/** One cheering spectator: chunky body + head (some are pelicans with a beak). */
export function fan(crowd: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng): void {
  crowd.stamp(rng.range(0, Math.PI * 2), rng.range(0.6, 1.2));
  const fur = rng.pick(FUR), shirt = rng.pick(SHIRT);
  const s = rng.range(0.85, 1.1);
  sphere(crowd, trs(x, y + 0.42 * s, z, yaw, 0.27 * s, 0.38 * s, 0.24 * s, m), shirt, 6, 4);
  sphere(crowd, trs(x, y + 0.95 * s, z, yaw, 0.24 * s, 0.24 * s, 0.24 * s, m), fur, 6, 4);
  if (fur === FUR[0] && rng.chance(0.7)) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    q.setFromUnitVectors(UP, new Vector3(fx, -0.25, fz).normalize());
    cone(crowd, m.compose(new Vector3(x + fx * 0.18 * s, y + 0.9 * s, z + fz * 0.18 * s), q, new Vector3(0.08 * s, 0.38 * s, 0.08 * s)), BEAK, 6);
  }
  if (rng.chance(0.3)) {
    // Raised arm with a little flag.
    const ax = Math.cos(yaw) * 0.22 * (rng.chance(0.5) ? 1 : -1), az = -Math.sin(yaw) * 0.22;
    box(crowd, trs(x + ax, y + 1.05 * s, z + az, yaw, 0.08, 0.5 * s, 0.08, m), fur);
    box(crowd, trs(x + ax, y + 1.4 * s, z + az, yaw, 0.32, 0.2, 0.02, m), rng.chance(0.5) ? RED : YEL);
  }
  crowd.stamp(0, 0);
}

/** Flag pole with a waving flag (flag cloth into `cloth` buffer, uv.y = distance from the pole). */
export function flagPole(buf: MeshBuf, cloth: MeshBuf, x: number, y: number, z: number, h: number, yaw: number, col: Color, rng: Rng): void {
  cylinder(buf, trs(x, y - 0.3, z, 0, 0.06, h + 0.3, 0.06, m), STEEL, 6, 1, 1, false);
  sphere(buf, trs(x, y + h + 0.05, z, 0, 0.1, 0.1, 0.1, m), YEL, 5, 3);
  const phase = rng.range(0, Math.PI * 2);
  const dx = Math.cos(yaw), dz = -Math.sin(yaw);
  const W = 1.6, H = 1.0, K = 6;
  const nrm = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const ids: number[] = [];
  for (let i = 0; i <= K; i++) {
    const t = i / K;
    for (const yy of [h - H, h]) {
      const pt = new Vector3(x + dx * W * t, y + yy - 0.05, z + dz * W * t);
      ids.push(cloth.vert(pt, nrm, i === K ? WHITE : col, phase, t));
    }
  }
  for (let i = 0; i < K; i++) cloth.quad(ids[i * 2] ?? 0, ids[i * 2 + 2] ?? 0, ids[i * 2 + 3] ?? 0, ids[i * 2 + 1] ?? 0);
}

/** Pennant string between two points (triangles hang below the line). */
export function pennants(cloth: MeshBuf, a: Vector3, b: Vector3, sag: number, rng: Rng): void {
  const n = Math.max(3, Math.round(a.distanceTo(b) / 0.8));
  const cols = [RED, WHITE, YEL, BLACK];
  const nrm = new Vector3(b.z - a.z, 0, a.x - b.x).normalize();
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 0.7) / n, tm = (i + 0.35) / n;
    const at = (t: number, dy: number): Vector3 => new Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t) + dy);
    const phase = rng.range(0, 6);
    const col = cols[i % cols.length] as Color;
    const i0 = cloth.vert(at(t0, 0), nrm, col, phase, 0), i1 = cloth.vert(at(t1, 0), nrm, col, phase, 0);
    const i2 = cloth.vert(at(tm, -0.45), nrm, col, phase, 0.6);
    cloth.tri(i0, i2, i1);
  }
}
