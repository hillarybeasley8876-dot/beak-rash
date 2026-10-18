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
// Canopies: toon colours (self-lit batch adds an emissive share so they read at night).
const BLOSSOM = [C('#ff8cc8'), C('#ffa8d8'), C('#ff6fb8')];
const GINKGO = [C('#ffcc1a'), C('#ffb81a'), C('#ffdd44')];
const FAIRY = new Color(2.0, 1.7, 1.2);
const PLANTER = C('#4c4a55'), BARK = C('#4a3326');
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

/**
 * Planter box with a cherry (pink) or ginkgo (gold) tree. The canopy is a scalloped cluster of smooth
 * blobs in the self-lit toon batch (cel ramp + outline + an emissive share, aux style 5) with darker
 * undersides; warm fairy-light specks are scattered over it (glow).
 */
export function planterTree(props: MeshBuf, lit: AuxBuf, glow: MeshBuf, x: number, y: number, z: number, yaw: number, rng: Rng, kind: 'cherry' | 'ginkgo'): void {
  // The planter box is square to the kerb (a turned box poked its corner over the drivable edge).
  box(props, trs(x, y + 0.3, z, yaw, 1.6, 0.6, 1.6, m), PLANTER);
  const h = rng.range(2.5, 3.1);
  cylinder(props, trs(x, y + 0.5, z, 0, 0.2, h * 0.75, 0.2, m), BARK, 7, 1, 0.75);
  const pal = kind === 'cherry' ? BLOSSOM : GINKGO;
  const fork = rng.range(0, Math.PI);
  for (const k of [-1, 1]) {
    const a = fork + (k > 0 ? 0 : Math.PI);
    const tip = new Vector3(x + Math.cos(a) * 0.55, y + 0.5 + h * 1.02, z + Math.sin(a) * 0.55);
    segment(props, new Vector3(x, y + 0.5 + h * 0.62, z), tip, 0.11, BARK);
  }
  // Central blob, a ring of five lobes (scalloped silhouette) and a crown lobe.
  const blobs: Array<[number, number, number, number]> = [[0, 0.1, 0, rng.range(1.15, 1.3)], [rng.range(-0.2, 0.2), 0.75, rng.range(-0.2, 0.2), rng.range(0.65, 0.8)]];
  for (let i = 0; i < 5; i++) {
    const a = fork + (i / 5) * Math.PI * 2 + rng.range(-0.35, 0.35), rr = rng.range(0.7, 0.88);
    blobs.push([Math.cos(a) * rr, rng.range(-0.25, 0.35), Math.sin(a) * rr, rng.range(0.58, 0.78)]);
  }
  lit.setAux(5, kind === 'cherry' ? 0.42 : 0.36);
  for (const [i, [ox, oy, oz, r]] of blobs.entries()) {
    const col = rng.pick(pal);
    const seg = i === 0 ? 14 : 12;
    sphere(lit, trs(x + ox, y + 0.5 + h + oy, z + oz, rng.range(0, 3), r, r * 0.84, r, m), col, seg, seg - 4, col.clone().multiplyScalar(0.55));
  }
  lit.setAux(0);
  // Fairy-light specks scattered over random lobes (never a symmetric pair that reads as eyes).
  for (let k = 0; k < 11; k++) {
    const [ox, oy, oz, r] = blobs[rng.int(0, blobs.length - 1)] ?? [0, 0, 0, 1];
    const a = rng.range(0, Math.PI * 2), e = rng.range(-0.2, 1.1);
    const lx = x + ox + Math.cos(a) * Math.cos(e) * r * 1.01, ly = y + 0.5 + h + oy + Math.sin(e) * r * 0.85, lz = z + oz + Math.sin(a) * Math.cos(e) * r * 1.01;
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
