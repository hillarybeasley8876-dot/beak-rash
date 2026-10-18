// What the cue layer (rig/cues.ts) contributes on top of the riding pose each frame. All values are
// additive offsets or 0..1 blends so several clips can stack; `clearCue` resets them per frame.
import { Vector3 } from 'three';

export interface ArmCue {
  /** Wrist target (character space) and elbow pole; blend 0 = hands on the grips. */
  target: Vector3;
  pole: Vector3;
  blend: number;
  /** Extra hand pitch (rad) for slaps/swings. */
  wrist: number;
}

export interface CueOut {
  spinePitch: number; spineYaw: number; spineRoll: number;
  headPitch: number; headYaw: number; headRoll: number;
  /** 0..1 straighten + extend the neck forward (pelican S-neck, goose honk). */
  neck: number;
  /** Whole-body yaw on the saddle (cat OIIA spin), rad. */
  spin: number;
  /** 0..1 feet leave the pedals and tuck under the spinning body. */
  legTuck: number;
  /** 0..1 lie flat on the bike (penguin belly slide). */
  lie: number;
  /** Pelvis lift off the saddle (m): ult leap crouch, victory stand. */
  lift: number;
  jaw: number;      // 0..1 mouth open
  pouch: number;    // 0..1+ pouch inflation
  wings: number;    // 0..1 wings spread wide (wing dash, ult)
  flap: number;     // −1..1 spread-wing flap (raises/lowers the spread wing tips)
  bellReach: number; // 0..1 right paw on the bike's bell (ringing it)
  glint: number;    // 0..1 sparkle on the shades / eye (doge, flash)
  steam: number;    // 0..1 zen steam puffs rising from the head (capybara chill)
  squash: number;   // + = squash (scale y down), − = stretch
  squint: number;   // 0..1
  wide: number;     // 0..1 eyes wide (hit)
  blink: number;    // 0..1 forced lid closure (dizzy, smug)
  brow: number;     // −1 worried .. +1 angry
  armL: ArmCue;
  armR: ArmCue;
}

const arm = (): ArmCue => ({ target: new Vector3(), pole: new Vector3(), blend: 0, wrist: 0 });

type Scalar = Exclude<keyof CueOut, 'armL' | 'armR'>;
const SCALARS: readonly Scalar[] = [
  'spinePitch', 'spineYaw', 'spineRoll', 'headPitch', 'headYaw', 'headRoll', 'neck', 'spin', 'legTuck', 'lie', 'lift', 'jaw', 'pouch',
  'wings', 'flap', 'bellReach', 'glint', 'steam', 'squash', 'squint', 'wide', 'blink', 'brow',
];

/**
 * Add an arm request with weight w. Requests blend by w² (the strongest dominates, but crossing weights glide
 * instead of jumping from one target to the other).
 */
export function mergeArm(a: ArmCue, target: Vector3, pole: Vector3, wrist: number, w: number): void {
  if (w <= 1e-4) return;
  if (a.blend <= 1e-4) {
    a.target.copy(target);
    a.pole.copy(pole);
    a.wrist = wrist;
    a.blend = Math.min(1, w);
    return;
  }
  const wa = a.blend * a.blend, wb = w * w, k = wb / (wa + wb);
  a.target.lerp(target, k);
  a.pole.lerp(pole, k);
  a.wrist += (wrist - a.wrist) * k;
  a.blend = Math.min(1, Math.max(a.blend, w));
}

/** dst += src · f (scalars) and src's arm requests merged with weight blend · f. */
export function mixCue(dst: CueOut, src: CueOut, f: number): void {
  for (const k of SCALARS) dst[k] += src[k] * f;
  mergeArm(dst.armL, src.armL.target, src.armL.pole, src.armL.wrist, src.armL.blend * f);
  mergeArm(dst.armR, src.armR.target, src.armR.pole, src.armR.wrist, src.armR.blend * f);
}

export function makeCue(): CueOut {
  return {
    spinePitch: 0, spineYaw: 0, spineRoll: 0, headPitch: 0, headYaw: 0, headRoll: 0, neck: 0, spin: 0, legTuck: 0, lie: 0,
    lift: 0, jaw: 0, pouch: 0, wings: 0, flap: 0, bellReach: 0, glint: 0, steam: 0, squash: 0, squint: 0, wide: 0, blink: 0, brow: 0,
    armL: arm(), armR: arm(),
  };
}

export function clearCue(c: CueOut): void {
  for (const k of SCALARS) c[k] = 0;
  c.armL.blend = c.armR.blend = 0;
  c.armL.wrist = c.armR.wrist = 0;
}
