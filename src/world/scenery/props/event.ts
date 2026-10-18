// Race-event dressing: start/finish gantries, grandstands with a bobbing animal crowd, flag poles
// and pennant strings. Crowd/flags go into sway buffers (uv = phase, amplitude weight).
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const RED = C('#e5191c'), WHITE = C('#f6f3ec'), BLACK = C('#16171c'), STEEL = C('#9aa3ad'), YEL = C('#ffe600');
const SEAT = [C('#e5191c'), C('#f6f3ec')];
const SHIRT = [C('#e5191c'), C('#ffe600'), C('#2f7fc1'), C('#ffffff'), C('#16171c'), C('#ff5fa2'), C('#2a9d8f')];
const BEAK = C('#ff9f1c'), POUCH = C('#ff8f6b');
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
      const post = trs(foot.x + ox * c + oz * s, foot.y, foot.z - ox * s + oz * c, 0, 0.09, ground + height - foot.y + 0.4, 0.09, m);
      cylinder(buf, post, STEEL, 6, 1, 1, false);
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
  // P5 awning: red/black striped slats on black posts, sloping down toward the road.
  const slats = Math.max(4, Math.round(len / 1.3));
  for (let i = 0; i < slats; i++) {
    const lx = -len / 2 + (i + 0.5) * (len / slats);
    box(buf, new Matrix4().multiplyMatrices(base, trs(lx, 4.7, 2.4, 0, len / slats, 0.12, 6.0, m).multiply(TILT)), i % 2 ? BLACK : RED);
  }
  for (const lx of [-len / 2 + 0.3, 0, len / 2 - 0.3]) part(lx, 2.2, -0.2, 0.14, 4.6, 0.14, BLACK);
}

const TILT = new Matrix4().makeRotationX(-0.12);

type Species = 'pelican' | 'goose' | 'cat' | 'dog' | 'capy' | 'pigeon';
const SPECIES: Species[] = ['pelican', 'pelican', 'goose', 'cat', 'dog', 'capy', 'pigeon'];
const SPECIES_FUR: Record<Species, Color[]> = {
  pelican: [C('#ffffff')], goose: [C('#ffffff')], cat: [C('#ff9f45'), C('#9aa7b4'), C('#2c2c33')],
  dog: [C('#f2c46d'), C('#e9d8c4'), C('#8a5a3c')], capy: [C('#8a5a3c')], pigeon: [C('#9aa7b4')],
};

/** Species head: silhouette features on top of a round head at (x, hy, z) facing yaw. */
function head(crowd: MeshBuf, sp: Species, fur: Color, x: number, hy: number, z: number, yaw: number, s: number): void {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const beak = (len: number, dy: number, col: Color): void => {
    q.setFromUnitVectors(UP, new Vector3(fx, -0.25, fz).normalize());
    cone(crowd, m.compose(new Vector3(x + fx * 0.18 * s, hy + dy * s, z + fz * 0.18 * s), q, new Vector3(0.08 * s, len * s, 0.07 * s)), col, 6);
  };
  if (sp === 'goose') {
    cylinder(crowd, trs(x, hy - 0.1 * s, z, 0, 0.08 * s, 0.45 * s, 0.08 * s, m), fur, 6, 1, 1, false);
    hy += 0.4 * s;
  }
  if (sp === 'capy') box(crowd, trs(x, hy, z, yaw, 0.4 * s, 0.34 * s, 0.46 * s, m), fur);
  else sphere(crowd, trs(x, hy, z, yaw, 0.24 * s, 0.24 * s, 0.24 * s, m), fur, 6, 4);
  if (sp === 'pelican') {
    beak(0.5, -0.05, BEAK);
    sphere(crowd, trs(x + fx * 0.3 * s, hy - 0.16 * s, z + fz * 0.3 * s, yaw, 0.09 * s, 0.1 * s, 0.2 * s, m), POUCH, 5, 3);
  } else if (sp === 'goose') beak(0.3, -0.02, BEAK);
  else if (sp === 'pigeon') beak(0.16, 0, C('#3a3a40'));
  for (const side of [-1, 1]) {
    const ex = x + rx * side * 0.14 * s, ez = z + rz * side * 0.14 * s;
    if (sp === 'cat') cone(crowd, trs(ex, hy + 0.16 * s, ez, yaw, 0.08 * s, 0.18 * s, 0.06 * s, m), fur, 4);
    else if (sp === 'dog') {
      sphere(crowd, trs(ex + rx * side * 0.08 * s, hy + 0.02 * s, ez + rz * side * 0.08 * s, yaw, 0.07 * s, 0.15 * s, 0.07 * s, m), fur, 5, 3);
    }
    else if (sp === 'capy') sphere(crowd, trs(ex, hy + 0.2 * s, ez, 0, 0.05 * s, 0.05 * s, 0.05 * s, m), fur, 4, 3);
  }
}

