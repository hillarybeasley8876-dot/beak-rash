// Water Town landmarks: the memorial archway (牌坊), the tea house (茶馆), the distant pagoda and
// the black-awning canal boat (乌篷船).
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { box, cylinder, sphere, trs } from '../../kit/shapes';
import { quad, tri, WPAL } from './props';

const C = (h: string): Color => new Color(h);
const PAL = {
  stone: C('#cfc7b6'),
  stoneDark: C('#b0a795'),
  beam: C('#8d3a2c'),
  beamDark: C('#6d2b21'),
  plaque: C('#2a2118'),
  gold: C('#e8c063'),
  awning: C('#c9a86a'),
  awningDark: C('#a9884f'),
  hull: C('#4a3a2c'),
  hullDark: C('#33281e'),
  canopy: C('#1b1c20'),
  bamboo: C('#b9a06a'),
  tea: C('#e8dcc0'),
};

const lm = new Matrix4();
const p = (base: Matrix4, x: number, y: number, z: number, out = new Vector3()): Vector3 =>
  out.set(x, y, z).applyMatrix4(base);

/**
 * Memorial archway (牌坊) spanning the road: four stone pillars, three carved beams and a small
 * tiled roof over the middle bay. Local X spans the road, local Z runs along it.
 */
export function wtArchway(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng): { w: number; h: number } {
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  const W = 6.8, H = 5.4, D = 0.7;   // the pillars stand clear of the drivable lane
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(buf, new Matrix4().multiplyMatrices(base, trs(sx * W, H / 2, sz * D, 0, 0.52, H, 0.52, lm)), PAL.stone);
      box(buf, new Matrix4().multiplyMatrices(base, trs(sx * W, 0.22, sz * D, 0, 0.78, 0.44, 0.78, lm)), PAL.stoneDark);
      box(buf, new Matrix4().multiplyMatrices(base, trs(sx * W, H - 0.1, sz * D, 0, 0.7, 0.3, 0.7, lm)), PAL.stoneDark);
    }
  }
  // Beams: a heavy lower one and two lighter ones above it.
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 3.5, 0, 0, W * 2 + 1.3, 0.52, 0.62, lm)), PAL.beam);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 4.35, 0, 0, W * 1.5, 0.36, 0.5, lm)), PAL.beamDark);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 5.0, 0, 0, W * 1.9, 0.34, 0.46, lm)), PAL.beam);
  // The name plaque in the middle bay.
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 4.35, -0.32, 0, 1.9, 0.9, 0.1, lm)), PAL.plaque);
  // A small tiled roof over the middle, its corners turned up.
  const RW = W * 1.05, RD = 0.95, rise = 0.8, Y0 = 5.35;
  const xs = [-RW, -RW * 0.5, RW * 0.5, RW];
  const eave = (xi: number): number => Y0 + 0.32 * (Math.abs(xi) / RW) ** 2;
  for (const [z0, z1, front] of [[-RD, 0, true], [0, RD, false]] as Array<[number, number, boolean]>) {
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i] as number, x1 = xs[i + 1] as number;
      const a = p(base, x0, eave(x0), z0), b = p(base, x1, eave(x1), z0);
      const c = p(base, x1, Y0 + rise, z1), dd = p(base, x0, Y0 + rise, z1);
      if (front) quad(buf, a, dd, c, b, WPAL.tile);
      else quad(buf, a, b, c, dd, WPAL.tile);
    }
  }
  for (const sx of [-1, 1]) {
    const x = sx * RW;
    const a = p(base, x, eave(x), -RD), b = p(base, x, eave(x), RD), c = p(base, x, Y0 + rise, 0);
    if (sx < 0) tri(buf, a, b, c, WPAL.tileLight);
    else tri(buf, b, a, c, WPAL.tileLight);
  }
  return { w: W * 2, h: H };
}

/** Tea house (茶馆): a two-storey white house with a deep awning over the open ground floor. */
export function wtTeaHouse(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng): { w: number; h: number } {
  const w = 9, d = 6.5, h = 5.8;
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 0.2, d / 2, 0, w + 0.3, 0.4, d + 0.3, lm)), WPAL.plinth);
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, h / 2 + 0.2, d / 2, 0, w, h, d, lm)), WPAL.wall[0] as Color);
  // Open ground floor: dark posts and a shopfront.
  for (const px of [-w / 2 + 0.6, 0, w / 2 - 0.6]) {
    box(buf, new Matrix4().multiplyMatrices(base, trs(px, 1.6, -0.15, 0, 0.3, 3, 0.3, lm)), WPAL.woodDark);
  }
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, 1.7, 0.4, 0, w - 1.4, 2.4, 0.2, lm)), PAL.tea);
  // The awning over the front.
  quad(buf, p(base, -w / 2 - 0.4, 3.3, -2.1), p(base, w / 2 + 0.4, 3.3, -2.1), p(base, w / 2 + 0.4, 3.9, 0.1), p(base, -w / 2 - 0.4, 3.9, 0.1), PAL.awning);
  quad(buf, p(base, -w / 2 - 0.4, 3.9, 0.1), p(base, w / 2 + 0.4, 3.9, 0.1), p(base, w / 2 + 0.4, 3.3, -2.1), p(base, -w / 2 - 0.4, 3.3, -2.1), PAL.awningDark);
  for (const px of [-w / 2 + 0.4, w / 2 - 0.4]) {
    cylinder(buf, new Matrix4().multiplyMatrices(base, trs(px, 1.5, -1.9, 0, 0.09, 3, 0.09, lm)), WPAL.woodDark, 6, 1, 1, false);
  }
  // Upper storey windows and the roof.
  for (const px of [-w / 4, w / 4]) {
    box(buf, new Matrix4().multiplyMatrices(base, trs(px, 4.7, -0.08, 0, 1.1, 1.2, 0.14, lm)), WPAL.glass);
  }
  const W = w / 2 + 0.7, E = 0.7, rise = 1.2;
  const ridge = p(base, 0, h + 0.2 + rise, d / 2);
  for (const [z0, z1, front] of [[-E, d / 2, true], [d / 2, d + E, false]] as Array<[number, number, boolean]>) {
    const a = p(base, -W, h + 0.2, z0), b = p(base, W, h + 0.2, z0);
    const c = p(base, W, h + 0.2, z1), dd = p(base, -W, h + 0.2, z1);
    if (front) quad(buf, a, dd, c, b, WPAL.tile);
    else quad(buf, a, b, c, dd, WPAL.tile);
  }
  for (const sx of [-1, 1]) {
    const a = p(base, sx * W, h + 0.2, -E), b = p(base, sx * W, h + 0.2, d + E);
    if (sx < 0) tri(buf, a, b, ridge, WPAL.wallShade);
    else tri(buf, b, a, ridge, WPAL.wallShade);
  }
  return { w, h };
}

