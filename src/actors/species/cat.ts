// 哈基米 the cat: chubby orange tabby with bold back stripes and a forehead "M", big round head, huge green
// eyes under smug lids, cream muzzle with a ":3" grin, ears poking out past the red domed helmet, cream
// mitten paws, long striped tail with a cream tip. Signature: OIIA SPIN.
import { addEars, addMouth, addTail } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { ARM_UP, buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { Prim } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xf4a23e, STRIPE = 0xc4611f, CREAM = 0xfff1d6, PINK = 0xff9fb0;

function stripes(): Prim[] {
  const out: Prim[] = [];
  for (const [z, y, rx] of [[-0.2, 0.44, 0.55], [-0.1, 0.42, 0.5], [0.0, 0.38, 0.45], [0.09, 0.33, 0.4], [0.16, 0.26, 0.35]] as const) {
    out.push({ shape: { kind: 'box', c: [0, y, z], h: [0.3, 0.1, 0.02], round: 0.01 }, rot: [rx, 0, 0], op: 'paint', color: STRIPE, bone: B.spine });
  }
  for (const x of [-0.045, 0, 0.045]) {
    out.push({ shape: { kind: 'box', c: [x, 0.69, -0.46], h: [0.011, 0.04, 0.06], round: 0.005 }, rot: [-0.5, 0, x * 5], op: 'paint', color: STRIPE, bone: B.head });
  }
  for (const s of [-1, 1]) {
    for (const y of [0.6, 0.565]) {
      out.push({ shape: { kind: 'box', c: [s * 0.175, y, -0.36], h: [0.03, 0.009, 0.05], round: 0.004 }, rot: [0, s * 0.5, 0], op: 'paint', color: STRIPE, bone: B.head });
    }
  }
  return out;
}

const spec: MammalSpec = {
  fur: FUR, belly: CREAM, muzzle: CREAM, nose: 0xff8fa0,
  body: { c: [0, 0.17, -0.06], r: [0.21, 0.19, 0.24], rot: 0.35 },
  chest: { c: [0, 0.29, -0.22], r: [0.17, 0.16, 0.16] },
  head: { c: [0, 0.6, -0.33], r: [0.185, 0.165, 0.165] },
  snout: { c: [0, 0.55, -0.47], r: [0.08, 0.055, 0.056] },
  cheeks: { c: [-0.07, 0.545, -0.445], r: [0.075, 0.055, 0.06], color: CREAM },
  noseAt: [0, 0.58, -0.522], noseR: [0.021, 0.014, 0.012],
  chin: { c: [0, 0.505, -0.455], r: [0.055, 0.03, 0.045] },
  arm: [0.064, 0.06, 0.068], leg: [0.095, 0.075, 0.062, 0.056],
  hand: { r: [0.062, 0.046, 0.066], color: CREAM, toes: 3 },
  foot: { r: [0.062, 0.045, 0.085], color: CREAM, toes: 3, pad: PINK, drop: 0.012 },
  eye: { at: [-0.076, 0.625, -0.462], r: 0.053, dir: [-0.32, 0.05, -0.95], pupil: 0.025, iris: { r: 0.043, color: 0x8ccf3a } },
  extra: stripes(),
  budget: 2100,
};

const J = mammalJoints(spec, {
  hat: [0, 0.69, -0.31], ear: [-0.13, 0.7, -0.29],
  // Shoulders forward/down on a hunched chest: the paws reach the bars with bent elbows (no sleeve arms).
  clav: [-0.07, 0.3, -0.26], shoulder: [-0.15, 0.29, -0.32], elbow: [-0.24, 0.17, -0.45], wrist: [-0.18, 0.02, -0.59],
  tail: [[0, 0.17, 0.2], [0, 0.22, 0.3]],
});

export const cat: SpeciesDef = {
  id: 'cat',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0.2, lidTilt: 0.22,
    neckReach: 0.05, tail: 'long', earFlop: 0.05, armUp: ARM_UP, gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.53, -0.52], skin: FUR, skillPose: 'spin',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'pointy', w: 0.12, h: 0.13, thick: 0.024, color: FUR, inner: PINK, tilt: 0.55, back: 0.1, turn: 0.25 });
    addMouth(b, [[-0.042, 0.548, -0.51], [-0.021, 0.534, -0.522], [0, 0.546, -0.527], [0.021, 0.534, -0.522], [0.042, 0.548, -0.51]], 0.005);
    addHelmet(b, { c: [0, 0.69, -0.31], r: [0.195, 0.155, 0.205], pitch: -0.22, color: 0xd9534f, stripe: 0xffffff, strap: { chin: [0, 0.49, -0.42] } });
    addTail(b, J, { kind: 'long', r: 0.036, color: FUR, stripe: STRIPE, tip: CREAM });
  },
};
