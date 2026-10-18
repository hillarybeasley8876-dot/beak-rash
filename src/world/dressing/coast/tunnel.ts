// Coast tunnel fit-out (鹈鹕岬隧道) over the shared shell (features/tunnel.ts): lighting overlays
// (tunnel-light.ts), lamp housings, wall lamps, jet fans, a black jagged band over the red dado,
// meme exit signs and portal name plates (tunnel-signs.ts), and a rocky, pine-topped headland on the cap.
import { Color, Matrix4, Vector3 } from 'three';
import type { TrackFeature } from '../../../core/types';
import { capHalfW, capHeight, CROWN, LAMP_EVERY, tunnelHalfW, vaultY, WALL_H } from '../../features/tunnel';
import type { MeshBuf } from '../../geom';
import { box, cylinder } from '../../kit/shapes';
import { bush, umbrellaPine } from '../../scenery/props/nature';
import { cragCluster } from '../../scenery/props/rocks';
import type { Dress } from '../dress';
import { tunnelLight, vaultLamps } from './tunnel-light';
import { tunnelSigns } from './tunnel-signs';

const COL = {
  housing: new Color('#3a3c44'), fan: new Color('#a7adb8'), fanIn: new Color('#26282e'), bracket: new Color('#2b2d33'),
  wallLamp: new Color('#fff1c2'), ink: new Color('#0b0b0f'),
};
const m = new Matrix4(), basis = new Matrix4();
const A = new Vector3(), B = new Vector3(), C = new Vector3(), R = new Vector3(), Tn = new Vector3(), U = new Vector3();

/** Track basis at s: R = right, Tn = tangent, U = up. */
function frameAt(d: Dress, s: number): void {
  const fr = d.ctx.q.frameVis(s);
  R.set(fr.right.x, fr.right.y, fr.right.z);
  Tn.set(fr.tangent.x, fr.tangent.y, fr.tangent.z);
  U.set(fr.up.x, fr.up.y, fr.up.z);
}

/** Box aligned with the road at (s, x, y): w across, len along, h up. */
function roadBox(d: Dress, buf: MeshBuf, s: number, x: number, y: number, w: number, len: number, h: number, col: Color): void {
  frameAt(d, s);
  d.ctx.q.toWorld(s, x, y, A);
  basis.makeBasis(R, U, Tn.clone().negate());
  m.copy(basis).scale(B.set(w, h, len)).setPosition(A);
  box(buf, m, col);
}

/** Housings round the vault strips, wall lamps between them, jet fans and the jagged band. */
function fixtures(d: Dress, f: TrackFeature, halfW: number): void {
  const { b } = d;
  for (const sc of vaultLamps(f)) {
    for (const x of [-2.2, 2.2]) {
      d.ctx.q.toWorld(sc, x, 0, C);
      roadBox(d, b.props.at(C.x, C.z), sc, x, vaultY(x, halfW) + 0.035, 0.62, 2.8, 0.16, COL.housing);
    }
    const sw = sc + LAMP_EVERY / 2;
    if (sw > f.s1 - 4) continue;
    for (const side of [-1, 1] as const) {
      d.ctx.q.toWorld(sw, side * halfW, 0, C);
      roadBox(d, b.props.at(C.x, C.z), sw, side * (halfW - 0.1), WALL_H - 0.35, 0.2, 1.5, 0.5, COL.housing);
      roadBox(d, b.glow.at(C.x, C.z), sw, side * (halfW - 0.21), WALL_H - 0.35, 0.04, 1.2, 0.32, COL.wallLamp);
    }
  }
  for (let s = f.s0 + 24; s < f.s1 - 18; s += 40) jetFans(d, s, halfW);
  jaggedBand(d, f, halfW);
}

