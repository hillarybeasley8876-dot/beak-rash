// Sunset Pass decorations (env-mountain): paper lanterns (unlit glowing bodies + toon caps), lantern
// strings across the road, lantern posts, prayer-flag strings (waving cloth), wooden fences.
// Cloth vertices carry the sway uv (phase, amplitude weight) used by scenery/sway.ts 'wave'.
import { Color, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
const PAL = {
  lantern: [C('#ff3b24'), C('#ff5626'), C('#ff8a2a')], cap: C('#1c1a1f'), tassel: C('#ffd84a'),
  wood: C('#7a4b33'), woodDark: C('#58372a'), rope: C('#2a211d'), post: C('#5e3a2a'),
};
const FLAGS = [C('#2f6fd6'), C('#f6f3ec'), C('#e5191c'), C('#2fa35a'), C('#ffd23a')];
const m = new Matrix4();
const UP = new Vector3(0, 1, 0);
const rot = new Quaternion(), eul = new Euler(), pos = new Vector3(), scl = new Vector3();

/** Paper lantern hanging with its top at (x, y, z): glowing body, dark caps and a gold tassel. */
export function lantern(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const r = 0.34 * scale, h = 0.4 * scale, cap = 0.11 * scale;
  const cy = y - cap - h * 0.92;
  sphere(glow, trs(x, cy, z, 0, r, h, r, m), rng.pick(PAL.lantern), 7, 5);
  cylinder(props, trs(x, y - cap, z, 0, r * 0.52, cap, r * 0.52, m), PAL.cap, 8);
  cylinder(props, trs(x, cy - h * 0.98, z, 0, r * 0.5, cap, r * 0.5, m), PAL.cap, 8);
  cylinder(props, trs(x, cy - h - 0.34 * scale, z, 0, 0.035 * scale, 0.3 * scale, 0.035 * scale, m), PAL.tassel, 4, 1, 1, false);
}

/** Point on a sagging line a→b at t (parabolic sag, metres at mid-span). */
export function sagAt(a: Vector3, b: Vector3, t: number, sag: number, out = new Vector3()): Vector3 {
  out.lerpVectors(a, b, t);
  out.y -= sag * 4 * t * (1 - t);
  return out;
}

/** Thin rope as a flat ribbon (cloth buffer, anchored: amplitude 0) along a sagging line. */
export function rope(cloth: MeshBuf, a: Vector3, b: Vector3, sag: number, width = 0.05): void {
  const n = Math.max(4, Math.round(a.distanceTo(b) / 2));
  const side = new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const nrm = new Vector3().crossVectors(side, UP).normalize();
  const p = new Vector3();
  const base = cloth.count;
  for (let i = 0; i <= n; i++) {
    sagAt(a, b, i / n, sag, p);
    cloth.vert(p, nrm, PAL.rope, 0, 0);
    cloth.vert(p.setY(p.y - width), nrm, PAL.rope, 0, 0);
  }
  for (let i = 0; i < n; i++) {
    const k = base + i * 2;
    cloth.quad(k, k + 2, k + 3, k + 1);
  }
}

/** Lanterns every `every` m on a sagging rope between a and b. */
export function lanternString(props: MeshBuf, glow: MeshBuf, cloth: MeshBuf, a: Vector3, b: Vector3, sag: number, every: number, rng: Rng): void {
  rope(cloth, a, b, sag);
  const span = a.distanceTo(b);
  const k = Math.max(1, Math.round(span / every));
  const p = new Vector3();
  for (let i = 0; i < k; i++) {
    sagAt(a, b, (i + 0.5) / k, sag, p);
    lantern(props, glow, p.x, p.y - 0.05, p.z, rng, rng.range(0.7, 0.9));
  }
}

/** Wooden lantern post (h m) with an arm toward `yaw` (local −Z) and a lantern hanging from it. */
export function lanternPost(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng, h = 4.2): void {
  box(props, trs(x, y + h / 2 - 0.3, z, yaw, 0.22, h + 0.6, 0.22, m), PAL.post);
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  box(props, trs(x + fx * 0.55, y + h - 0.15, z + fz * 0.55, yaw, 0.14, 0.14, 1.3, m), PAL.post);
  box(props, trs(x, y + h + 0.32, z, yaw, 0.5, 0.12, 0.5, m), PAL.woodDark);
  lantern(props, glow, x + fx * 1.05, y + h - 0.2, z + fz * 1.05, rng);
}

/** Prayer-flag string: square flags in five colours hanging below a sagging rope (waving cloth). */
export function prayerFlags(cloth: MeshBuf, a: Vector3, b: Vector3, sag: number, rng: Rng): void {
  rope(cloth, a, b, sag, 0.035);
  const span = a.distanceTo(b);
  const n = Math.max(3, Math.round(span / 0.75));
  const side = new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const nrm = new Vector3().crossVectors(side, UP).normalize();
  const p = new Vector3(), q = new Vector3();
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.12) / n, t1 = (i + 0.88) / n;
    const col = FLAGS[i % FLAGS.length] as Color;
    const ph = rng.range(0, 6.28);
    sagAt(a, b, t0, sag, p);
    sagAt(a, b, t1, sag, q);
    const i0 = cloth.vert(p, nrm, col, ph, 0), i1 = cloth.vert(q, nrm, col, ph, 0);
    const i2 = cloth.vert(q.setY(q.y - 0.62), nrm, col, ph, 0.55), i3 = cloth.vert(p.setY(p.y - 0.62), nrm, col, ph, 0.55);
    cloth.quad(i0, i3, i2, i1);
  }
}

/** Wooden ranch fence from a to b (ground heights from `gy`): posts every ~2.4 m, two rails. */
export function fence(props: MeshBuf, a: Vector3, b: Vector3, gy: (x: number, z: number) => number): void {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.round(len / 2.4));
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    box(props, trs(x, gy(x, z) + 0.45, z, yaw, 0.14, 1.3, 0.14, m), PAL.woodDark);
  }
  for (let i = 0; i < n; i++) {
    const x0 = a.x + ((b.x - a.x) * i) / n, z0 = a.z + ((b.z - a.z) * i) / n;
    const x1 = a.x + ((b.x - a.x) * (i + 1)) / n, z1 = a.z + ((b.z - a.z) * (i + 1)) / n;
    const y0 = gy(x0, z0), y1 = gy(x1, z1);
    const seg = Math.hypot(x1 - x0, z1 - z0, y1 - y0);
    const pitch = Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0));
    rot.setFromEuler(eul.set(-pitch, yaw, 0, 'YXZ'));
    for (const hy of [0.55, 0.95]) {
      m.compose(pos.set((x0 + x1) / 2, (y0 + y1) / 2 + hy, (z0 + z1) / 2), rot, scl.set(0.08, 0.12, seg + 0.1));
      box(props, m, PAL.wood);
    }
  }
}
