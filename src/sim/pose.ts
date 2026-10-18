// World pose of a rider's bike: contact point under the saddle, oriented by the road frame (slope pitch +
// bank), then yaw about the road normal, visual pitch (air / ramps), and lean about the bike's own
// forward axis. Beyond the road's ends (start, finish + run-off) it extrapolates along the end tangents.
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Track } from '../core/contracts';
import type { RiderState, TrackFrame } from '../core/types';
import { emptyFrame, trackEnd } from './state';

const AX_X = new Vector3(1, 0, 0);
const AX_Y = new Vector3(0, 1, 0);
const AX_Z = new Vector3(0, 0, 1);

export class Poser {
  private m = new Matrix4();
  private t = new Vector3();
  private u = new Vector3();
  private rt = new Vector3();
  private q = new Quaternion();
  private fr: TrackFrame = emptyFrame();

  constructor(private track: Track) {}

  /** Track-space point → world, extrapolating past either end. Returns the frame used. */
  place(s: number, x: number, y: number, out: Vector3): TrackFrame {
    const len = trackEnd(this.track);
    const sc = Math.min(Math.max(s, 0), len);
    const fr = this.track.frameAt(sc, this.fr);
    this.track.toWorld(sc, x, y, out);
    const over = s - sc;
    if (over !== 0) out.set(out.x + fr.tangent.x * over, out.y + fr.tangent.y * over, out.z + fr.tangent.z * over);
    return fr;
  }

  pose(r: RiderState, pitch: number, outPos: Vector3, outQuat: Quaternion): void {
    const fr = this.place(r.s, r.x, r.y, outPos);
    // Gram-Schmidt so a slightly skewed frame can never shear the model.
    this.t.set(fr.tangent.x, fr.tangent.y, fr.tangent.z).normalize();
    this.rt.set(fr.right.x, fr.right.y, fr.right.z);
    this.rt.addScaledVector(this.t, -this.rt.dot(this.t)).normalize();
    this.u.crossVectors(this.rt, this.t).normalize();
    // Basis: +X right, +Y up, −Z forward (models face −Z).
    this.m.makeBasis(this.rt, this.u, this.t.negate());
    outQuat.setFromRotationMatrix(this.m);
    outQuat.multiply(this.q.setFromAxisAngle(AX_Y, -r.yaw));
    if (pitch !== 0) outQuat.multiply(this.q.setFromAxisAngle(AX_X, pitch));
    outQuat.multiply(this.q.setFromAxisAngle(AX_Z, -r.lean));
  }
}
