// 神烦狗 the shiba: tan coat with cream cheeks, brow dots, belly and curled tail tip; pointy ears; pixel
// "deal-with-it" shades pushed down the snout so the doge side-eye shows above. Signature: DOGE SHIELD.
import { addEars, addMouth, addTail } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import { addPixelShades } from '../kit/props';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xe8a35c, CREAM = 0xfff3e2;

const spec: MammalSpec = {
  fur: FUR, belly: CREAM, muzzle: CREAM, nose: 0x1d1d22,
  body: { c: [0, 0.22, -0.04], r: [0.18, 0.18, 0.21], rot: 0.3 },
  chest: { c: [0, 0.37, -0.14], r: [0.15, 0.145, 0.155] },
  head: { c: [0, 0.71, -0.34], r: [0.14, 0.125, 0.13] },
  snout: { c: [0, 0.66, -0.46], r: [0.066, 0.054, 0.088] },
  cheeks: { c: [-0.075, 0.655, -0.41], r: [0.066, 0.05, 0.062], color: CREAM },
  noseAt: [0, 0.683, -0.548], noseR: [0.022, 0.016, 0.014],
  chin: { c: [0, 0.618, -0.47], r: [0.045, 0.024, 0.05] },
  arm: [0.058, 0.049, 0.043], leg: [0.072, 0.054, 0.046, 0.041], paw: [0.048, 0.04, 0.054], pawColor: CREAM, footPaw: [0.042, 0.032, 0.06],
  eye: { at: [-0.062, 0.738, -0.44], r: 0.036, dir: [-0.26, 0.05, -0.96], pupil: 0.017, aspect: 0.86 },
  extra: [
    { shape: { kind: 'ellipsoid', c: [-0.055, 0.782, -0.452], r: [0.017, 0.012, 0.012] }, op: 'paint', color: CREAM, bone: B.head },
    { shape: { kind: 'ellipsoid', c: [0.055, 0.782, -0.452], r: [0.017, 0.012, 0.012] }, op: 'paint', color: CREAM, bone: B.head },
  ],
  budget: 2500,
};

const J = mammalJoints(spec, { hat: [0, 0.8, -0.33], ear: [-0.085, 0.8, -0.31] });

export const shiba: SpeciesDef = {
  id: 'shiba',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.18, lookBias: 0.32,
    neckReach: 0.05, tail: 'curl', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.64, -0.54], skin: FUR, skillPose: 'doge',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'pointy', w: 0.09, h: 0.1, thick: 0.022, color: FUR, inner: CREAM, tilt: 0.28, back: 0.15, turn: 0.12 });
    addMouth(b, [[-0.032, 0.64, -0.522], [0, 0.633, -0.535], [0.032, 0.64, -0.522]], 0.0045);
    addPixelShades(b, [0, 0.705, -0.525], 0.17);
    addHelmet(b, { c: [0, 0.812, -0.325], r: [0.143, 0.08, 0.148], pitch: 0.15, color: 0x2b2b2b, stripe: FUR });
    addTail(b, J, { kind: 'curl', r: 0.042, color: FUR, tip: CREAM });
  },
};
