// The salted fish's grumpy face on both flanks: half-lidded side-eyes (sclera, pupil, highlight, heavy slanted
// lid), angry brows and a down-turned mouth line that meets across the snout.
import { Quaternion, SphereGeometry, Vector3 } from 'three';
import { sph, tube, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import { shadeAt, surf, surfNormal, type Spine } from './fish-body';

const EYE_U = 0.8, EYE_A = 0.42, R = 0.025, DARK = '#16181d';
const Y = new Vector3(0, 1, 0);

/** One eye on the flank `side` (+1 = the +n flank). */
function eye(ps: PartSet, s: Spine, side: 1 | -1, seg: Seg): void {
  const a = side > 0 ? EYE_A : Math.PI - EYE_A;
  const out = surfNormal(s, EYE_U, a), f = s.at(EYE_U);
  const up = f.d.clone().addScaledVector(out, -f.d.dot(out)).normalize();
  const fwd = f.t.clone().addScaledVector(out, -f.t.dot(out)).normalize();
  const c = surf(s, EYE_U, a).addScaledVector(out, -0.008);
  ps.add(sph(c, R, seg(10, 7), seg(6, 4)), { color: '#ffffff', outline: 0.004 });
  const pupil = c.clone().addScaledVector(out, R - 0.004).addScaledVector(up, -0.007).addScaledVector(fwd, 0.002);
  ps.add(sph(pupil, 0.0115, seg(7, 5), seg(5, 3)), { color: DARK });
  const glint = pupil.clone().addScaledVector(out, 0.0085).addScaledVector(up, 0.004).addScaledVector(fwd, 0.004);
  ps.add(sph(glint, 0.0035, 4, 3), { color: '#ffffff' });
  // Heavy upper lid: a cap over the top ~60 % of the eye, dipping toward the snout (sulky, annoyed).
  const lidUp = up.clone().addScaledVector(fwd, 0.4).normalize();
  const lid = new SphereGeometry(R * 1.12, seg(10, 7), seg(3, 2), 0, Math.PI * 2, 0, Math.PI * 0.56)
    .applyQuaternion(new Quaternion().setFromUnitVectors(Y, lidUp))
    .translate(c.x, c.y, c.z);
  ps.add(lid, { color: `#${shadeAt(EYE_A + 0.35).getHexString()}`, outline: 0.004 });
  const brow = [[-0.07, 0.86], [0.0, 0.8], [0.06, 0.55]].map(([du, da]) => surf(s, EYE_U + (du as number), side > 0 ? EYE_A + (da as number) : Math.PI - EYE_A - (da as number), 0.009));
  ps.add(tube(brow, 0.0068, seg(5, 4), 4), { color: DARK, outline: 0.003 });
}

/** Down-turned mouth line from the snout tip back along the flank `side`. */
function frown(ps: PartSet, s: Spine, side: 1 | -1, seg: Seg): void {
  const pts: V3[] = [[0.998, -0.25], [0.965, -0.38], [0.925, -0.62], [0.88, -1.05]]
    .map(([u, a]) => surf(s, u as number, side > 0 ? (a as number) : Math.PI - (a as number), 0.0015));
  ps.add(tube(pts, 0.0058, seg(7, 4), 4), { color: DARK });
}

export function fishFace(ps: PartSet, s: Spine, seg: Seg): void {
  for (const side of [1, -1] as const) {
    eye(ps, s, side, seg);
    frown(ps, s, side, seg);
  }
}
