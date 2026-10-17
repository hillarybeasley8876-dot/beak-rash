// RiderView: one rider on one bike. Composes the bike model (bikes unit), the skinned character
// (species kit), and the animation layers: ride (IK to bars/pedals) → cues → face; crash tumble.
import { Group, Matrix4, Quaternion, Vector3 } from 'three';
import type { AnchorName, AppContext, RiderView, ViewCue } from '../core/contracts';
import { clamp, damp } from '../core/math';
import { ROSTER } from '../data/roster';
import type { BikeId, CharacterId, Quality, RiderState, Side, WeaponId } from '../core/types';
import { createBike, type BikeModel } from './bikes';
import { CrashController } from './crash';
import { RiderExtras } from './extras';
import { createFallbackBike } from './fallback-bike';
import { nearest, registry } from './registry';
import { clearCue, makeCue } from './rig/cue-types';
import { CueSystem } from './rig/cues';
import { FaceRig } from './rig/face';
import { PoseState } from './rig/pose-state';
import { RidePose, type RideInput } from './rig/ride';
import { B } from './rig/skeleton';
import { instantiate, type CharacterInstance } from './species';

export interface ViewOpts { isPlayer: boolean; quality: Quality }

const tmp = new Vector3(), tmp2 = new Vector3(), mInv = new Matrix4(), FWD = new Vector3(0, 0, -1);

function safeBike(id: BikeId, quality: Quality, tint: string | undefined): BikeModel {
  try {
    return createBike(id, { quality, tint });
  } catch (err) {
    console.error(`[actors] createBike(${id}) failed, using the fallback bike`, err);
    return createFallbackBike(id, tint);
  }
}

export class RiderViewImpl implements RiderView {
  readonly root = new Group();
  readonly bike: BikeModel;
  readonly body = new Group();
  readonly inst: CharacterInstance;
  readonly ps: PoseState;
  readonly ride: RidePose;
  readonly face: FaceRig;
  readonly cueOut = makeCue();
  readonly cues: CueSystem;
  readonly extras: RiderExtras;
  readonly crash: CrashController;
  /** Bike markers in character space + motion inputs of the last update (read by tests). */
  readonly input: RideInput = {
    gripL: new Vector3(), gripR: new Vector3(), pedalL: new Vector3(), pedalR: new Vector3(),
    speed: 0, lean: 0, accel: 0, slope: 0, boost: 0, draft: 0, airborne: false, look: null,
  };
  private readonly look = new Vector3();
  private lookUntil = 0;
  private lookId = -1;
  private fitted = false;
  private prevSpeed = 0;
  private steer = 0;
  private clock = 0;
  private id = -1;
  private seed: number;
  private disposed = false;

  constructor(private readonly app: AppContext, readonly character: CharacterId, bikeId: BikeId, readonly opts: ViewOpts) {
    this.root.name = `rider:${character}`;
    const tint = opts.isPlayer ? undefined : ROSTER[character].colors.accent;
    this.bike = safeBike(bikeId, opts.quality, tint);
    this.bike.root.updateMatrixWorld(true);
    const saddle = this.bike.markers.saddle.getWorldPosition(new Vector3());
    this.bike.root.position.set(-saddle.x, 0, -saddle.z);
    this.body.position.set(0, saddle.y, 0);
    this.inst = instantiate(character, opts.quality);
    this.body.add(this.inst.mesh);
    this.root.add(this.bike.root, this.body);
    this.ps = new PoseState(this.inst.rig);
    this.ride = new RidePose(this.ps, this.inst.def);
    this.cues = new CueSystem(this.inst.def);
    this.extras = new RiderExtras(this.inst, this.body);
    this.seed = (character.length * 977 + (opts.isPlayer ? 13 : 71)) % 1000 / 1000;
    const rand = (): number => {
      this.seed = (this.seed * 9301 + 0.49297) % 1;
      return this.seed;
    };
    this.face = new FaceRig(this.ps, this.inst.def, rand);
    this.crash = new CrashController({
      root: this.root, body: this.body, mesh: this.inst.mesh, bike: this.bike, bikeHome: this.bike.root.position.clone(), ps: this.ps,
    }, rand);
  }

