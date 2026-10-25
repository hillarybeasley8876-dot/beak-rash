// Water Town building blocks: the white-walled black-tiled house (粉墙黛瓦) with upturned eaves,
// the drooping willow (垂柳) and the simple far house that fills the horizon.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cylinder, sphere, trs } from '../../kit/shapes';

const C = (h: string): Color => new Color(h);
export const WPAL = {
  wall: [C('#f4f0e6'), C('#efe9db'), C('#f7f3ea'), C('#ece5d4')],
  wallShade: C('#e2dbca'),
  plinth: C('#b9b2a4'),
  tile: C('#33373d'),
  tileLight: C('#434951'),
  ridge: C('#23262b'),
  wood: C('#6b4630'),
  woodDark: C('#4a2f21'),
  glass: C('#2b3138'),
  willow: C('#6f9c46'),
  willowLight: C('#87b356'),
  willowDark: C('#4f7a33'),
  stone: C('#c9c2b2'),
  sign: C('#8d3a2c'),
};

const m = new Matrix4(), lm = new Matrix4();
const n = new Vector3(), e1 = new Vector3();

/** Flat quad a-b-c-d (counter-clockwise seen from the front) with a computed normal. */
export function quad(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color): void {
  n.subVectors(b, a).cross(e1.subVectors(c, a)).normalize();
  const i = buf.vert(a, n, col), j = buf.vert(b, n, col), k = buf.vert(c, n, col), l = buf.vert(d, n, col);
  buf.quad(i, j, k, l);
}

/** Flat triangle a-b-c with a computed normal. */
export function tri(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, col: Color): void {
  n.subVectors(b, a).cross(e1.subVectors(c, a)).normalize();
  const i = buf.vert(a, n, col), j = buf.vert(b, n, col), k = buf.vert(c, n, col);
  buf.tri(i, j, k);
}

/** Local point of a building frame. */
const p = (base: Matrix4, x: number, y: number, z: number, out = new Vector3()): Vector3 =>
  out.set(x, y, z).applyMatrix4(base);

export interface HouseOpts {
  w?: number; d?: number; floors?: number;
  /** No lattice windows / balcony (the far roofline). */
  plain?: boolean;
}

/**
 * Whitewashed house with a black tiled roof whose eaves turn up at the corners.
 * (x, y, z) = the ground at the front centre; the front faces local −Z.
 */
