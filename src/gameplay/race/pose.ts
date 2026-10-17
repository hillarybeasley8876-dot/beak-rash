// Track-space → world pose for race-owned things (traffic, police bike). Models face −Z, +Y up.
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Track } from '../../core/contracts';
import type { TrackFrame } from '../../core/types';

const basis = new Matrix4();
const right = new Vector3();
const up = new Vector3();
const back = new Vector3();
const yawQ = new Quaternion();
const leanQ = new Quaternion();
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const frame = {} as TrackFrame;

/** World position + orientation at track (s, x, y) with heading `yaw` (+ = right) and `lean` (+ = right). */
export function trackPose(
  track: Track, s: number, x: number, y: number, yaw: number, lean: number, outPos: Vector3, outQuat: Quaternion,
): void {
  track.frameAt(s, frame);
  track.toWorld(s, x, y, outPos);
  right.set(frame.right.x, frame.right.y, frame.right.z);
  up.set(frame.up.x, frame.up.y, frame.up.z);
  back.set(-frame.tangent.x, -frame.tangent.y, -frame.tangent.z);
  basis.makeBasis(right, up, back);
  outQuat.setFromRotationMatrix(basis);
  if (yaw !== 0) outQuat.multiply(yawQ.setFromAxisAngle(Y, -yaw));
  if (lean !== 0) outQuat.multiply(leanQ.setFromAxisAngle(Z, -lean));
}
