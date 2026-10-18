// City shops and street-level landmarks: night-market food stalls (烧烤 grill with glowing coals /
// 奶茶 tea bar with pastel cups), subway entrances (glass stair hood + lit pylon) and the 24 h
// convenience store kiosk. Builders return sign slots (face centre, yaw, size) that the city
// dressing fills with neon-atlas faces. Local frame: origin at the front-centre ground point,
// front (customers / the road) faces −Z.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { AuxBuf } from '../../dressing/city/batch';
import type { MeshBuf } from '../../geom';
import { box, cylinder, sphere, trs } from '../../kit/shapes';
import { fbox, winSpec } from './city-kit';

export interface FaceSlot { pos: Vector3; yaw: number; w: number; h: number }

const C = (h: string): Color => new Color(h);
const STEEL = C('#8b93a3'), DARK = C('#1a1b22'), WOOD = C('#7a4a2c'), GLASS = C('#9fd6ff'), CONCRETE = C('#7d7b86');
const COALS = new Color(2.6, 0.75, 0.15), LANTERN = new Color(2.4, 0.35, 0.18), WARM = new Color(2.2, 1.8, 1.2);
const CUPS = [C('#ffb3c7'), C('#c9a27a'), C('#a8e6cf'), C('#ffd166'), C('#b8a9ff')];
const lm = new Matrix4(), wm = new Matrix4();

/** Local box helper bound to a base frame. */
function kit(base: Matrix4) {
  return (buf: MeshBuf, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color, ry = 0): void =>
    box(buf, wm.multiplyMatrices(base, trs(cx, cy, cz, ry, sx, sy, sz, lm)), col);
}

const local = (base: Matrix4, x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).applyMatrix4(base);

/** Night-market stall: counter, striped awning, roof sign board; grill or tea bar; stools; lanterns. */
export function foodStall(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, kind: 'bbq' | 'tea', rng: Rng): FaceSlot {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const part = kit(base);
  const body = kind === 'bbq' ? C('#9b2b1f') : C('#5fc7b0');
  const stripe = kind === 'bbq' ? [C('#e5191c'), C('#f4f1ea')] : [C('#ff7fbf'), C('#f4f1ea')];
  part(props, 0, 0.5, 0.5, 2.4, 1.0, 0.9, body);
  part(props, 0, 1.03, 0.45, 2.6, 0.06, 1.05, STEEL);
  for (const [px, pz] of [[-1.2, 0.05], [1.2, 0.05], [-1.2, 0.95], [1.2, 0.95]] as Array<[number, number]>) part(props, px, 1.5, pz, 0.07, 3.0, 0.07, DARK);
  // Awning: alternating stripes sloping down toward the customers.
  for (let i = 0; i < 6; i++) part(props, -1.1 + i * 0.44, 2.45, -0.05, 0.44, 0.05, 1.4, stripe[i % 2] as Color);
  part(props, 0, 2.3, -0.75, 2.66, 0.28, 0.05, stripe[0] as Color);
  part(props, 0, 3.0, 0.5, 2.5, 0.8, 0.12, DARK);
  if (kind === 'bbq') {
    part(props, -0.45, 1.12, 0.3, 1.2, 0.14, 0.45, DARK);
    part(glow, -0.45, 1.2, 0.3, 1.08, 0.03, 0.36, COALS);
    for (let i = 0; i < 7; i++) part(props, -0.95 + i * 0.16, 1.25, 0.3, 0.03, 0.03, 0.55, WOOD);
  } else {
    for (let i = 0; i < 6; i++) {
      const col = rng.pick(CUPS);
      cylinder(props, wm.multiplyMatrices(base, trs(-0.9 + i * 0.3, 1.06, 0.2, 0, 0.07, 0.22, 0.07, lm)), col, 7);
    }
    part(glow, 0, 1.75, 0.98, 1.9, 0.75, 0.04, WARM);
  }
  for (let i = 0; i < 3; i++) {
    cylinder(props, wm.multiplyMatrices(base, trs(-0.8 + i * 0.8, 0, -0.75, 0, 0.18, 0.55, 0.18, lm)), C('#d8262c'), 8);
  }
  for (const lx of [-1.1, 0, 1.1]) sphere(glow, wm.multiplyMatrices(base, trs(lx, 1.95, -0.82, 0, 0.17, 0.22, 0.17, lm)), LANTERN, 7, 5);
  return { pos: local(base, 0, 3.0, 0.41), yaw, w: 2.3, h: 0.66 };
}