  /** Bike markers → character space (call after the bike has been updated this frame). */
  private readMarkers(): void {
    const parent = this.root.parent;
    this.root.updateMatrix();
    if (parent) this.root.matrixWorld.multiplyMatrices(parent.matrixWorld, this.root.matrix);
    else this.root.matrixWorld.copy(this.root.matrix);
    this.bike.root.updateMatrixWorld(true);
    this.body.updateMatrix();
    this.body.matrixWorld.multiplyMatrices(this.root.matrixWorld, this.body.matrix);
    mInv.copy(this.body.matrixWorld).invert();
    const mk = this.bike.markers, inp = this.input;
    inp.gripL.setFromMatrixPosition(mk.gripL.matrixWorld).applyMatrix4(mInv);
    inp.gripR.setFromMatrixPosition(mk.gripR.matrixWorld).applyMatrix4(mInv);
    inp.pedalL.setFromMatrixPosition(mk.pedalL.matrixWorld).applyMatrix4(mInv);
    inp.pedalR.setFromMatrixPosition(mk.pedalR.matrixWorld).applyMatrix4(mInv);
  }

  update(state: RiderState, pos: Vector3, quat: Quaternion, dtSim: number, dtReal: number): void {
    if (this.disposed) return;
    void dtReal;
    this.id = state.id;
    this.clock += dtSim;
    this.root.position.copy(pos);
    this.root.quaternion.copy(quat);
    this.root.visible = this.visibleFor(state);
    if (state.mode === 'crashed' && state.crash) {
      this.updateCrash(state, pos, quat, dtSim);
      return;
    }
    if (this.crash.active) this.crash.stop();
    const steerTarget = clamp(state.lean * 0.45 + state.yaw * 0.7, -0.5, 0.5) * (1 - clamp(state.speed / 30, 0, 0.6));
    this.steer = damp(this.steer, steerTarget, 10, dtSim);
    this.bike.update(dtSim, state.speed, this.steer);
    this.readMarkers();
    const inp = this.input;
    if (!this.fitted) {
      this.ride.fit(inp);
      this.fitted = true;
    }
    if (dtSim > 1e-5) inp.accel = damp(inp.accel, clamp((state.speed - this.prevSpeed) / dtSim, -15, 15), 6, dtSim);
    this.prevSpeed = state.speed;
    inp.speed = state.speed;
    inp.lean = state.lean;
    inp.airborne = state.airborne;
    inp.draft = state.draft;
    inp.boost = state.boostTime > 0 ? 1 : 0;
    inp.slope = tmp.copy(FWD).applyQuaternion(quat).y;
    inp.look = this.chooseLook(state);
    clearCue(this.cueOut);
    this.cues.update(state, this.cueOut, dtSim);
    this.ride.update(inp, this.cueOut, dtSim);
    const stunned = state.statuses.some((s) => s.id === 'stun');
    this.face.update(this.cueOut, inp.look, stunned, dtSim);
    this.ps.apply();
    const sq = clamp(this.cueOut.squash, -0.35, 0.45);
    this.inst.mesh.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    this.inst.mesh.updateMatrix();
    this.extras.update(state, this.cues, this.ps, this.inst.mesh.matrix, stunned, dtSim);
    this.register(state);
  }

  private updateCrash(state: RiderState, pos: Vector3, quat: Quaternion, dtSim: number): void {
    if (!this.crash.isCurrent(state)) {
      this.crash.start(state);
      this.cues.clear();
    }
    this.inst.mesh.scale.set(1, 1, 1);
    clearCue(this.cueOut);
    const { resting } = this.crash.update(pos, quat, this.cueOut, dtSim);
    this.face.update(this.cueOut, null, resting, dtSim);
    this.ps.apply();
    this.inst.mesh.updateMatrix();
    this.extras.update(state, this.cues, this.ps, this.inst.mesh.matrix, resting, dtSim);
    this.register(state);
  }

  private visibleFor(state: RiderState): boolean {
    if (state.mods.invisible) return Math.floor(this.clock * 30) % 7 === 0;
    if (state.mode === 'respawning') return Math.floor(state.modeTime * 16) % 2 === 0;
    if (state.invuln > 0) return Math.floor(state.invuln * 12) % 4 !== 0;
    return true;
  }

