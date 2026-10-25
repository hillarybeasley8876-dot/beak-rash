// The throw aim (SPEC §15): the weapon hand cocks the weapon back over the shoulder and holds it there for
// as long as the heavy button is held (RiderAction kind 'throw'). The other wing keeps the bars. When the
// action ends the weapon left the hand, so the arm plays a short forward sweep before it returns to riding.
import { Vector3 } from 'three';
import { clamp01, lerp, smoothstep } from '../../core/math';
import type { RiderState, Side } from '../../core/types';
import { snap } from './cue-math';
import { mergeArm, type CueOut } from './cue-types';
import type { PoseState } from './pose-state';
import { B } from './skeleton';

const TUNE = {
  blendIn: 0.08,  // s, the arm swings up to the cocked pose
  follow: 0.16,   // s, the follow-through sweep after the release
  out: 0.06,      // m, the cocked hand out from the shoulder
  up: 0.3,        // m, the cocked hand above the shoulder
  back: 0.2,      // m, the cocked hand behind the shoulder
  relOut: 0.1,    // m, the release sweep (forward and down)
  relUp: -0.2,
  relFwd: 0.4,
};

const target = new Vector3();
const pole = new Vector3();

export class ThrowPose {
  /** Seconds since the throw action started. */
  private t = 0;
  /** The throw action is running. */
  private live = false;
  /** The action ended: the arm plays the follow-through. */
  private releasing = false;
  /** Seconds since the release. */
  private relT = 0;
  /** The first frame after the release (the arm is still cocked). */
  private relFirst = false;
  private side: Side = 1;

  constructor(private readonly ps: PoseState) {}

  update(state: RiderState, out: CueOut, dt: number): void {
    const act = state.action;
    if (act && act.kind === 'throw') {
      const fresh = !this.live || this.side !== act.side;
      if (fresh) { this.side = act.side; this.t = 0; }
      this.live = true;
      this.releasing = false;
      if (!fresh) this.t += dt;
      this.arm(out, this.side, snap(this.t, TUNE.blendIn), 0);
      return;
    }
    if (this.live) { this.live = false; this.releasing = true; this.relT = 0; this.relFirst = true; }
    if (!this.releasing) return;
    if (this.relFirst) this.relFirst = false;
    else this.relT += dt;
    const k = clamp01(this.relT / TUNE.follow);
    const w = Math.pow(1 - k, 3); // the arm comes back to the bars
    if (w <= 1e-3) { this.releasing = false; return; }
    this.arm(out, this.side, w, smoothstep(0, 0.45, k));
  }

  /** The weapon hand: `sweep` 0 = cocked over the shoulder, 1 = the release sweep (forward and down). */
  private arm(out: CueOut, side: Side, w: number, sweep: number): void {
    const sh = this.ps.mp[side === -1 ? B.armL : B.armR] as Vector3;
    const outX = lerp(TUNE.out, TUNE.relOut, sweep);
    const up = lerp(TUNE.up, TUNE.relUp, sweep);
    const back = lerp(TUNE.back, -TUNE.relFwd, sweep);
    target.set(sh.x + outX * side, sh.y + up, sh.z + back);
    pole.set(side * 0.5, 0.6, -0.3);
    mergeArm(side === -1 ? out.armL : out.armR, target, pole, 0, w);
  }
}
