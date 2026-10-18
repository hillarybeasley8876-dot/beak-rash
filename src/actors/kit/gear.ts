// Head gear: cycling helmets (SDF shell with vents, aero tail or round, chin strap) and goggles. Everything rides the
// `hat` bone so the whole set pops off together in a crash.
import { Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { CharacterBuilder } from './builder';
import type { Prim, V3 } from './sdf';
import { placed, vec } from './face';
import { addTube } from './tube';
import { B } from '../rig/skeleton';

export interface HelmetOpts {
  c: V3;            // shell centre
  r: V3;            // shell radii (domed helmets: r[1] ≈ 0.8·r[0])
  pitch: number;    // forward tilt (rad, + = front down; − lifts the front rim above the eyes)
  color: number;
  stripe?: number;  // centre stripe colour
  vent?: number;    // vent groove colour
  /** Round kids'/skate helmet (no aero tail). */
  round?: boolean;
  /** Chin strap from both rim sides to a point under the chin. */
  strap?: { chin: V3; color?: number };
  cell?: number;
}

export function addHelmet(b: CharacterBuilder, o: HelmetOpts): void {
  const [cx, cy, cz] = o.c;
  const [rx, ry, rz] = o.r;
  const vent = o.vent ?? 0x2a2a30;
  const rot: V3 = [-o.pitch, 0, 0];
  const prims: Prim[] = [{ shape: { kind: 'ellipsoid', c: o.c, r: o.r }, rot, color: o.color, bone: B.hat, k: 0.01 }];
  if (!o.round) {
    prims.push({ shape: { kind: 'capsule', a: [cx, cy + ry * 0.2, cz + rz * 0.5], b: [cx, cy - ry * 0.05, cz + rz * 1.08], r: ry * 0.42, r2: ry * 0.12 }, color: o.color, bone: B.hat, k: 0.05 });
  }
  // Cut the bottom flat and hollow it so it reads as a shell when it flies off.
  prims.push(
    { shape: { kind: 'box', c: [cx, cy - ry * 0.32 - 0.3, cz], h: [0.6, 0.3, 0.6], round: 0 }, rot, op: 'sub', color: vent, bone: B.hat, k: 0.012 },
    { shape: { kind: 'ellipsoid', c: [cx, cy - ry * 0.22, cz + rz * 0.04], r: [rx * 0.86, ry * 0.82, rz * 0.86] }, rot, op: 'sub', color: vent, bone: B.hat, k: 0.01 },
  );
  for (const vx of [-0.62, -0.25, 0.25, 0.62]) {
    const x = cx + vx * rx;
    const yTop = cy + ry * Math.sqrt(Math.max(0, 1 - vx * vx)) * 0.98;
    prims.push({
      shape: { kind: 'capsule', a: [x, yTop - ry * 0.16, cz - rz * 0.6], b: [x, yTop + ry * 0.02, cz + rz * 0.3], r: Math.min(rx, rz) * 0.07 },
      rot, op: 'sub', color: vent, bone: B.hat, k: 0.006,
    });
  }
  if (o.stripe !== undefined) {
    prims.push({ shape: { kind: 'box', c: [cx, cy + ry * 0.5, cz], h: [rx * 0.09, ry * 0.8, rz * 1.6], round: 0.004 }, op: 'paint', color: o.stripe, bone: B.hat });
  }
  b.sdf(prims, o.cell ?? 0.011, 360);
  if (o.strap) {
    const rim = cy - ry * 0.3, ch = o.strap.chin;
    for (const s of [-1, 1]) {
      addTube(b, [
        { p: [cx + s * rx * 0.9, rim, cz + rz * 0.12], r: 0.007, bone: B.hat },
        { p: [ch[0] + s * rx * 0.55, (rim + ch[1]) / 2, (cz + ch[2]) / 2], r: 0.007, bone: B.hat },
        { p: [ch[0] + s * 0.012, ch[1], ch[2]], r: 0.007, bone: B.hat },
      ], { color: o.strap.color ?? 0x2a2a30, sides: 4, seg: 2, outline: 0.4 });
    }
  }
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
  const torus = new TorusGeometry(1, 0.22, 4, 12);
  const sphere = new SphereGeometry(1, 6, 4);
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
