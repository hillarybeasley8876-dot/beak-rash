// The gobi's built places: the desert truck stop (the mid-track landmark), the caravanserai arch at the
// oasis finish, the start gantry and the roadside oasis (palms and a water hole).
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { MeshBuf } from '../../geom';
import { box, cone, cylinder, sphere, trs } from '../../kit/shapes';
import { faceQuad } from '../../scenery/signs/boards';
import { gantry } from '../../scenery/props/event';
import { bannerFace, gantryFace, roadSignFace } from '../../scenery/signs/faces';
import { C } from './kit';
import { palm } from './critters';
import type { GobiCtx } from './gctx';

const m = new Matrix4();
const q = new Quaternion(), v = new Vector3(), sc = new Vector3();
const X = new Vector3(1, 0, 0);

/** A box rotated about the local X axis (the road axis) — the voussoirs of the caravanserai gate. */
export function archStone(buf: MeshBuf, c: Vector3, angle: number, w: number, h: number, d: number, col: Color): void {
  q.setFromAxisAngle(X, angle);
  box(buf, m.compose(c, q, sc.set(w, h, d)), col);
}

/** The desert truck stop: a shop, a canopy over the pumps, a price sign, a water tower and a truck. */
export function truckStop(g: GobiCtx, s: number, side: -1 | 1): void {
  const sp = g.place.spot(s, side, 26);
  if (!g.place.free(sp.pos.x, sp.pos.z, 16, 12)) return;
  const yaw = sp.faceRoad;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const x = sp.pos.x, z = sp.pos.z, y = sp.pos.y;
  const buf = g.props.at(x, z);
  // Shop: a low mud-brick block with a flat roof and a shaded veranda.
  box(buf, trs(x, y + 2.1, z, yaw, 12, 4.2, 7, m), C.mud);
  box(buf, trs(x, y + 4.4, z, yaw, 12.6, 0.5, 7.6, m), C.mudDark);
  box(buf, trs(x + fx * 3.2, y + 2.6, z + fz * 3.2, yaw, 1.2, 1.6, 3, m), C.black);
  // Canopy on four posts over the pumps.
  const cx = x + fx * 9, cz = z + fz * 9;
  for (const [ox, oz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]] as Array<[number, number]>) {
    cylinder(buf, trs(cx + rx * ox + fx * oz, y, cz + rz * ox + fz * oz, 0, 0.22, 5, 0.22, m), C.steel, 8);
  }
  box(buf, trs(cx, y + 5.2, cz, yaw, 10, 0.45, 8, m), C.red);
  box(buf, trs(cx, y + 5.5, cz, yaw, 10.4, 0.3, 8.4, m), C.white);
  // Two pumps.
  for (const side2 of [-1, 1]) {
    const px = cx + rx * side2 * 2.6, pz = cz + rz * side2 * 2.6;
    box(buf, trs(px, y + 0.9, pz, yaw, 0.9, 1.8, 0.7, m), C.white);
    box(buf, trs(px, y + 1.9, pz, yaw, 0.8, 0.5, 0.6, m), C.black);
  }
  // Water tower.
  const wx = x - fx * 7 + rx * 7, wz = z - fz * 7 + rz * 7;
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>) {
    cylinder(buf, trs(wx + rx * ox * 1.1 + fx * oz * 1.1, y, wz + rz * ox * 1.1 + fz * oz * 1.1, 0, 0.13, 8, 0.13, m), C.steelDark, 6);
  }
  cylinder(buf, trs(wx, y + 8, wz, 0, 2.1, 3, 2.1, m), C.steel, 12);
  cone(buf, trs(wx, y + 11, wz, 0, 2.2, 1.2, 2.2, m), C.red, 12);
  // A parked truck (the only traffic on this road).
  const tx = x + fx * 5 + rx * 9, tz = z + fz * 5 + rz * 9;
  box(buf, trs(tx, y + 1.7, tz, yaw + 0.4, 7.5, 2.6, 2.6, m), C.red);
  box(buf, trs(tx + fx * 2.6, y + 2.3, tz + fz * 2.6, yaw + 0.4, 2.4, 2.2, 2.4, m), C.steelDark);
  for (const [ox, oz] of [[-2.2, -1.3], [2.2, -1.3], [-2.2, 1.3], [2.2, 1.3]] as Array<[number, number]>) {
    cylinder(buf, trs(tx + rx * ox + fx * oz, y + 0.6, tz + rz * ox + fz * oz, 0, 0.62, 0.4, 0.62, m), C.black, 10);
  }
  // Tires stacked by the shop.
  for (let i = 0; i < 3; i++) {
    cylinder(buf, trs(x - fx * 2 + rx * 6, y + 0.22 + i * 0.36, z - fz * 2 + rz * 6, 0, 0.55, 0.3, 0.55, m), C.black, 10);
  }
  // The meme price sign, facing the riders.
  const rect = g.face('truckstop', () => roadSignFace(g.atlas, '加油站 · 今日油价：一条鱼'));
  if (rect) {
    const sx = x + fx * 12, sz = z + fz * 12;
    box(g.props.at(sx, sz), trs(sx, y + 5.2, sz, yaw, 7.4, 3.4, 0.3, m), C.steelDark);
    faceQuad(g.faces.at(sx, sz), v.set(sx + fx * 0.2, y + 5.2, sz + fz * 0.2), yaw, 7, 3.1, rect);
    cylinder(g.props.at(sx, sz), trs(sx, y, sz, 0, 0.22, 3.6, 0.22, m), C.steel, 8);
  }
  g.ctx.log(`gobi: truck stop at s=${Math.round(s)}`);
}

