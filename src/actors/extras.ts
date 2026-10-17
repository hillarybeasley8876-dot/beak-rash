// Per-rider extras around the body: the held weapon, the swing smear and the dizzy stars.
// Everything lives in the rider's body space (moves with the bike, not left behind at speed).
import { Quaternion, Vector3, type Group, type Matrix4 } from 'three';
import type { RiderState } from '../core/types';
import { DizzyStars, SwingSmear } from './local-fx';
import type { CueSystem } from './rig/cues';
import type { PoseState } from './rig/pose-state';
import { B } from './rig/skeleton';
import type { CharacterInstance } from './species';
import { WeaponHolder } from './weapons';

const base = new Vector3(), tip = new Vector3(), head = new Vector3();

export class RiderExtras {
  readonly weapon: WeaponHolder;
  readonly stars = new DizzyStars();
  readonly smear = new SwingSmear();

  constructor(inst: CharacterInstance, private readonly body: Group) {
    const J = inst.def.joints;
    const fore = new Vector3(J.wrist[0] - J.elbow[0], J.wrist[1] - J.elbow[1], J.wrist[2] - J.elbow[2]).normalize();
    const bones = inst.rig.bones;
    const l = bones[B.handL], r = bones[B.handR];
    if (!l || !r) throw new Error('[actors] rig is missing hand bones');
    this.weapon = new WeaponHolder([l, r], fore, 0.02);
    body.add(this.stars.group, this.smear.mesh);
  }

  update(state: RiderState, cues: CueSystem, ps: PoseState, meshMatrix: Matrix4, stunned: boolean, dt: number): void {
    if (state.weapon !== this.weapon.current) this.weapon.set(state.weapon);
    const st = cues.strikeState;
    if (st.weight > 0 && st.side !== this.weapon.hand) this.weapon.attach(st.side);
    const hand = this.weapon.hand === -1 ? B.handL : B.handR;
    const hq = ps.mq[hand] as Quaternion;
    base.copy(ps.mp[hand] as Vector3);
    tip.copy(this.weapon.tipLocal(tip)).applyQuaternion(hq).add(base);
    base.lerp(tip, 0.35);
    base.applyMatrix4(meshMatrix);
    tip.applyMatrix4(meshMatrix);
    this.smear.update(base, tip, st.active, dt);
    head.copy(ps.mp[B.head] as Vector3).applyMatrix4(meshMatrix);
    this.stars.update(head, stunned, dt);
  }

  dispose(): void {
    this.weapon.dispose();
    this.smear.dispose();
    this.body.remove(this.stars.group, this.smear.mesh);
  }
}
