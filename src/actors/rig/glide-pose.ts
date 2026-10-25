// The umbrella glide (SPEC §15): the rider holds the umbrella straight up over its head, the canopy open
// (the weapon mesh swaps itself, see weapons/index.ts), the torso tipped into the glide. The umbrella arm
// can only reach so far, so the torso leans until the raised hand clears the head — the goose's long neck
// needs a deeper lean than the pelican's short one.
import { Vector3 } from 'three';
import { clamp } from '../../core/math';
import type { RiderState } from '../../core/types';
import { snap } from './cue-math';
import { mergeArm, type CueOut } from './cue-types';
import { ARM, chainLengths } from './limb-ik';
import type { PoseState } from './pose-state';
import type { RidePose } from './ride';
import { B } from './skeleton';

const TUNE = {
  blend: 0.05,    // s, the blend in (the umbrella snaps open overhead)
  blendOut: 0.12, // s, the blend out
  clear: 0.19,    // m, the hand clears the head anchor by this much (the pose wants 0.1)
  anchor: 0.05,   // m, the head anchor sits this high above the head bone
  up: 0.97,       // the umbrella arm's direction: up
  fwd: 0.25,      // ... and a little forward over the head
  reach: 0.96,    // the fraction of the arm's reach the hand takes
  maxLean: 0.55,  // rad, the deepest lean into the glide
  stretch: 1.3,   // the arm's stretch limit while gliding (ride.ts stretchArm)
  baseStretch: 1.15,
};

const target = new Vector3();
const dir = new Vector3();
const pole = new Vector3();

export class GlidePose {
  /** Seconds since the glide started (or ended). */
  private t = 0;
  /** The glide is running. */
  private on = true;
  /** The weight when the glide was switched off (the fade-out runs from there). */
  private w0 = 0;
  /** The current weight (0 = the normal riding pose). */
  private w = 0;
  /** The torso lean (rad) that lifts the hand over the head — measured once per glide. */
  private lean = 0;
  private measured = false;
  /** The head's offset from the shoulder in the riding pose: (up, forward), the tallest seen. */
  private nh = 0;
  private nf = 0;
  private tracked = false;

  constructor(private readonly ps: PoseState, private readonly ride: RidePose) {}

  update(state: RiderState, out: CueOut, dt: number): void {
    const gliding = state.gliding && state.weapon === 'umbrella';
    if (gliding !== this.on) { this.on = gliding; this.t = 0; this.w0 = this.w; }
    else this.t += dt;
    this.w = gliding ? snap(this.t, TUNE.blend) : this.w0 * (1 - snap(this.t, TUNE.blendOut));
    if (this.w <= 1e-3) {
      this.measured = false;
      this.ride.armStretch = 1;
      this.trackNeutral();
      return;
    }
    if (!this.measured) { this.lean = this.measureLean(); this.measured = true; }
    // The umbrella arm reaches further than a normal grip does.
    this.ride.armStretch = TUNE.stretch / TUNE.baseStretch;
    out.spinePitch += this.lean * this.w;
    this.arm(out, this.w);
  }

  /** The arm's reach (m): the bone chain stretched to its limit. */
  private reach(): number {
    const [l1, l2] = chainLengths(this.ps, ARM.R);
    return (l1 + l2) * this.ride.armScale * TUNE.stretch;
  }

  /**
   * Remember how tall the head sits in the riding pose: the lean is measured from that, and a pose that
   * ducks the head (a superman fading out) must not be mistaken for it — the tallest head wins.
   */
  private trackNeutral(): void {
    const sh = this.ps.mp[B.armR] as Vector3;
    const head = this.ps.mp[B.head] as Vector3;
    const h = head.y - sh.y;
    if (!this.tracked || h > this.nh) {
      this.nh = h;
      this.nf = sh.z - head.z;
      this.tracked = true;
    }
  }

  /**
   * How far the torso must tip forward so the raised hand clears the head: the head rides at (h up, f
   * forward) of the shoulder and tips with the torso, so the head's height above the shoulder becomes
   * h·cos φ − f·sin φ.
   */
  private measureLean(): number {
    const h = this.nh, f = this.nf;
    const r = Math.hypot(h, f);
    if (r < 1e-3) return 0;
    const room = this.reach() * TUNE.reach * dirY() - TUNE.anchor - TUNE.clear;
    if (room >= r) return 0;
    const phi = Math.acos(clamp(room / r, -1, 1)) - Math.atan2(f, h);
    return clamp(phi, 0, TUNE.maxLean);
  }

  /** The umbrella arm: straight up from the shoulder, a little forward over the head. */
  private arm(out: CueOut, w: number): void {
    const sh = this.ps.mp[B.armR] as Vector3;
    dir.set(0.06, TUNE.up, -TUNE.fwd).normalize();
    target.copy(sh).addScaledVector(dir, this.reach() * TUNE.reach);
    pole.set(0.75, 0.05, -0.6);
    mergeArm(out.armR, target, pole, 0, w);
  }
}

/** The vertical part of the umbrella arm's direction. */
function dirY(): number {
  return dir.set(0.06, TUNE.up, -TUNE.fwd).normalize().y;
}
