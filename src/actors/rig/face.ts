// Face: blinking, sleepy/squint/wide lids, pupils that track a look target (and swirl when dizzy),
// brows that lift (surprise) or knit (anger). Works on the head-local bones of a PoseState.
import { Quaternion, Vector3 } from 'three';
import { clamp, damp, lerp } from '../../core/math';
import { lidAxis, vec } from '../kit/face';
import type { SpeciesDef } from '../species/types';
import type { CueOut } from './cue-types';
import type { PoseState } from './pose-state';
import { B, mirror } from './skeleton';

const q = new Quaternion(), qi = new Quaternion(), qt = new Quaternion();
const v = new Vector3(), d = new Vector3(), axisY = new Vector3(0, 1, 0), side = new Vector3();

interface EyeSide {
  s: -1 | 1; lid: number; eye: number; brow: number;
  centre: Vector3;   // sclera centre (character space, bind)
  pupil: Vector3;    // pupil rest (character space)
  dir: Vector3;      // bind look direction
  hinge: Vector3;    // lid hinge axis
}

export class FaceRig {
  private eyes: EyeSide[];
  private lid = 0;
  private blinkLeft = 0;
  private nextBlink = 1.5;
  private dizzy = 0;
  private t = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private saccade = 0;
  private sacYaw = 0;
  private sacPitch = 0;

  constructor(private readonly ps: PoseState, private readonly def: SpeciesDef, private readonly rand: () => number) {
    const J = def.joints, m = def.meta;
    this.eyes = ([-1, 1] as const).map((s) => {
      const L = s === -1;
      const dir = vec(L ? m.eyeDir : mirror(m.eyeDir)).normalize();
      const hinge = lidAxis(L ? m.eyeDir : mirror(m.eyeDir));
      return {
        s, lid: L ? B.lidL : B.lidR, eye: L ? B.eyeL : B.eyeR, brow: L ? B.browL : B.browR,
        centre: vec(L ? J.eye : mirror(J.eye)), pupil: vec(L ? J.pupil : mirror(J.pupil)), dir, hinge,
      };
    });
  }

  /** `look` in character space (null = ahead); `stunned` swirls the pupils. */
  update(cue: CueOut, look: Vector3 | null, stunned: boolean, dt: number): void {
    const ps = this.ps, m = this.def.meta;
    this.t += dt;
    this.nextBlink -= dt;
    const blinkTime = m.blinkTime ?? 0.13;
    if (this.nextBlink <= 0) {
      this.blinkLeft = blinkTime;
      this.nextBlink = blinkTime * 6 + 1 + this.rand() * 3.2 + (this.rand() < 0.2 ? -1.3 : 0);
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
    const blink = this.blinkLeft > 0 ? Math.sin((1 - this.blinkLeft / blinkTime) * Math.PI) : 0;
    const base = clamp(m.sleepy + cue.squint * 0.42 - cue.wide * 0.35, -0.3, 1);
    const target = Math.max(base, blink, cue.blink);
    this.lid = damp(this.lid, target, 30, dt);
    this.dizzy = damp(this.dizzy, stunned ? 1 : 0, 6, dt);
    const head = ps.mq[B.head] as Quaternion, headP = ps.mp[B.head] as Vector3;
    // Look angles relative to the head (shared by both eyes) with small idle saccades.
    let yaw = 0, pitch = 0;
    if (look) {
      d.subVectors(look, headP).applyQuaternion(qi.copy(head).invert());
      yaw = clamp(Math.atan2(-d.x, -d.z), -0.45, 0.45);
      pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.3, 0.3);
    }
    this.saccade -= dt;
    if (this.saccade <= 0) {
      this.saccade = 0.6 + this.rand() * 1.4;
      this.sacYaw = (this.rand() - 0.5) * 0.16;
      this.sacPitch = (this.rand() - 0.5) * 0.1;
    }
    yaw += this.sacYaw + (m.lookBias ?? 0);
    pitch += this.sacPitch;
    const swirl = this.dizzy;
    yaw = lerp(yaw, Math.cos(this.t * 9) * 0.32, swirl);
    pitch = lerp(pitch, Math.sin(this.t * 9) * 0.25, swirl);
    this.lookYaw = damp(this.lookYaw, yaw, 18, dt);
    this.lookPitch = damp(this.lookPitch, pitch, 18, dt);
    const ang = lerp(m.lid.open, m.lid.closed, clamp(this.lid, -0.3, 1));
    const pupilScale = 1 - cue.wide * 0.28 + cue.squint * 0.05;
    for (const e of this.eyes) {
      // Slanted lids: + tilt drops the inner corners (angry), − lifts them (worried); brows push it.
      const tilt = (m.lidTilt ?? 0) + cue.brow * 0.22;
      (ps.lq[e.lid] as Quaternion).setFromAxisAngle(e.dir, -e.s * tilt).multiply(qt.setFromAxisAngle(e.hinge, ang));
      side.crossVectors(axisY, e.dir).normalize();
      q.setFromAxisAngle(axisY, this.lookYaw).multiply(qi.setFromAxisAngle(side, -this.lookPitch));
      (ps.lq[e.eye] as Quaternion).copy(q);
      v.subVectors(e.pupil, e.centre).applyQuaternion(q).add(e.centre).sub(ps.rest(B.head));
      (ps.lp[e.eye] as Vector3).copy(v);
      ps.ls[e.eye] = pupilScale;
      const browLift = cue.wide * 0.012 - Math.max(0, cue.brow) * 0.006 + this.lid * 0.004;
      (ps.lp[e.brow] as Vector3).copy(ps.rig.restLocal[e.brow] as Vector3).y += browLift;
      (ps.lq[e.brow] as Quaternion).setFromAxisAngle(e.dir, -e.s * cue.brow * 0.38);
    }
  }
}