/** The FINISH: a caravanserai gate — two mud-brick towers, a voussoir arch and a banner over the road. */
export function caravanserai(g: GobiCtx, s: number): void {
  const l = g.place.spot(s, -1, 3.2), r = g.place.spot(s, 1, 3.2);
  const toRiders = g.place.spot(s, 1, 0).along + Math.PI;
  const mid = l.pos.clone().add(r.pos).multiplyScalar(0.5);
  const span = l.pos.distanceTo(r.pos);
  const yaw = Math.atan2(r.pos.x - l.pos.x, r.pos.z - l.pos.z) - Math.PI / 2;
  const ground = Math.min(l.pos.y, r.pos.y);
  const buf = g.props.at(mid.x, mid.z);
  const dir = new Vector3(r.pos.x - l.pos.x, 0, r.pos.z - l.pos.z).normalize();
  // Towers.
  for (const foot of [l.pos, r.pos]) {
    for (let k = 0; k < 7; k++) {
      box(buf, trs(foot.x, ground + 0.9 + k * 1.8, foot.z, yaw, 3.4, 1.8, 3.4, m), k % 2 ? C.mud : C.mudDark);
    }
    // Crenellations.
    for (let k = -1; k <= 1; k++) {
      box(buf, trs(foot.x + dir.x * k * 1.1, ground + 13.4, foot.z + dir.z * k * 1.1, yaw, 1.1, 1.2, 3.4, m), C.mud);
    }
    // A little dome and a lamp.
    sphere(buf, trs(foot.x, ground + 14.4, foot.z, 0, 1.7, 1.4, 1.7, m), C.white, 10, 7);
    cylinder(buf, trs(foot.x, ground + 15.6, foot.z, 0, 0.12, 1.1, 0.12, m), C.yellow, 6);
  }
  // The arch: voussoirs around a half circle over the road.
  const R = span * 0.32;
  const top = ground + 7.2;
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * (i / 14);
    const px = mid.x - Math.cos(a) * R, py = top - 0.4 + Math.sin(a) * R;
    archStone(buf, v.set(px, py, mid.z), a - Math.PI / 2, 1.5, 1.1, 3.2, i % 2 ? C.mud : C.mudDark);
  }
  // Banner over the gate.
  box(buf, trs(mid.x, ground + 8.2, mid.z, yaw, span + 2.4, 2.4, 1.1, m), C.black);
  const rect = g.face('gobi-finish', () => bannerFace(g.atlas, g.rng.fork(0xf17), 'FINISH 终点 · 戈壁', 'red'));
  if (rect) {
    const nx = -Math.sin(yaw), nz = -Math.cos(yaw);
    faceQuad(g.faces.at(mid.x, mid.z), v.set(mid.x + nx * 0.6, ground + 8.2, mid.z + nz * 0.6), yaw, span + 1.6, 1.9, rect);
  }
  // Flags on the towers.
  for (const foot of [l.pos, r.pos]) {
    cylinder(buf, trs(foot.x, ground + 13.6, foot.z, 0, 0.1, 3.4, 0.1, m), C.steel, 6);
    box(buf, trs(foot.x + dir.x * 1.2, ground + 15.4, foot.z + dir.z * 1.2, yaw, 0.08, 1.4, 2.2, m), C.red);
  }
  g.ctx.log(`gobi: caravanserai finish at s=${Math.round(s)} (to riders ${toRiders.toFixed(2)})`);
}

/** The start gantry over the road (the shared truss gantry, with a GOBI banner). */
export function startGantry(g: GobiCtx, s: number): void {
  const l = g.place.spot(s, -1, 2.4), r = g.place.spot(s, 1, 2.4);
  const gt = gantry(g.props.at(l.pos.x, l.pos.z), l.pos, r.pos, 6.6);
  const toRiders = g.place.spot(s, 1, 0).along + Math.PI;
  const frontYaw = gt.yaw, backYaw = gt.yaw + Math.PI;
  const frontFacesRiders = Math.cos(frontYaw - toRiders) > 0;
  const fr = g.face('gobi-start', () => gantryFace(g.atlas, 'GOBI', '暴力鹈鹕 · 戈壁公路'));
  if (!fr) return;
  const w = gt.span + 0.6;
  const c = frontFacesRiders ? gt.front : gt.back;
  const yaw = frontFacesRiders ? frontYaw : backYaw;
  faceQuad(g.faces.at(c.x, c.z), c, yaw, w, Math.min(2.5, w / 6), fr);
}

/** A roadside oasis: palms, a water pool and a well head. */
export function oasis(g: GobiCtx, s: number, side: -1 | 1): void {
  const sp = g.place.spot(s, side, 20);
  if (!g.place.free(sp.pos.x, sp.pos.z, 12, 10)) return;
  const { x, z } = sp.pos;
  const y = sp.pos.y;
  for (let i = 0; i < 7; i++) {
    const a = g.rng.range(0, 6.28), r = g.rng.range(3, 11);
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (!g.place.free(px, pz, 1.6, 1)) continue;
    const py = g.ctx.groundWorld(px, pz);
    palm(g.props.at(px, pz), g.thin.at(px, pz), px, py, pz, g.rng.range(0, 6.28), g.rng);
  }
  // The pool: a shallow blue disc sunk into the sand.
  const buf = g.props.at(x, z);
  cylinder(buf, trs(x, y - 0.2, z, 0, 3.2, 0.3, 3.0, m), C.salt, 16);
  cylinder(buf, trs(x, y + 0.02, z, 0, 2.7, 0.06, 2.5, m), new Color('#3fa9c9'), 16);
  // A well head with a bucket.
  cylinder(buf, trs(x + 4, y, z + 2, 0, 1.1, 1.1, 1.1, m), C.mud, 12);
  cylinder(buf, trs(x + 4, y + 1.1, z + 2, 0, 1.2, 0.2, 1.2, m), C.mudDark, 12);
}