  /** Glance at the rival we're swinging at, else now and then at whoever rides close. */
  private chooseLook(state: RiderState): Vector3 | null {
    const head = this.anchor('head', tmp2);
    const fwd = tmp.copy(FWD).applyQuaternion(this.root.quaternion);
    const act = state.action;
    if (act && (act.kind === 'attack' || act.kind === 'heavy')) {
      const right = new Vector3(1, 0, 0).applyQuaternion(this.root.quaternion).multiplyScalar(act.side);
      const r = nearest(this.app, state.id, head, 4.5, (o) => o.dot(right) > 0.2);
      this.look.copy(r ? r.pos : head.clone().addScaledVector(right, 1.6).addScaledVector(fwd, 0.6));
      return this.look.applyMatrix4(mInv);
    }
    if (this.clock > this.lookUntil + 1.5) {
      const r = nearest(this.app, state.id, head, 7, (o) => o.dot(fwd) > -1.5);
      this.lookId = r ? r.id : -1;
      this.lookUntil = this.clock + 1.2 + (r ? (r.id % 3) * 0.4 : 0);
    }
    const target = this.lookId >= 0 && this.clock < this.lookUntil ? registry(this.app).get(this.lookId) : undefined;
    if (!target) return null;
    return this.look.copy(target.pos).applyMatrix4(mInv);
  }

  private register(state: RiderState): void {
    const reg = registry(this.app);
    const e = reg.get(state.id) ?? { id: state.id, pos: new Vector3(), body: new Vector3(), mode: state.mode, visible: true };
    this.anchor('head', e.pos);
    this.anchor('body', e.body);
    e.mode = state.mode;
    e.visible = this.root.visible && !state.mods.invisible;
    reg.set(state.id, e);
  }

  /** World point of a bone (+ optional bind-space offset from the bone). */
  private bonePoint(i: number, out: Vector3, offset?: Vector3): Vector3 {
    out.copy(this.ps.mp[i] as Vector3);
    if (offset) out.add(tmp.copy(offset).applyQuaternion(this.ps.mq[i] as Quaternion));
    this.inst.mesh.updateMatrix();
    return out.applyMatrix4(this.inst.mesh.matrix).applyMatrix4(this.body.matrixWorld);
  }

  anchor(name: AnchorName, out: Vector3): Vector3 {
    const meta = this.inst.def.meta;
    switch (name) {
      case 'head': return this.bonePoint(B.head, out, tmp2.set(0, 0.04, -0.03));
      case 'beak': return this.bonePoint(B.head, out, tmp2.set(meta.beak[0], meta.beak[1], meta.beak[2]).sub(this.ps.rest(B.head)));
      case 'chest': return this.bonePoint(B.chest, out);
      case 'handL': return this.bonePoint(B.handL, out);
      case 'handR': return this.bonePoint(B.handR, out);
      case 'body': return this.bonePoint(B.spine, out);
      case 'saddle': return out.setFromMatrixPosition(this.body.matrixWorld);
      case 'wheelF': case 'wheelR': {
        const z = (name === 'wheelF' ? -0.5 : 0.5) * this.bike.wheelbase;
        return out.set(0, this.bike.wheelRadius, z).applyMatrix4(this.bike.root.matrixWorld);
      }
      case 'bike': return out.setFromMatrixPosition(this.bike.root.matrixWorld);
      default: return out.setFromMatrixPosition(this.root.matrixWorld);
    }
  }

  cue(cue: ViewCue, opts?: { side?: Side; skillId?: string; weapon?: WeaponId; intensity?: number }): void {
    if (this.disposed) return;
    if (opts?.weapon) this.setWeapon(opts.weapon);
    this.cues.trigger(cue, opts?.side ?? 1, opts?.intensity ?? 1, opts?.skillId ?? null);
  }

  setWeapon(weapon: WeaponId): void {
    this.extras.weapon.set(weapon);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.id >= 0) registry(this.app).delete(this.id);
    this.root.removeFromParent();
    this.bike.dispose();
    this.extras.dispose();
    this.inst.rig.skeleton.dispose();
  }
}

/** Contract entry (core/contracts.ts → Modules.createRiderView). */
export function createRiderView(app: AppContext, character: CharacterId, bike: BikeId, opts: ViewOpts): RiderView {
  return new RiderViewImpl(app, character, bike, opts);
}
