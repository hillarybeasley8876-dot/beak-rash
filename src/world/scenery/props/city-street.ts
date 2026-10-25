// City street furniture: tall street lamps (glowing heads), traffic lights on mast arms (cycling
// lamps), bus shelters with lit ad panels, vending machines, planter trees (cherry / ginkgo) and
// parked scooters. Positions are world ground points; `yaw` turns local −Z toward the road.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { AuxBuf } from '../../dressing/city/batch';
import { segment } from '../../dressing/city/util';
import type { MeshBuf } from '../../geom';
import { box, cylinder, sphere, trs } from '../../kit/shapes';
import { C } from './city-kit';

const POLE = C('#2a2c36'), STEEL = C('#8a93a3'), HOUSING = C('#16171d'), GLASS = C('#9fd6ff');
const RED = new Color(1, 0.12, 0.08), AMBER = new Color(1, 0.6, 0.05), GREEN = new Color(0.1, 1, 0.55);
// Canopies: three toon tones per tree so neighbouring lobes differ, and a warm dark underside (the violet
// night ambient turns plain darker pinks purple and darker yellows olive). The batch adds a small emissive share.
const BLOSSOM = [C('#ff8fb0'), C('#ffb6cc'), C('#f06892')], BLOSSOM_UNDER = C('#93305e');
const GINKGO = [C('#ffbe1f'), C('#ffd650'), C('#f39c14')], GINKGO_UNDER = C('#a3580f');
const FAIRY = new Color(2.0, 1.7, 1.2);
const PLANTER = C('#5a5866'), BARK = C('#6b4a35');
const m = new Matrix4(), m2 = new Matrix4();

/** Local → world for a prop frame at (x, y, z) turned by yaw. */
const local = (x: number, y: number, z: number, yaw: number, lx: number, ly: number, lz: number): Vector3 =>
  new Vector3(lx, ly, lz).applyMatrix4(trs(x, y, z, yaw, 1, 1, 1, m2));

/** Street lamp: pole, arm reaching `reach` m over the road, glowing head. Returns the head position. */
export function streetLamp(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, light: Color, reach = 2.6, h = 8): Vector3 {
  cylinder(props, trs(x, y - 0.3, z, 0, 0.12, h + 0.3, 0.12, m), POLE, 7, 1, 0.75, false);
  cylinder(props, trs(x, y - 0.3, z, 0, 0.22, 1.0, 0.22, m), POLE, 7, 1, 0.8);
  const arm = local(x, y, z, yaw, 0, h - 0.1, -reach / 2);
  box(props, trs(arm.x, arm.y, arm.z, yaw, 0.1, 0.1, reach, m), POLE);
  const head = local(x, y, z, yaw, 0, h - 0.25, -reach);
  box(props, trs(head.x, head.y, head.z, yaw, 0.5, 0.18, 1.0, m), HOUSING);
  box(glow, trs(head.x, head.y - 0.11, head.z, yaw, 0.38, 0.05, 0.86, m), light);
  return head;
}

/** Traffic light on a mast arm over the road + a pedestrian head on the pole (cycle batch lamps). */
export function trafficLight(props: MeshBuf, lights: AuxBuf, x: number, y: number, z: number, yaw: number, phase: number, reach = 4.5): void {
  cylinder(props, trs(x, y - 0.3, z, 0, 0.14, 6.6, 0.14, m), POLE, 7, 1, 0.8, false);
  const arm = local(x, y, z, yaw, 0, 6.1, -reach / 2);
  box(props, trs(arm.x, arm.y, arm.z, yaw, 0.12, 0.12, reach, m), POLE);
  // Signal head facing the oncoming riders (local +X side of the arm = along the road).
  const hp = local(x, y, z, yaw, 0, 5.4, -reach + 0.3);
  box(props, trs(hp.x, hp.y, hp.z, yaw, 0.45, 1.35, 0.4, m), HOUSING);
  ([[RED, 0, 0.42], [AMBER, 1, 0], [GREEN, 2, -0.42]] as Array<[Color, number, number]>).forEach(([col, role, dy]) => {
    for (const fz of [-1, 1]) {
      const lp = local(hp.x, hp.y, hp.z, yaw + Math.PI / 2, 0, dy, fz * 0.22);
      lights.setAux(phase, role);
      sphere(lights, trs(lp.x, lp.y, lp.z, 0, 0.13, 0.13, 0.13, m), col, 6, 4);
    }
  });
  const pp = local(x, y, z, yaw, 0, 2.6, -0.25);
  box(props, trs(pp.x, pp.y, pp.z, yaw, 0.32, 0.7, 0.22, m), HOUSING);
  lights.setAux(phase, 3);
  box(lights, trs(pp.x, pp.y + 0.15, pp.z, yaw, 0.22, 0.2, 0.26, m), RED);
  lights.setAux(phase, 4);
  box(lights, trs(pp.x, pp.y - 0.15, pp.z, yaw, 0.22, 0.2, 0.26, m), GREEN);
  lights.setAux(0);
}