export function wtHouse(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng, o: HouseOpts = {}): void {
  const w = o.w ?? rng.range(5, 7.5);
  const d = o.d ?? rng.range(4, 5.6);
  const floors = o.floors ?? rng.int(1, 2);
  const fh = 3, h = floors * fh;
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  const wall = rng.pick(WPAL.wall);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 0.2, d / 2, 0, w + 0.3, 0.4, d + 0.3, lm)), WPAL.plinth);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, h / 2 + 0.2, d / 2, 0, w, h, d, lm)), wall);

  // ---- the roof: two slopes from the eave to the ridge, the eave corners turned up.
  const W = w / 2 + 0.75, E = 0.8, rise = 2.1;
  const xs = [-W, -W * 0.52, W * 0.52, W];
  const flare = (xi: number): number => 0.5 * (Math.abs(xi) / W) ** 2;
  const eaveY = (xi: number): number => h + 0.2 + flare(xi);
  const ridgeY = (xi: number): number => h + 0.2 + rise - 0.07 * (Math.abs(xi) / W) ** 2;
  for (const [zEave, zRidge, dir] of [[-E, d / 2, -1], [d + E, d / 2, 1]] as Array<[number, number, number]>) {
    for (let band = 0; band < 2; band++) {
      const t0 = band * 0.5, t1 = band * 0.5 + 0.5;
      for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i] as number, x1 = xs[i + 1] as number;
        const a = p(base, x0, eaveY(x0) + (ridgeY(x0) - eaveY(x0)) * t0, zEave + (zRidge - zEave) * t0);
        const b = p(base, x1, eaveY(x1) + (ridgeY(x1) - eaveY(x1)) * t0, zEave + (zRidge - zEave) * t0);
        const c = p(base, x1, eaveY(x1) + (ridgeY(x1) - eaveY(x1)) * t1, zEave + (zRidge - zEave) * t1);
        const dd = p(base, x0, eaveY(x0) + (ridgeY(x0) - eaveY(x0)) * t1, zEave + (zRidge - zEave) * t1);
        // The front slope faces up and toward −Z, the back slope up and toward +Z.
        if (dir < 0) quad(buf, a, dd, c, b, band ? WPAL.tileLight : WPAL.tile);
        else quad(buf, a, b, c, dd, band ? WPAL.tileLight : WPAL.tile);
      }
    }
  }
  // Gable triangles under the roof at both ends.
  for (const sx of [-1, 1]) {
    const x = sx * W;
    const a = p(base, x, eaveY(x), -E), b = p(base, x, eaveY(x), d + E), c = p(base, x, ridgeY(x), d / 2);
    if (sx < 0) tri(buf, a, b, c, wall);
    else tri(buf, b, a, c, wall);
  }
  // Horse-head gable walls (马头墙): stepped white walls with a dark tile cap over the roof ends.
  const roofY = (z: number): number => {
    const yF = eaveY(0), yM = ridgeY(0);
    if (z <= d / 2) return yF + (yM - yF) * ((z + E) / (d / 2 + E));
    return yM + (yF - yM) * ((z - d / 2) / (d / 2 + E));
  };
  const STEPS = 4;
  for (const sx of [-1, 1]) {
    const x0 = sx * W, x1 = sx * (W + 0.3);
    for (const [za, zb] of [[-E, d / 2], [d / 2, d + E]] as Array<[number, number]>) {
      for (let k = 0; k < STEPS; k++) {
        const s0 = za + ((zb - za) * k) / STEPS, s1 = za + ((zb - za) * (k + 1)) / STEPS;
        const yTop = roofY(s1) + 0.55, yBot = roofY(s0) - 0.4;
        const a = p(base, x0, yBot, s0), b = p(base, x0, yTop, s0);
        const c = p(base, x0, yTop, s1), e = p(base, x0, yBot, s1);
        const a2 = p(base, x1, yTop, s0), b2 = p(base, x1, yTop, s1);
        if (sx > 0) {
          quad(buf, a, b, c, e, WPAL.wallShade);
          quad(buf, b, a2, b2, c, WPAL.tile);
        } else {
          quad(buf, a, e, c, b, WPAL.wallShade);
          quad(buf, b, c, b2, a2, WPAL.tile);
        }
      }
    }
  }
  // Ridge cap and the dark eave boards.
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, ridgeY(0) + 0.05, d / 2, 0, W * 2 - 0.3, 0.18, 0.34, lm)), WPAL.ridge);
  for (const z of [-E + 0.08, d + E - 0.08]) {
    box(buf, new Matrix4().multiplyMatrices(base, trs(0, eaveY(0) - 0.2, z, 0, W * 2 - 0.2, 0.34, 0.2, lm)), WPAL.ridge);
  }
  if (o.plain) return;
  const cols = Math.max(2, Math.floor(w / 2.6));
  const dx = -w / 2 + (w / cols) * (Math.floor(cols / 2) + 0.5);
  // The wooden shopfront (铺面): a panelled timber front under the white wall, with a counter
  // board, the door in the middle bay and a small hanging sign beside it.
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 1.35, -0.07, 0, w - 0.16, 1.7, 0.14, lm)), WPAL.wood);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 2.28, -0.12, 0, w - 0.02, 0.26, 0.26, lm)), WPAL.woodDark);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 0.44, -0.12, 0, w - 0.02, 0.22, 0.26, lm)), WPAL.woodDark);
  for (let i = 0; i <= cols; i++) {
    const px = -w / 2 + (w / cols) * i;
    box(buf, new Matrix4().multiplyMatrices(base, trs(px, 1.35, -0.16, 0, 0.15, 1.7, 0.12, lm)), WPAL.woodDark);
  }
  const cx = dx - 1.7 * Math.sign(dx || 1);
  box(buf, new Matrix4().multiplyMatrices(base, trs(cx, 1.0, -0.3, 0, 2.1, 0.14, 0.5, lm)), WPAL.wood);
  // The door in the middle bay and a small hanging shop sign beside it.
  box(buf, new Matrix4().multiplyMatrices(base, trs(dx, 1.35, -0.2, 0, 1.15, 2.3, 0.14, lm)), WPAL.woodDark);
  box(buf, new Matrix4().multiplyMatrices(base, trs(dx, 2.55, -0.24, 0, 1.45, 0.16, 0.3, lm)), WPAL.wood);
  const sx2 = dx + 1.5 * Math.sign(dx || 1);
  box(buf, new Matrix4().multiplyMatrices(base, trs(sx2, 1.85, -0.5, 0, 0.85, 0.62, 0.08, lm)), WPAL.sign);
  box(buf, new Matrix4().multiplyMatrices(base, trs(sx2, 2.28, -0.38, 0, 0.06, 0.34, 0.06, lm)), WPAL.woodDark);
  // Lattice windows on the upper floor.
  for (let f = 1; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const wx = -w / 2 + (w / cols) * (i + 0.5);
      const wy = 0.2 + f * fh + 1.05;
      box(buf, new Matrix4().multiplyMatrices(base, trs(wx, wy, -0.06, 0, 0.95, 1.15, 0.12, lm)), WPAL.glass);
      box(buf, new Matrix4().multiplyMatrices(base, trs(wx, wy, -0.13, 0, 0.07, 1.15, 0.06, lm)), WPAL.wood);
      box(buf, new Matrix4().multiplyMatrices(base, trs(wx, wy - 0.62, -0.12, 0, 1.05, 0.09, 0.22, lm)), WPAL.woodDark);
    }
  }
}

