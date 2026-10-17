// Model-space pose state for one rig: local rotations/positions/scales are written by the animation
// layers, `fk(i)` derives model-space transforms parent-first, and `apply()` pushes locals to bones.
import { Quaternion, Vector3 } from 'three';
import { BONE_COUNT, type Rig } from './skeleton';
import { toLocal } from './ik';

export class PoseState {
  readonly lq: Quaternion[] = [];   // local rotations
  readonly lp: Vector3[] = [];      // local positions
  readonly ls: number[] = [];       // uniform local scales
  /** Extra non-uniform scale for LEAF bones only (pouch, pupils). */
  readonly lsv: Vector3[] = [];
  readonly mq: Quaternion[] = [];   // model rotations
  readonly mp: Vector3[] = [];      // model positions
  readonly msc: number[] = [];      // model (accumulated) scales
  private tmp = new Vector3();

  constructor(readonly rig: Rig) {
    for (let i = 0; i < BONE_COUNT; i++) {
      this.lq.push(new Quaternion());
      this.lp.push((rig.restLocal[i] as Vector3).clone());
      this.ls.push(1);
      this.lsv.push(new Vector3(1, 1, 1));
      this.mq.push(new Quaternion());
      this.mp.push((rig.rest[i] as Vector3).clone());
      this.msc.push(1);
    }
  }

  /** Back to the bind pose (identity rotations, rest offsets, unit scale). */
  reset(): void {
    for (let i = 0; i < BONE_COUNT; i++) {
      (this.lq[i] as Quaternion).identity();
      (this.lp[i] as Vector3).copy(this.rig.restLocal[i] as Vector3);
      this.ls[i] = 1;
      (this.lsv[i] as Vector3).set(1, 1, 1);
    }
  }

  /** Model transform of bone i from its parent's (parent must be up to date). */
  fk(i: number): void {
    const p = this.rig.parent[i] ?? -1;
    const mq = this.mq[i] as Quaternion, mp = this.mp[i] as Vector3;
    if (p < 0) {
      mq.copy(this.lq[i] as Quaternion);
      mp.copy(this.lp[i] as Vector3);
      this.msc[i] = this.ls[i] ?? 1;
      return;
    }
    const pq = this.mq[p] as Quaternion, ps = this.msc[p] ?? 1;
    mp.copy(this.mp[p] as Vector3).add(this.tmp.copy(this.lp[i] as Vector3).multiplyScalar(ps).applyQuaternion(pq));
    mq.copy(pq).multiply(this.lq[i] as Quaternion);
    this.msc[i] = ps * (this.ls[i] ?? 1);
  }

  /** fk for a list of bones in order. */
  fkChain(bones: readonly number[]): void {
    for (const b of bones) this.fk(b);
  }

  /** Set bone i's model rotation (its parent's model rotation must be current); updates local + model. */
  setModelRot(i: number, q: Quaternion): void {
    const p = this.rig.parent[i] ?? -1;
    if (p < 0) (this.lq[i] as Quaternion).copy(q);
    else toLocal(this.mq[p] as Quaternion, q, this.lq[i] as Quaternion);
    this.fk(i);
  }

  /** Bind (rest) model position of bone i. */
  rest(i: number): Vector3 {
    return this.rig.rest[i] as Vector3;
  }

  /** Push local transforms to the three.js bones. */
  apply(): void {
    const bones = this.rig.bones;
    for (let i = 0; i < BONE_COUNT; i++) {
      const b = bones[i];
      if (!b) continue;
      b.quaternion.copy(this.lq[i] as Quaternion);
      b.position.copy(this.lp[i] as Vector3);
      const s = this.ls[i] ?? 1;
      b.scale.copy(this.lsv[i] as Vector3).multiplyScalar(s);
    }
  }
}
