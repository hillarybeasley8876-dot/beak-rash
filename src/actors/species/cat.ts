// 哈基米 the cat: orange tabby with forehead "M" and back stripes, big round head, cheeky ":3" grin,
// pointy ears poking out past the red helmet, white socks, long striped tail. Signature: OIIA SPIN.
import { addEars, addMouth, addTail } from '../kit/ears-tails';
import { addHelmet } from '../kit/gear';
import { buildMammal, mammalJoints, type MammalSpec } from '../kit/mammal';
import type { Prim } from '../kit/sdf';
import { B } from '../rig/skeleton';
import type { SpeciesDef } from './types';

const FUR = 0xf2a03d, STRIPE = 0xc8682a, CREAM = 0xfff4e0;

function stripes(): Prim[] {
  const out: Prim[] = [];
  for (const [z, y] of [[-0.07, 0.33], [0.02, 0.32], [0.1, 0.28], [0.17, 0.22]] as const) {
    out.push({ shape: { kind: 'box', c: [0, y + 0.08, z], h: [0.3, 0.07, 0.018], round: 0.01 }, rot: [-0.5, 0, 0], op: 'paint', color: STRIPE, bone: B.spine });
  }
  for (const x of [-0.035, 0, 0.035]) {
    out.push({ shape: { kind: 'box', c: [x, 0.8, -0.42], h: [0.01, 0.045, 0.08], round: 0.005 }, rot: [-0.6, 0, x * 6], op: 'paint', color: STRIPE, bone: B.head });
  }
  return out;
}

const spec: MammalSpec = {
  fur: FUR, belly: CREAM, muzzle: CREAM, nose: 0xff8fa0,
  body: { c: [0, 0.22, -0.04], r: [0.17, 0.17, 0.2], rot: 0.3 },
  chest: { c: [0, 0.36, -0.14], r: [0.145, 0.14, 0.15] },
  head: { c: [0, 0.7, -0.34], r: [0.15, 0.135, 0.13] },
  snout: { c: [0, 0.655, -0.44], r: [0.07, 0.048, 0.05] },
  cheeks: { c: [-0.068, 0.648, -0.425], r: [0.062, 0.046, 0.05], color: CREAM },
  noseAt: [0, 0.682, -0.492], noseR: [0.017, 0.011, 0.01],
  chin: { c: [0, 0.615, -0.44], r: [0.045, 0.025, 0.035] },
  arm: [0.056, 0.047, 0.041], leg: [0.07, 0.052, 0.044, 0.04], paw: [0.048, 0.04, 0.054], pawColor: CREAM, footPaw: [0.042, 0.032, 0.06],
  eye: { at: [-0.066, 0.722, -0.445], r: 0.043, dir: [-0.3, 0.06, -0.95], pupil: 0.019, iris: { r: 0.034, color: 0x9ccf3f } },
  extra: stripes(),
  budget: 2500,
};

const J = mammalJoints(spec, {
  hat: [0, 0.8, -0.33], ear: [-0.1, 0.79, -0.31],
  neck: [[0, 0.47, -0.2], [0, 0.51, -0.23], [0, 0.55, -0.26]], head: [0, 0.59, -0.28],
  tail: [[0, 0.14, 0.18], [0, 0.18, 0.28]],
});

export const cat: SpeciesDef = {
  id: 'cat',
  joints: J,
  meta: {
    wings: false, hat: 'helmet', eyeDir: spec.eye.dir, lid: { open: -0.85, closed: 1.45 }, sleepy: 0,
    neckReach: 0.05, tail: 'long', armUp: [0, -0.75, 0.66], gripDrop: 0.03, ankleLift: [0, 0.05, 0.05],
    beak: [0, 0.64, -0.5], skin: FUR, skillPose: 'spin',
  },
  build(b) {
    buildMammal(b, J, spec);
    addEars(b, J, { kind: 'pointy', w: 0.1, h: 0.11, thick: 0.022, color: FUR, inner: 0xff9fb0, tilt: 0.45, back: 0.12, turn: 0.2 });
    addMouth(b, [[-0.038, 0.655, -0.483], [-0.019, 0.643, -0.493], [0, 0.656, -0.494], [0.019, 0.643, -0.493], [0.038, 0.655, -0.483]], 0.0045);
    addHelmet(b, { c: [0, 0.805, -0.33], r: [0.148, 0.08, 0.148], pitch: 0.15, color: 0xd9534f, stripe: 0xffffff });
    addTail(b, J, { kind: 'long', r: 0.03, color: FUR, stripe: STRIPE, tip: STRIPE });
  },
};
