// Head gear: aero cycling helmet (SDF shell with vents + rear tail) and goggles. Everything rides the
// `hat` bone so the whole set pops off together in a crash.
import { Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { CharacterBuilder } from './builder';
import type { Prim, V3 } from './sdf';
import { placed, vec } from './face';
import { B } from '../rig/skeleton';

export interface HelmetOpts {
  c: V3;            // shell centre
  r: V3;            // shell radii
  pitch: number;    // forward tilt (rad, + = front down)
  color: number;
  stripe?: number;  // centre stripe colour
  vent?: number;    // vent groove colour
  cell?: number;
}

export function addHelmet(b: CharacterBuilder, o: HelmetOpts): void {
  const [cx, cy, cz] = o.c;
  const [rx, ry, rz] = o.r;
  const vent = o.vent ?? 0x2a2a30;
  const rot: V3 = [-o.pitch, 0, 0];
  const prims: Prim[] = [
    { shape: { kind: 'ellipsoid', c: o.c, r: o.r }, rot, color: o.color, bone: B.hat, k: 0.01 },
    // Aero tail at the back.
    { shape: { kind: 'capsule', a: [cx, cy + ry * 0.2, cz + rz * 0.5], b: [cx, cy - ry * 0.05, cz + rz * 1.08], r: ry * 0.42, r2: ry * 0.12 }, color: o.color, bone: B.hat, k: 0.05 },
    // Cut the bottom flat and hollow it so it reads as a shell when it flies off.
    { shape: { kind: 'box', c: [cx, cy - ry * 0.32 - 0.3, cz], h: [0.6, 0.3, 0.6], round: 0 }, rot, op: 'sub', color: vent, bone: B.hat, k: 0.012 },
    { shape: { kind: 'ellipsoid', c: [cx, cy - ry * 0.22, cz + rz * 0.04], r: [rx * 0.84, ry * 0.8, rz * 0.84] }, op: 'sub', color: vent, bone: B.hat, k: 0.01 },
  ];
  for (const vx of [-0.42, 0, 0.42]) {
    const x = cx + vx * rx;
    const yTop = cy + ry * Math.sqrt(Math.max(0, 1 - vx * vx)) * 0.98;
    prims.push({
      shape: { kind: 'capsule', a: [x, yTop - ry * 0.12, cz - rz * 0.62], b: [x, yTop + ry * 0.02, cz + rz * 0.25], r: Math.min(rx, rz) * 0.075 },
      rot, op: 'sub', color: vent, bone: B.hat, k: 0.006,
    });
  }
  if (o.stripe !== undefined) {
    prims.push({ shape: { kind: 'box', c: [cx, cy + ry * 0.5, cz], h: [rx * 0.075, ry * 0.8, rz * 1.6], round: 0.004 }, op: 'paint', color: o.stripe, bone: B.hat });
  }
  b.sdf(prims, o.cell ?? 0.011, 420);
}

export interface GoggleOpts {
  /** Centre between the two lenses, the facing direction and lens spacing. */
  c: V3;
  dir: V3;
  spacing: number;
  lensR: number;
  frame: number;
  lens: number;
  strap?: { c: V3; r: number; tube: number; color: number };
}

export function addGoggles(b: CharacterBuilder, o: GoggleOpts): void {
  const torus = new TorusGeometry(1, 0.22, 5, 14);
  const sphere = new SphereGeometry(1, 10, 5);
  const lensCap = new SphereGeometry(1, 12, 3, 0, Math.PI * 2, 0, Math.PI * 0.42);
  lensCap.rotateX(-Math.PI / 2);
  const d = vec(o.dir).normalize();
  const side = new Vector3().crossVectors(new Vector3(0, 1, 0), d).normalize();
  for (const s of [-1, 1]) {
    const p = vec(o.c).addScaledVector(side, s * o.spacing * 0.5);
    b.part({ geometry: torus, matrix: placed(p, d, o.lensR), color: o.frame, bone: B.hat, outline: 0.5 });
    b.part({ geometry: lensCap, matrix: placed(p.clone().addScaledVector(d, -o.lensR * 0.32), d, [o.lensR * 1.25, o.lensR * 1.25, o.lensR * 0.75]), color: o.lens, bone: B.hat, outline: 0 });
    const hl = p.clone().addScaledVector(d, o.lensR * 0.2).add(new Vector3(0, o.lensR * 0.35, 0)).addScaledVector(side, -s * o.lensR * 0.3);
    b.part({ geometry: sphere, matrix: placed(hl, d, [o.lensR * 0.22, o.lensR * 0.16, o.lensR * 0.08]), color: 0xffffff, bone: B.hat, outline: 0 });
  }
  if (o.strap) {
    const st = o.strap;
    const m = new Matrix4().compose(vec(st.c), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2), new Vector3(st.r, st.r * 1.15, st.r));
    const band = new TorusGeometry(1, st.tube / st.r, 5, 24);
    b.part({ geometry: band, matrix: m, color: st.color, bone: B.hat, outline: 0.4 });
    band.dispose();
  }
  torus.dispose();
  sphere.dispose();
  lensCap.dispose();
}