/** Willow: a leaning trunk, a soft canopy and long drooping strands. */
export function wtWillow(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, scale = 1): void {
  const H = rng.range(2.4, 3.2) * scale;
  const lean = rng.range(0.1, 0.4);
  const dir = rng.range(0, Math.PI * 2);
  const top = new Vector3(x + Math.cos(dir) * lean, y + H, z + Math.sin(dir) * lean);
  cylinder(buf, trs(x, y - 0.4, z, 0, 0.3 * scale, H + 0.4, 0.3 * scale, m), WPAL.wood, 7, 1, 0.62, false);
  for (let i = 0; i < 3; i++) {
    const r = rng.range(1.5, 2.2) * scale;
    sphere(buf, trs(top.x + rng.range(-0.7, 0.7), top.y + rng.range(-0.2, 0.7), top.z + rng.range(-0.7, 0.7), 0, r, r * 0.62, r, m),
      rng.chance(0.5) ? WPAL.willow : WPAL.willowLight, 8, 5, WPAL.willowDark);
  }
  // Drooping strands: a narrow ribbon falling from the canopy's rim.
  const strands = 9;
  for (let k = 0; k < strands; k++) {
    const a = (k / strands) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const r0 = rng.range(1.3, 2) * scale;
    const drop = rng.range(1.8, 3.2) * scale;
    const steps = 4;
    const pts: Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const rad = r0 * (1 - 0.25 * t);
      pts.push(new Vector3(top.x + Math.cos(a) * rad, top.y + 0.3 - drop * t * t, top.z + Math.sin(a) * rad));
    }
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.13 * scale);
    for (let i = 0; i < steps; i++) {
      const p0 = pts[i] as Vector3, p1 = pts[i + 1] as Vector3;
      const col = i === 0 ? WPAL.willowLight : WPAL.willow;
      quad(buf, p0.clone().sub(side), p1.clone().sub(side), p1.clone().add(side), p0.clone().add(side), col);
    }
  }
}

/** Far house for the roofline: a white box with a dark pitched roof and a stepped gable (马头墙). */
export function wtFarHouse(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng, scale = 1): void {
  const w = rng.range(6, 11) * scale, d = rng.range(5, 8) * scale, h = rng.range(3.4, 5.6) * scale;
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  const wall = rng.pick(WPAL.wall);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, h / 2, d / 2, 0, w, h, d, lm)), wall);
  const W = w / 2 + 0.4, E = 0.5, rise = 1.7 * scale;
  // The pitched roof: two slopes from the eave to the ridge.
  const ridge = p(base, 0, h + rise, d / 2);
  for (const [z0, z1, front] of [[-E, d / 2, true], [d / 2, d + E, false]] as Array<[number, number, boolean]>) {
    const a = p(base, -W, h, z0), b = p(base, W, h, z0);
    const c = p(base, W, h, z1), dd = p(base, -W, h, z1);
    if (front) quad(buf, a, dd, c, b, WPAL.tile);
    else quad(buf, a, b, c, dd, WPAL.tile);
  }
  for (const sx of [-1, 1]) {
    const x2 = sx * W;
    const a = p(base, x2, h, -E), b = p(base, x2, h, d + E);
    if (sx < 0) tri(buf, a, b, ridge, WPAL.wallShade);
    else tri(buf, b, a, ridge, WPAL.wallShade);
    // The stepped gable over the roof end: three white steps with a dark tile cap.
    const roofY = (z: number): number => (z <= d / 2
      ? h + rise * ((z + E) / (d / 2 + E))
      : h + rise * (1 - (z - d / 2) / (d / 2 + E)));
    for (let k = 0; k < 3; k++) {
      const z0 = -E + ((d + 2 * E) * k) / 3, z1 = -E + ((d + 2 * E) * (k + 1)) / 3;
      const y1 = roofY(z1) + 0.3 * scale, y0 = roofY(z0) - 0.3 * scale;
      const q0 = p(base, x2, y0, z0), q1 = p(base, x2, y1, z0);
      const q2 = p(base, x2, y1, z1), q3 = p(base, x2, y0, z1);
      if (sx < 0) quad(buf, q0, q3, q2, q1, WPAL.wallShade);
      else quad(buf, q0, q1, q2, q3, WPAL.wallShade);
      const c0 = p(base, x2, y1, z0), c1 = p(base, x2, y1, z1);
      const c2 = p(base, x2, y1 + 0.25 * scale, z1), c3 = p(base, x2, y1 + 0.25 * scale, z0);
      if (sx < 0) quad(buf, c0, c3, c2, c1, WPAL.tile);
      else quad(buf, c0, c1, c2, c3, WPAL.tile);
    }
  }
}