/** One cheering spectator: chunky body + a species head (pelican, goose, cat, dog, capybara, pigeon). */
export function fan(crowd: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng): void {
  crowd.stamp(rng.range(0, Math.PI * 2), rng.range(0.6, 1.2));
  const sp = rng.pick(SPECIES), fur = rng.pick(SPECIES_FUR[sp]), shirt = rng.pick(SHIRT);
  const s = rng.range(0.85, 1.1);
  sphere(crowd, trs(x, y + 0.42 * s, z, yaw, 0.27 * s, 0.38 * s, 0.24 * s, m), shirt, 6, 4);
  head(crowd, sp, fur, x, y + 0.95 * s, z, yaw, s);
  if (rng.chance(0.3)) {
    // Raised arm with a little flag.
    const ax = Math.cos(yaw) * 0.22 * (rng.chance(0.5) ? 1 : -1), az = -Math.sin(yaw) * 0.22;
    box(crowd, trs(x + ax, y + 1.05 * s, z + az, yaw, 0.08, 0.5 * s, 0.08, m), fur);
    box(crowd, trs(x + ax, y + 1.4 * s, z + az, yaw, 0.32, 0.2, 0.02, m), rng.chance(0.5) ? RED : YEL);
  }
  crowd.stamp(0, 0);
}

/** Flag cloth styles: plain colour, a P5 star emblem (both faces), or a black / white chequer. */
export type FlagStyle = 'plain' | 'star' | 'chequer';
const FLAG_W = 1.6, FLAG_H = 1.0, FLAG_K = 6;

/**
 * Flag pole with a waving cloth (sway 'wave': uv = phase, t along the cloth). `swallow` cuts a
 * swallowtail into the fly end; 'star' adds a star in `emblem` on both faces.
 */
export function flagPole(buf: MeshBuf, cloth: MeshBuf, x: number, y: number, z: number, h: number, yaw: number, col: Color, rng: Rng,
  style: FlagStyle = 'plain', swallow = false, emblem: Color = WHITE): void {
  cylinder(buf, trs(x, y - 0.3, z, 0, 0.06, h + 0.3, 0.06, m), STEEL, 6, 1, 1, false);
  sphere(buf, trs(x, y + h + 0.05, z, 0, 0.1, 0.1, 0.1, m), YEL, 5, 3);
  const phase = rng.range(0, Math.PI * 2);
  const dx = Math.cos(yaw), dz = -Math.sin(yaw);
  const nrm = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  /** Cloth point at t (0 pole … 1 fly end) and v (0 bottom … 1 top), pushed `off` m along the normal. */
  const at = (t: number, v: number, off = 0): Vector3 =>
    new Vector3(x + dx * FLAG_W * t + nrm.x * off, y + h - FLAG_H + v * FLAG_H - 0.05, z + dz * FLAG_W * t + nrm.z * off);
  const vert = (t: number, v: number, c: Color, off = 0): number => cloth.vert(at(t, v, off), nrm, c, phase, t);
  const rows = style === 'chequer' ? 3 : 1;
  for (let i = 0; i < FLAG_K; i++) {
    const t0 = i / FLAG_K, t1 = (i + 1) / FLAG_K, last = i === FLAG_K - 1;
    for (let r = 0; r < rows; r++) {
      const v0 = r / rows, v1 = (r + 1) / rows;
      const c = style === 'chequer' ? ((i + r) % 2 ? BLACK : WHITE) : col;
      if (last && swallow) {
        // Fly end: two tails round a notch at t 0.86.
        const a = vert(t0, v0, c), b = vert(t1, v0, c), n = vert(0.86, (v0 + v1) / 2, c), e = vert(t1, v1, c), f = vert(t0, v1, c);
        cloth.tri(a, b, n); cloth.tri(a, n, f); cloth.tri(f, n, e);
      } else {
        cloth.quad(vert(t0, v0, c), vert(t1, v0, c), vert(t1, v1, c), vert(t0, v1, c));
      }
    }
  }
  if (style !== 'star') return;
  // Five-point star at t 0.42 on both faces (2 cm off the cloth so it never z-fights).
  for (const off of [0.02, -0.02]) {
    const c0 = vert(0.42, 0.5, emblem, off);
    const pts: number[] = [];
    for (let k = 0; k < 10; k++) {
      const a = Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.14 : 0.34;
      pts.push(vert(0.42 + (Math.cos(a) * r) / FLAG_W, 0.5 + (Math.sin(a) * r) / FLAG_H, emblem, off));
    }
    for (let k = 0; k < 10; k++) cloth.tri(c0, pts[k] ?? c0, pts[(k + 1) % 10] ?? c0);
  }
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
