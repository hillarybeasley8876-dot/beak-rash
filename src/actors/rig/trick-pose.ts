// The superman (SPEC §16): the rider lets go of the bars and flies flat over the bike — the hips off the
// saddle, the torso horizontal, both wings stretched forward and out, the legs trailing back. The pose
// blends in and out over ~0.12 s so the trick never pops, and it only lives in the cue layer: the trick
// rotation of the whole bike is trick-pivot.ts. The flips tuck (the rider curls into the rotation) and the
// spin spreads the wings — both weighted by the rotation's progress, so they start and end at rest.
import { Vector3 } from 'three';
import { clamp01, smoothstep } from '../../core/math';
import type { RiderState, Side } from '../../core/types';
import { snap } from './cue-math';
import { mergeArm, type CueOut } from './cue-types';
import type { PoseState } from './pose-state';
import { B } from './skeleton';

const TUNE = {
  blend: 0.12,   // s, the blend in and out
  lift: 0.46,    // m, the hips off the saddle
  lie: 1,        // the torso flattens toward horizontal
  pitch: 0.8,    // rad, the extra spine pitch on top of the lie
  armOut: 0.2,   // m, the wings out from the shoulders
  armUp: 0.05,   // m, the wings a little above the shoulders
  armFwd: 0.38,  // m, the wings stretched ahead of the rider
  tuck: 0.9,     // 0..1 the feet leave the pedals and trail back
  flipTuck: 0.55,// 0..1 the feet leave the pedals during a flip
  flipPitch: 0.3,// rad, the rider curls into the flip (back: negative)
  spinWings: 0.5,// 0..1 the wings spread during a spin
};

const target = new Vector3();
const pole = new Vector3();

export class TrickPose {
  /** Seconds since the superman started (or ended). */
  private t = 0;
  /** The pose is active (the superman is running). */
  private on = true;
  /** The weight when the pose was switched off (the fade-out runs from there). */
  private w0 = 0;
  /** The current weight (0 = the normal riding pose). */
  private w = 0;

  constructor(private readonly ps: PoseState) {}

  update(state: RiderState, out: CueOut, dt: number): void {
    const trick = state.trick;
    const sup = trick?.kind === 'superman';
    if (sup !== this.on) { this.on = sup; this.t = 0; this.w0 = this.w; }
    else this.t += dt;
    this.w = sup ? snap(this.t, TUNE.blend) : this.w0 * (1 - snap(this.t, TUNE.blend));
    if (this.w > 1e-3) {
      out.lift += TUNE.lift * this.w;
      out.lie += TUNE.lie * this.w;
      out.spinePitch += TUNE.pitch * this.w;
      out.legTuck += TUNE.tuck * this.w;
      this.arm(out, -1, this.w);
      this.arm(out, 1, this.w);
    }
    if (!trick || trick.kind === 'superman') return;
    // The rotation: the rider curls into a flip, a spin spreads the wings. Both fade with the rotation, and
    // they are gone again before the landing (the sim may snap a nearly finished trick).
    const p = clamp01(trick.t / Math.max(trick.dur, 1e-3));
    const k = Math.sin(Math.PI * p) * (1 - smoothstep(0.6, 0.95, p));
    if (trick.kind === 'spin') {
      out.wings += TUNE.spinWings * k;
    } else {
      out.legTuck += TUNE.flipTuck * k;
      out.spinePitch += (trick.kind === 'frontflip' ? TUNE.flipPitch : -TUNE.flipPitch) * k;
    }
  }

  /** One wing: from the animated shoulder, forward and out (the rider is no longer holding the bars). */
  private arm(out: CueOut, side: Side, w: number): void {
    const sh = this.ps.mp[side === -1 ? B.armL : B.armR] as Vector3;
    target.set(sh.x + TUNE.armOut * side, sh.y + TUNE.armUp, sh.z - TUNE.armFwd);
    pole.set(side * 0.7, -0.5, 0.2);
    mergeArm(side === -1 ? out.armL : out.armR, target, pole, 0, w);
  }
}