/** A pair of jet fans hanging from the vault at s. */
function jetFans(d: Dress, s: number, halfW: number): void {
  for (const x of [-2.9, 2.9]) {
    const y = vaultY(x, halfW) - 0.95;
    frameAt(d, s);
    d.ctx.q.toWorld(s - 1.5, x, y, A);
    const buf = d.b.props.at(A.x, A.z);
    // Unit cylinder (radius 1, y 0..1) along the road: x → right, y → tangent, z → up.
    basis.makeBasis(R, Tn, U);
    m.copy(basis).scale(B.set(0.5, 3, 0.5)).setPosition(A);
    cylinder(buf, m, COL.fan, 12, 1, 1, true, COL.fanIn);
    for (const ds of [-0.8, 0.8]) roadBox(d, buf, s + ds, x, y + 0.75, 0.1, 0.1, 0.55, COL.bracket);
  }
}

/** P5 sawtooth in black just above the red dado on both walls (unlit). */
function jaggedBand(d: Dress, f: TrackFeature, halfW: number): void {
  const n = new Vector3();
  for (const side of [-1, 1] as const) {
    const x = side * (halfW - 0.015);
    for (let s = f.s0 + 0.5, k = 0; s < f.s1 - 1.3; s += 0.8, k++) {
      d.ctx.q.toWorld(s, x, 1.25, A);
      d.ctx.q.toWorld(s + 0.8, x, 1.25, B);
      d.ctx.q.toWorld(s + 0.4, x, k % 2 ? 1.36 : 1.5, C);
      frameAt(d, s);
      n.copy(R).multiplyScalar(-side);
      const buf = d.b.glow.at(A.x, A.z);
      const i = buf.vert(A, n, COL.ink), j = buf.vert(B, n, COL.ink), l = buf.vert(C, n, COL.ink);
      // Face the road: counter-clockwise seen from inside the tube.
      if (side > 0) buf.tri(i, l, j); else buf.tri(i, j, l);
    }
  }
}

/** Limestone outcrops, scrub and umbrella pines on the headland over the tube; a rocky crown
 *  along the top of both portal headwalls so the cap reads as rock, not a smooth mound. */
function capDressing(d: Dress, f: TrackFeature): void {
  const { ctx, field, place, rng, b } = d;
  const W = capHalfW(field, f);
  for (const s of [f.s0 + 1.2, f.s1 - 1.2]) {
    for (let x = -W + 0.8; x < W - 0.5; x += rng.range(1.4, 2.2)) {
      const y = capHeight(ctx, field, f, s, x);
      ctx.q.toWorld(s, x, 0, A);
      cragCluster(b.props.at(A.x, A.z), A.x, y - 0.2, A.z, rng.range(1.0, 1.9), rng);
    }
  }
  for (let s = f.s0 + 3; s < f.s1 - 3; s += rng.range(2, 3.5)) {
    const x = rng.range(-W + 1, W - 1);
    const y = capHeight(ctx, field, f, s, x);
    ctx.q.toWorld(s, x, 0, A);
    if (!place.claim(A.x, A.z, 1.6)) continue;
    const buf = b.props.at(A.x, A.z), roll = rng.next();
    const edge = Math.abs(x) > W * 0.55;
    if (roll < (edge ? 0.7 : 0.35)) cragCluster(buf, A.x, y - 0.4, A.z, rng.range(1.2, 2.8), rng);
    else if (roll < 0.75) bush(buf, A.x, y, A.z, rng, rng.range(1, 1.6), rng.chance(0.3));
    else umbrellaPine(buf, A.x, y - 0.2, A.z, rng, rng.range(0.9, 1.25));
  }
}

export function tunnelFitOut(d: Dress): void {
  for (const f of d.ctx.L.features) {
    if (f.kind !== 'tunnel') continue;
    const halfW = tunnelHalfW(d.field, f);
    tunnelLight(d, f, halfW);
    fixtures(d, f, halfW);
    capDressing(d, f);
    tunnelSigns(d, f, halfW, CROWN);
  }
}