/** Bus shelter: roof, back panel, lit ad box at one end, bench. Local −Z faces the road. */
export function busShelter(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, ad: Color): void {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const part = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Color, buf: MeshBuf = props): void =>
    box(buf, new Matrix4().multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, m)), col);
  part(0, 2.55, 0.6, 4.6, 0.16, 1.7, STEEL);
  for (const sx of [-2.1, 2.1]) part(sx, 1.25, 1.2, 0.1, 2.5, 0.1, STEEL);
  part(0, 1.3, 1.25, 4.0, 1.9, 0.05, GLASS);
  part(-2.25, 1.25, 0.55, 0.25, 2.1, 1.1, HOUSING);
  part(-2.25, 1.3, 0.55, 0.28, 1.7, 0.9, ad, glow);
  part(0.4, 0.45, 0.95, 2.6, 0.08, 0.45, STEEL);
}

/** Vending machine with a lit front and rows of coloured cans. */
export function vending(props: MeshBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, body: Color, rng: Rng): void {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  box(props, new Matrix4().multiplyMatrices(base, trs(0, 0.95, 0.35, 0, 1.0, 1.9, 0.7, m)), body);
  box(glow, new Matrix4().multiplyMatrices(base, trs(-0.1, 1.25, -0.01, 0, 0.62, 0.95, 0.02, m)), new Color(1.6, 1.7, 1.9));
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 4; i++) {
      const col = new Color().setHSL(rng.next(), 0.8, 0.55).multiplyScalar(1.6);
      box(glow, new Matrix4().multiplyMatrices(base, trs(-0.32 + i * 0.145, 1.55 - r * 0.3, -0.03, 0, 0.09, 0.17, 0.02, m)), col);
    }
  }
  box(props, new Matrix4().multiplyMatrices(base, trs(0.36, 1.1, -0.02, 0, 0.14, 0.3, 0.04, m)), HOUSING);
}

/** Planter tree look: crown centre above the planter top, lobe radius cap and the emissive share of the
 *  self-lit canopy (low, so the cel bands and ink lines separate the lobes instead of one glowing blob). */
export const TREE = { crown: [3.0, 3.4] as const, maxLobe: 1.0, canopyLit: 0.15, reach: 1.55 } as const;

/**
 * Planter box with a cherry (pink) or ginkgo (gold) tree. Planter, trunk and fork branches sit in the city's
 * self-lit batch with the street-glow wash (aux style 0: lit from the shop fronts below); the crown starts
 * ~2.7 m up (the chase camera looks under it) and is a scalloped cluster of smooth lobes of at most
 * TREE.maxLobe, cel-shaded with an ink outline and a small emissive share (aux style 5), darker underneath.
 * Warm fairy-light specks are scattered over it (glow). The crown reaches TREE.reach from the trunk.
 */
