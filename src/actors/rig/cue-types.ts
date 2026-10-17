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
  /** 0..1 lie flat on the bike (penguin belly slide). */
  lie: number;
  /** Pelvis lift off the saddle (m): ult leap crouch, victory stand. */
  lift: number;
  jaw: number;      // 0..1 mouth open
  pouch: number;    // 0..1+ pouch inflation
  wings: number;    // 0..1 wings spread wide (wing dash, ult)
  squash: number;   // + = squash (scale y down), − = stretch
  squint: number;   // 0..1
  wide: number;     // 0..1 eyes wide (hit)
  blink: number;    // 0..1 forced lid closure (dizzy, smug)
  brow: number;     // −1 worried .. +1 angry
  armL: ArmCue;
  armR: ArmCue;
}

const arm = (): ArmCue => ({ target: new Vector3(), pole: new Vector3(), blend: 0, wrist: 0 });

export function makeCue(): CueOut {
  return {
    spinePitch: 0, spineYaw: 0, spineRoll: 0, headPitch: 0, headYaw: 0, headRoll: 0, neck: 0, spin: 0, lie: 0,
    lift: 0, jaw: 0, pouch: 0, wings: 0, squash: 0, squint: 0, wide: 0, blink: 0, brow: 0, armL: arm(), armR: arm(),
  };
}

export function clearCue(c: CueOut): void {
  c.spinePitch = c.spineYaw = c.spineRoll = c.headPitch = c.headYaw = c.headRoll = 0;
  c.neck = c.spin = c.lie = c.lift = c.jaw = c.pouch = c.wings = c.squash = 0;
  c.squint = c.wide = c.blink = c.brow = 0;
  c.armL.blend = c.armR.blend = 0;
  c.armL.wrist = c.armR.wrist = 0;
}