/** Subway entrance hood (stairs run along local X, open end at −X) + sign pylon at the open end. */
export function subwayEntrance(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number): FaceSlot[] {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const part = kit(base);
  const L = 6.4, D = 2.8;
  part(props, 0, 0.012, D / 2, L, 0.03, D - 0.4, C('#0c0c12'));
  for (let i = 0; i < 7; i++) part(props, -L / 2 + 0.6 + i * 0.75, 0.03, D / 2, 0.12, 0.02, D - 0.6, C('#55545e'));
  for (const zz of [0.1, D - 0.1]) {
    part(props, 0.3, 0.5, zz, L - 0.6, 1.0, 0.18, CONCRETE);
    part(glow, 0.3, 1.04, zz, L - 0.6, 0.06, 0.2, new Color(0.6, 1.6, 2.2));
  }
  part(props, L / 2, 1.25, D / 2, 0.3, 2.5, D, CONCRETE);
  for (const [px, pz] of [[-L / 2 + 0.2, 0.1], [-L / 2 + 0.2, D - 0.1], [L / 2 - 0.2, 0.1], [L / 2 - 0.2, D - 0.1]] as Array<[number, number]>) part(props, px, 1.3, pz, 0.1, 2.6, 0.1, STEEL);
  part(props, 0, 2.62, D / 2, L + 0.3, 0.14, D + 0.3, DARK);
  part(props, 0, 2.5, D / 2, L - 0.4, 0.04, D - 0.6, GLASS);
  part(glow, 0, 2.53, D / 2, L - 1.2, 0.03, 0.3, WARM);
  // Pylon with a lit sign box on top, at the open end facing the road and along it.
  part(props, -L / 2 - 0.6, 1.6, 0.2, 0.3, 3.2, 0.3, DARK);
  part(props, -L / 2 - 0.6, 3.6, 0.2, 1.3, 0.9, 0.5, DARK);
  return [
    { pos: local(base, -L / 2 - 0.6, 3.6, -0.06), yaw, w: 1.2, h: 0.8 },
    { pos: local(base, -L / 2 - 1.26, 3.6, 0.2), yaw: yaw + Math.PI / 2, w: 0.46, h: 0.8 },
  ];
}

/**
 * 24 h convenience store: bright glazed shop floor with shelf silhouettes, a three-colour stripe
 * band, flats above (window shader), freezer and bins outside. Returns the fascia slot.
 */
export function convenienceStore(body: AuxBuf, props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, w: number, d: number, rng: Rng): FaceSlot {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const part = kit(base);
  const GF = 4.6;
  fbox(body, base, 0, GF + 3.2, d / 2, w, 6.4, d, C('#5a6182'), winSpec(1, rng.range(0, 99), 0.55, 0, 2.2, 3.2, GF), C('#22232c'));
  body.setAux(0);
  box(body, wm.multiplyMatrices(base, trs(0, GF / 2, d / 2 + 0.3, 0, w, GF, d - 0.6, lm)), C('#d9d8dc'));
  part(glow, 0, 1.45, 0.28, w - 0.8, 2.5, 0.04, new Color(2.0, 2.15, 2.3));
  for (const yy of [0.75, 1.35, 1.95]) part(props, -w * 0.12, yy, 0.22, w * 0.55, 0.08, 0.06, C('#4b5160'));
  part(props, w * 0.3, 1.45, 0.22, 0.08, 2.5, 0.06, DARK);
  part(props, 0, 2.8, 0.25, w, 0.14, 0.1, DARK);
  ([[C('#ff8a1f'), 3.02], [C('#1fae5c'), 3.22], [C('#2f7fc1'), 3.42]] as Array<[Color, number]>).forEach(([col, yy]) => part(glow, 0, yy, 0.22, w, 0.2, 0.05, col.clone().multiplyScalar(1.8)));
  part(props, 0, 4.02, 0.24, w * 0.7, 0.9, 0.1, DARK);
  // Outside: ice-cream freezer with a lit lid, three recycling bins.
  part(props, -w / 2 + 0.9, 0.45, -0.6, 1.2, 0.9, 0.65, C('#eeeef2'));
  part(glow, -w / 2 + 0.9, 0.92, -0.6, 1.05, 0.04, 0.5, new Color(1.4, 1.9, 2.3));
  [C('#2f7fc1'), C('#1fae5c'), C('#e5191c')].forEach((col, i) => part(props, w / 2 - 1.6 + i * 0.55, 0.45, -0.45, 0.45, 0.9, 0.45, col));
  return { pos: local(base, 0, 4.02, 0.18), yaw, w: w * 0.68, h: 0.84 };
}