export function planterTree(lit: AuxBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng, kind: 'cherry' | 'ginkgo'): void {
  // The planter box is square to the kerb (a turned box poked its corner over the drivable edge).
  lit.setAux(0);
  box(lit, trs(x, y + 0.3, z, yaw, 1.6, 0.6, 1.6, m), PLANTER);
  const h = rng.range(TREE.crown[0], TREE.crown[1]), top = y + 0.5 + h;
  cylinder(lit, trs(x, y + 0.5, z, 0, 0.21, h * 0.78, 0.21, m), BARK, 8, 1, 0.7);
  const fork = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 3; k++) {
    const a = fork + (k / 3) * Math.PI * 2;
    segment(lit, new Vector3(x, y + 0.5 + h * 0.6, z), new Vector3(x + Math.cos(a) * 0.6, top - 0.1, z + Math.sin(a) * 0.6), 0.1, BARK);
  }
  // Core lobe, a ring of five lobes pushed out to the rim (scalloped silhouette) and a crown lobe on top.
  const lobe = (r: number): number => Math.min(TREE.maxLobe, r);
  const blobs: Array<[number, number, number, number]> = [[0, 0.1, 0, lobe(rng.range(0.92, 1.05))]];
  for (let i = 0; i < 5; i++) {
    const a = fork + (i / 5) * Math.PI * 2 + rng.range(-0.3, 0.3), r = lobe(rng.range(0.66, 0.84));
    const rr = TREE.reach - r;
    blobs.push([Math.cos(a) * rr, rng.range(-0.18, 0.22), Math.sin(a) * rr, r]);
  }
  blobs.push([rng.range(-0.2, 0.2), 0.78, rng.range(-0.2, 0.2), lobe(rng.range(0.62, 0.74))]);
  const pal = kind === 'cherry' ? BLOSSOM : GINKGO, under = kind === 'cherry' ? BLOSSOM_UNDER : GINKGO_UNDER;
  lit.setAux(5, TREE.canopyLit);
  for (const [i, [ox, oy, oz, r]] of blobs.entries()) {
    const seg = i === 0 ? 14 : 12;
    sphere(lit, trs(x + ox, top + oy, z + oz, rng.range(0, 3), r, r * 0.86, r, m), pal[i % pal.length] as Color, seg, seg - 4, under);
  }
  lit.setAux(0);
  // Fairy-light specks scattered over random lobes (never a symmetric pair that reads as eyes).
  for (let k = 0; k < 9; k++) {
    const [ox, oy, oz, r] = blobs[rng.int(0, blobs.length - 1)] ?? [0, 0, 0, 1];
    const a = rng.range(0, Math.PI * 2), e = rng.range(-0.2, 1.1);
    const lx = x + ox + Math.cos(a) * Math.cos(e) * r * 1.01, ly = top + oy + Math.sin(e) * r * 0.87, lz = z + oz + Math.sin(a) * Math.cos(e) * r * 1.01;
    box(glow, trs(lx, ly, lz, a, 0.05, 0.05, 0.05, m), FAIRY);
  }
}

/** Parked scooter (body, seat, two wheels). */
export function scooter(props: MeshBuf, x: number, y: number, z: number, yaw: number, col: Color): void {
  const base = trs(x, y, z, yaw, 1, 1, 1, new Matrix4());
  const part = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, c: Color): void =>
    box(props, new Matrix4().multiplyMatrices(base, trs(cx, cy, cz, 0, sx, sy, sz, m)), c);
  part(0, 0.45, 0, 0.42, 0.35, 1.2, col);
  part(0, 0.75, 0.25, 0.34, 0.12, 0.55, HOUSING);
  part(0, 0.95, -0.5, 0.12, 0.75, 0.12, col);
  part(0, 1.3, -0.5, 0.6, 0.06, 0.06, HOUSING);
  for (const wz of [-0.48, 0.48]) {
    const w = new Vector3(0, 0.22, wz).applyMatrix4(base);
    cylinder(props, new Matrix4().multiplyMatrices(trs(w.x, w.y, w.z, yaw, 1, 1, 1, m2), new Matrix4().makeRotationZ(Math.PI / 2)).multiply(new Matrix4().makeTranslation(0, -0.06, 0)).multiply(new Matrix4().makeScale(0.22, 0.12, 0.22)), HOUSING, 8);
  }
}