/** Distant pagoda: five shrinking tiers with a little roof on each. */
export function wtPagoda(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng, scale = 1): void {
  const base = trs(x, y, z, ry, scale, scale, scale, new Matrix4());
  const tiers = 5;
  let w = 6.2;
  for (let i = 0; i < tiers; i++) {
    const hgt = 3.1;
    const y0 = i * hgt;
    box(buf, new Matrix4().multiplyMatrices(base, trs(0, y0 + hgt / 2, 0, 0, w, hgt, w, lm)), WPAL.wall[1] as Color);
    // The little roof of the tier: four slopes to a point.
    const rise = 0.9, hw = w / 2 + 0.7;
    const top = p(base, 0, y0 + hgt + rise, 0);
    const c1 = p(base, -hw, y0 + hgt, -hw), c2 = p(base, hw, y0 + hgt, -hw);
    const c3 = p(base, hw, y0 + hgt, hw), c4 = p(base, -hw, y0 + hgt, hw);
    quad(buf, c1, c4, top, c2, WPAL.tile);
    quad(buf, c3, c2, top, c4, WPAL.tile);
    tri(buf, c1, c2, top, WPAL.tileLight);
    tri(buf, c4, c3, top, WPAL.tileLight);
    w *= 0.86;
  }
  box(buf, new Matrix4().multiplyMatrices(base, trs(0, tiers * 3.1 + 0.5, 0, 0, 0.3, 1.1, 0.3, lm)), PAL.gold);
  sphere(buf, new Matrix4().multiplyMatrices(base, trs(0, tiers * 3.1 + 1.1, 0, 0, 0.34, 0.34, 0.34, lm)), PAL.gold, 7, 5);
}

/**
 * Black-awning canal boat (乌篷船) for the float-sway buffer: a low wooden hull, a curved black
 * bamboo awning and a punting pole. The origin is at the waterline, the bow toward local −Z.
 */
export function wtBoat(buf: MeshBuf, x: number, y: number, z: number, ry: number, rng: Rng): void {
  const phase = rng.range(0, 6.28);
  buf.stamp(phase, 0);
  const base = trs(x, y, z, ry, 1, 1, 1, new Matrix4());
  const L = 3.4, B = 0.62;
  // Hull: a flat-bottomed boat with a raised, pointed bow.
  const deck = 0.34;
  const parts: Array<[number, number, number, number, number, number, Color]> = [
    [0, 0.1, 0, B * 2, 0.34, L * 1.7, PAL.hull],
  ];
  for (const [cx, cy, cz, sx, sy, sz, col] of parts) {
    box(buf, new Matrix4().multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, lm)), col);
  }
  const bow = p(base, 0, 0.32, -L * 1.15);
  const sternL = p(base, -B, 0.32, L * 0.8), sternR = p(base, B, 0.32, L * 0.8);
  tri(buf, sternL, sternR, bow, PAL.hullDark);
  quad(buf, p(base, -B, deck, L * 0.8), p(base, B, deck, L * 0.8), p(base, B, deck, -L * 0.55), p(base, -B, deck, -L * 0.55), PAL.hullDark);
  // The black awning: a half cylinder over the middle.
  const seg = 6, r = 0.72, len = 1.9, z0 = -L * 0.25;
  for (let i = 0; i < seg; i++) {
    const a0 = Math.PI * (i / seg), a1 = Math.PI * ((i + 1) / seg);
    const q0 = p(base, -Math.cos(a0) * r, 0.34 + Math.sin(a0) * r, z0);
    const q1 = p(base, -Math.cos(a1) * r, 0.34 + Math.sin(a1) * r, z0);
    const q2 = p(base, -Math.cos(a1) * r, 0.34 + Math.sin(a1) * r, z0 + len);
    const q3 = p(base, -Math.cos(a0) * r, 0.34 + Math.sin(a0) * r, z0 + len);
    quad(buf, q0, q1, q2, q3, PAL.canopy);
  }
  // Punting pole and a coil of rope.
  buf.stamp(phase, 0.5);
  cylinder(buf, new Matrix4().multiplyMatrices(base, trs(0.35, 0.2, 0.4, 0.5, 0.05, 3.1, 0.05, lm)), PAL.bamboo, 5, 1, 1, false);
  buf.stamp(0, 0);
}
