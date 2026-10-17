// Track-frame orientation helper shared by combat visuals.
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { TrackFrame } from '../../../core/types';
import type { CombatCtx } from '../ctx';

const frame = {} as TrackFrame;
const basis = new Matrix4();
const right = new Vector3(), up = new Vector3(), back = new Vector3();

/** Orientation of the track frame at s: local X = right, Y = road normal, +Z = backwards. */
export function frameQuat(ctx: CombatCtx, s: number, out: Quaternion): Quaternion {
  ctx.session.track.frameAt(s, frame);
  right.set(frame.right.x, frame.right.y, frame.right.z);
  up.set(frame.up.x, frame.up.y, frame.up.z);
  back.set(-frame.tangent.x, -frame.tangent.y, -frame.tangent.z);
  return out.setFromRotationMatrix(basis.makeBasis(right, up, back));
}
