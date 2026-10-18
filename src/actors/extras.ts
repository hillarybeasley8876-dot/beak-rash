// Per-rider extras around the body: the held weapon, the swing smear, the dizzy stars, the glint and steam beats.
// Everything lives in the rider's body space (moves with the bike, not left behind at speed).
import { Matrix4, Quaternion, Vector3, type Group } from 'three';
import { smoothstep } from '../core/math';
import type { RiderState, Side } from '../core/types';
import { DizzyStars, Glint } from './local-fx';
import { SwingSmear } from './smear';
import { SteamPuffs } from './steam';
import type { CueSystem } from './rig/cues';
import type { PoseState } from './rig/pose-state';
import { aimQuat } from './rig/ik';
import { B } from './rig/skeleton';
import type { CharacterInstance } from './species';
import { WeaponHolder } from './weapons';

const base = new Vector3(), tip = new Vector3(), head = new Vector3(), dir = new Vector3(), sc = new Vector3();
const pA = new Vector3(), pB = new Vector3(), qA = new Quaternion(), qB = new Quaternion(), qL = new Quaternion();
const meshQ = new Quaternion(), mTmp = new Matrix4();
const LENS = new Vector3(0, 0.005, -0.06);
/** Seconds to hand the weapon across: to the swinging hand within its wind-up (light / heavy) / toward a rival while riding. */
const PASS = 0.1, PASS_HEAVY = 0.16, PASS_IDLE = 0.4;
/** Orientation the weapon passes through on a toss (body space: pointing forward-down over the bars, far from the face). */
const Q_PASS = aimQuat(new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(0, -0.45, -0.89).normalize(), new Vector3(0, 0.89, -0.45), new Quaternion());

export class RiderExtras {
  readonly weapon: WeaponHolder;
  readonly stars = new DizzyStars();
  readonly smear = new SwingSmear();
  readonly glint = new Glint();
  readonly steam = new SteamPuffs();
  private readonly fore: Vector3;
  private strike = 0;
  /** An off-side swing tosses the weapon across in a small arc instead of teleporting it between hands. */
  private pass: { from: Side; to: Side; t: number; dur: number } | null = null;

  constructor(inst: CharacterInstance, private readonly body: Group) {
    const J = inst.def.joints;
    const fore = new Vector3(J.wrist[0] - J.elbow[0], J.wrist[1] - J.elbow[1], J.wrist[2] - J.elbow[2]).normalize();
    const bones = inst.rig.bones;
    const l = bones[B.handL], r = bones[B.handR];
    if (!l || !r) throw new Error('[actors] rig is missing hand bones');
    this.fore = fore;
    this.weapon = new WeaponHolder([l, r], fore, 0.02);
    body.add(this.stars.group, this.smear.mesh, this.glint.sprite, this.steam.group);
  }

  /** Weapon pivot pose in body space when held by the `side` hand (also its local orientation in `qL`). */
  private handPose(side: Side, ps: PoseState, meshMatrix: Matrix4, outP: Vector3, outQ: Quaternion, strike = this.strike): void {
    const bone = side === -1 ? B.handL : B.handR, hq = ps.mq[bone] as Quaternion;
    dir.copy(this.fore).setX(this.fore.x * -side).applyQuaternion(hq);
    this.weapon.orient(side, hq, dir, strike, qL);
    this.weapon.gripOffset(side, outP).applyQuaternion(hq).add(ps.mp[bone] as Vector3).applyMatrix4(meshMatrix);
    outQ.copy(meshQ).multiply(hq).multiply(qL);
  }

  /** Hold or hand across the weapon; leaves the pivot's body-space pose in pA/qA (for the smear). An off-side swing
   *  tosses it across in 0.1 s; while riding it moves over (0.4 s) to the side a rival rides on (`prefer`). */
  private updateWeapon(cues: CueSystem, ps: PoseState, meshMatrix: Matrix4, prefer: Side | null, dt: number): void {
    const st = cues.strikeState, w = this.weapon;
    this.strike += (st.weight - this.strike) * (1 - Math.exp(-(st.weight > this.strike ? 22 : 9) * dt));
    mTmp.copy(meshMatrix).decompose(pB, meshQ, sc);
    const want = st.weight > 0 ? st.side : prefer ?? w.hand;
    if (!this.pass && want !== w.hand) {
      if (w.armed) this.pass = { from: w.hand, to: want, t: 0, dur: st.weight > 0 ? (st.heavy ? PASS_HEAVY : PASS) : PASS_IDLE };
      else w.attach(want);
    }
    const pass = this.pass;
    if (pass) pass.t += dt / pass.dur;
    if (!pass || pass.t >= 1) {
      if (pass) w.attach(pass.to);
      this.pass = null;
      this.handPose(w.hand, ps, meshMatrix, pA, qA);
      w.aim(ps.mq[w.hand === -1 ? B.handL : B.handR] as Quaternion, dir, this.strike);
      return;
    }
    // Toss: the grip slides across over the bars while the weapon dips forward-down through Q_PASS (never the face).
    const k = smoothstep(0, 1, pass.t);
    this.handPose(pass.from, ps, meshMatrix, pA, qA, 0);
    this.handPose(pass.to, ps, meshMatrix, pB, qB);
    pA.lerp(pB, k).y -= 0.05 * Math.sin(Math.PI * k);
    if (k < 0.5) qA.slerp(Q_PASS, k * 2);
    else qA.copy(Q_PASS).slerp(qB, k * 2 - 1);
    w.carry(this.body, pass.to, pA, qA);
  }

  /** `fx` = this frame's glint/steam beats from the cue layer. */
  update(state: RiderState, cues: CueSystem, ps: PoseState, meshMatrix: Matrix4, stunned: boolean, fx: { glint: number; steam: number },
    dt: number, prefer: Side | null = null): void {
    if (state.weapon !== this.weapon.current) this.weapon.set(state.weapon);
    this.updateWeapon(cues, ps, meshMatrix, prefer, dt);
    tip.set(0, this.weapon.length, 0).applyQuaternion(qA).add(pA);
    base.copy(pA).lerp(tip, 0.35);
    this.smear.update(base, tip, cues.strikeState.active, dt);
    head.copy(ps.mp[B.head] as Vector3).applyMatrix4(meshMatrix);
    this.stars.update(head, stunned, dt);
    this.steam.update(head, fx.steam, dt);
    if (fx.glint > 0.02) head.copy(LENS).applyQuaternion(ps.mq[B.head] as Quaternion).add(ps.mp[B.eyeR] as Vector3).applyMatrix4(meshMatrix);
    this.glint.update(head, fx.glint, dt);
  }

  dispose(): void {
    this.weapon.dispose();
    this.smear.dispose();
    this.glint.dispose();
    this.steam.dispose();
    this.body.remove(this.stars.group, this.smear.mesh, this.glint.sprite, this.steam.group);
  }
}
