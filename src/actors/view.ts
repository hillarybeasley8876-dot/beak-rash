// RiderView: one rider on one bike. Composes the bike model (bikes unit), the skinned character
// (species kit), and the animation layers: ride (IK to bars/pedals) → cues → face; crash tumble.
import { Color, Group, Matrix4, Quaternion, Vector3 } from 'three';
import type { AnchorName, AppContext, RiderView, RiderViewOpts, ViewCue } from '../core/contracts';
import { clamp, damp, lerp, smoothstep } from '../core/math';
import { ROSTER } from '../data/roster';
import type { BikeId, CharacterId, Quality, RiderId, RiderState, Side, WeaponId } from '../core/types';
import { createBike, type BikeModel } from './bikes';
import { CrashController } from './crash';
import { RiderFade } from './fade';
import { RiderExtras } from './extras';
import { PedalExtenders } from './extenders';
import { createFallbackBike } from './fallback-bike';
import { nearest, registry } from './registry';
import { gripPoint } from './rig/bar-fit';
import { clearCue, makeCue } from './rig/cue-types';
import { CueSystem } from './rig/cues';
import { FaceRig } from './rig/face';
import { IdleMotion } from './rig/idle';
import { PoseState } from './rig/pose-state';
import { RidePose, type RideInput } from './rig/ride';
import { B } from './rig/skeleton';
import { StateCues } from './rig/state-cues';
import { instantiate, type CharacterInstance } from './species';
import { ShaderWarmup } from './warmup';
import { RiderLod } from './lod';

/** Race-session views (with `track`) warm their shader variants in their first frames (warmup.ts). */
export type ViewOpts = RiderViewOpts;

const tmp = new Vector3(), tmp2 = new Vector3(), mInv = new Matrix4(), FWD = new Vector3(0, 0, -1);
const GHOST = new Color('#7fe8ff'), FLASH = new Color('#ffffff');
/** A point far down the road at eye height (character space). */
const AHEAD = new Vector3(0, 0.85, -12);

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
  readonly idle: IdleMotion;
  readonly cueOut = makeCue();
  readonly cues: CueSystem;
  readonly stateCues: StateCues;
  readonly extras: RiderExtras;
  readonly crash: CrashController;
  readonly fade: RiderFade;
  /** Toy rods from the pedals to the feet for short-legged species (corgi, penguin). */
  private readonly extenders: PedalExtenders | null;
  private readonly warm: ShaderWarmup | null;
  private readonly lod: RiderLod;
  private ghost = 0;
  /** Bike markers in character space + motion inputs of the last update (read by tests). */
  readonly input: RideInput = {
    gripL: new Vector3(), gripR: new Vector3(), pedalL: new Vector3(), pedalR: new Vector3(),
    speed: 0, lean: 0, accel: 0, slope: 0, boost: 0, draft: 0, airborne: false, look: null, bell: null, carry: 0,
  };
  /** Head carriage side target (meta.carry): toward the road centre, switching only well past it. */
  private carrySide = 1;
  private readonly bellPos = new Vector3();
  private readonly look = new Vector3();
  private lookUntil = 0;
  private lookId = -1;
  /** Solo glances (nobody near): next start, end and side. */
  private soloAt = 2.5;
  private soloUntil = 0;
  private soloSide: Side = 1;
  private fitted = false;
  private prevSpeed = 0;
  private steer = 0;
  private clock = 0;
  private id = -1;
  private seed: number;
  private disposed = false;
  /** A KO cinematic is running (its camera frames victims up close: no coverage fade then). */
  private cine = false;
  private readonly offCine: () => void;

  constructor(private readonly app: AppContext, readonly character: CharacterId, private readonly bikeId: BikeId, readonly opts: ViewOpts) {
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
    this.stateCues = new StateCues(app, this.cues, (): RiderId => this.id, (): Side => this.rivalSide());
    this.extras = new RiderExtras(this.inst, this.body);
    this.seed = (character.length * 977 + (opts.isPlayer ? 13 : 71)) % 1000 / 1000;
    const rand = (): number => {
      this.seed = (this.seed * 9301 + 0.49297) % 1;
      return this.seed;
    };
    this.face = new FaceRig(this.ps, this.inst.def, rand);
    this.idle = new IdleMotion(this.ps, this.inst.def, rand());
    this.extenders = this.inst.def.meta.shortLegs ? new PedalExtenders(this.body) : null;
    this.fade = new RiderFade(this.root);
    this.offCine = app.bus.on('cine:ko', (e) => {
      this.cine = e.phase !== 'end';
    });
    this.lod = new RiderLod(this.inst.mesh, this.inst.hull, this.bike);
    this.warm = opts.track ? new ShaderWarmup(this.root, this.inst.mesh, this.fade, this.extras, app.renderer.info) : null;
    this.crash = new CrashController({
      root: this.root, body: this.body, mesh: this.inst.mesh, bike: this.bike, bikeHome: this.bike.root.position.clone(), ps: this.ps,
      headScale: this.inst.def.meta.headScale ?? 1,
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
    for (const [m, side, out] of [[mk.gripL, -1, inp.gripL], [mk.gripR, 1, inp.gripR]] as const) {
      gripPoint(this.bikeId, side, m.position, out);
      if (m.parent) out.applyMatrix4(m.parent.matrixWorld);
      out.applyMatrix4(mInv);
    }
    inp.bell = mk.bell ? this.bellPos.setFromMatrixPosition(mk.bell.matrixWorld).applyMatrix4(mInv) : null;
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
    this.root.visible = !state.statuses.some((s) => s.id === 'gulped' && s.time > 0); // inside the pelican's pouch
    this.updateFade(state, dtSim);
    this.stateCues.update(state, dtSim);
    const crashed = state.mode === 'crashed' && state.crash !== null;
    if (crashed) this.updateCrash(state, pos, quat, dtSim);
    else this.updateRide(state, quat, dtSim);
    if (this.app.camera) this.lod.update(this.root, this.app.camera.position, crashed);
    this.warm?.update();
  }

  private updateRide(state: RiderState, quat: Quaternion, dtSim: number): void {
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
    if (state.x > 0.8) this.carrySide = 1;
    else if (state.x < -0.8) this.carrySide = -1;
    inp.carry = damp(inp.carry, this.carrySide, 2.5, dtSim);
    clearCue(this.cueOut);
    this.cues.update(state, this.cueOut, dtSim);
    const sq = clamp(this.cueOut.squash, -0.35, 0.45);
    this.ride.squashTo(1 + sq * 0.5, 1 - sq);
    this.ride.update(inp, this.cueOut, dtSim);
    this.idle.update(inp.speed, inp.accel, dtSim);
    const stunned = state.statuses.some((s) => s.id === 'stun');
    // A carried head (meta.carry) keeps its eyes on the road: side-eye down the bill.
    this.face.update(this.cueOut, inp.look ?? (this.inst.def.meta.carry ? AHEAD : null), stunned, dtSim);
    this.ps.apply();
    this.inst.mesh.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    this.inst.mesh.updateMatrix();
    this.extras.update(state, this.cues, this.ps, this.inst.mesh.matrix, stunned, this.cueOut, dtSim);
    if (this.extenders) {
      const m = this.inst.mesh.matrix, lift = this.inst.def.meta.ankleLift[1];
      tmp.copy(this.ps.mp[B.footL] as Vector3).applyMatrix4(m).setY(tmp.y - lift);
      tmp2.copy(this.ps.mp[B.footR] as Vector3).applyMatrix4(m).setY(tmp2.y - lift);
      this.extenders.update(inp.pedalL, inp.pedalR, tmp, tmp2);
    }
    this.register(state);
  }

  private updateCrash(state: RiderState, pos: Vector3, quat: Quaternion, dtSim: number): void {
    if (!this.crash.isCurrent(state)) {
      this.crash.start(state);
      this.cues.clear();
    }
    this.inst.mesh.scale.set(1, 1, 1);
    clearCue(this.cueOut);
    const { resting } = this.crash.update(pos, quat, state.y, this.cueOut, dtSim);
    this.face.update(this.cueOut, null, resting, dtSim);
    this.ps.apply();
    this.inst.mesh.updateMatrix();
    this.extras.update(state, this.cues, this.ps, this.inst.mesh.matrix, resting, this.cueOut, dtSim);
    this.register(state);
  }

  /** Opacity beats: the pigeon ghost fades to a cyan wisp, a respawn materialises out of a white flash and
   *  invulnerability pulses softly (no hard whole-rider blinking). */
  private updateFade(state: RiderState, dt: number): void {
    this.ghost = damp(this.ghost, state.mods.invisible ? 1 : 0, 12, dt);
    let alpha = 1, glow = 0;
    if (state.mode === 'respawning') {
      const k = smoothstep(0, 0.6, state.modeTime);
      alpha = 0.2 + 0.8 * k;
      glow = 0.9 * (1 - k);
    } else if (state.invuln > 0) {
      // Soft pulse that never crosses the opaque swap (0.995), easing to opaque over the last 0.25 s.
      alpha = lerp(0.7 + 0.25 * (0.5 + 0.5 * Math.cos(state.invuln * 13)), 1, smoothstep(0.25, 0, state.invuln));
    } else if (state.mode === 'crashed' && this.crash.active) {
      alpha = this.nearCameraAlpha();
    }
    if (this.ghost > 0.01) {
      this.fade.set(lerp(alpha, 0.2, this.ghost), GHOST, 0.55 * this.ghost, 0.45 * this.ghost);
      return;
    }
    this.fade.set(alpha, FLASH, glow * 0.6, glow);
  }

  /** A tumbling body or bike that the chase camera overtakes fades out instead of filling the frame: always within
   *  1.9 m, and outside a KO cinematic (which frames the victim up close on purpose) once it would cover more than
   *  ~1/5 of the screen height within 3.5 m. */
  private nearCameraAlpha(): number {
    const cam = this.app.camera;
    if (!cam) return 1;
    const d = Math.min(cam.position.distanceTo(this.crash.bodyRB.p), cam.position.distanceTo(this.crash.bikeRB.p));
    const near = smoothstep(0.7, 1.9, d);
    if (this.cine || d > 3.5) return 0.12 + 0.88 * near;
    const cover = 0.6 / (Math.max(d, 0.1) * Math.tan((cam.fov * Math.PI) / 360));
    return 0.12 + 0.88 * Math.min(near, 1 - smoothstep(0.28, 0.5, cover));
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
    if (target) return this.look.copy(target.pos).applyMatrix4(mInv);
    return this.soloGlance();
  }

  /** No one to look at: every 4–7 s (the hero: 2.6–3.8 s, also between looks in a pack) a 0.5–0.8 s glance 30–40° to
   *  alternating sides (the sea, a billboard), so the hero's bill sweeps across the head outline from the chase cam. */
  private soloGlance(): Vector3 | null {
    if (this.clock >= this.soloAt) {
      const r = (this.seed * 7.31 + this.clock * 0.618) % 1;
      this.soloSide = this.soloSide === 1 ? -1 : 1;
      this.soloUntil = this.clock + 0.5 + 0.3 * r;
      const [gap, span] = this.inst.def.meta.carry ? [2.6, 1.2] : [4, 3];
      this.soloAt = this.soloUntil + gap + span * ((r * 3.7) % 1);
    }
    if (this.clock >= this.soloUntil) return null;
    const yaw = (0.52 + 0.17 * ((this.soloAt * 0.37) % 1)) * this.soloSide;
    return this.look.set(-Math.sin(yaw) * 6, 0.5, -Math.cos(yaw) * 6);
  }

  /** Side of the nearest rival within 12 m (taunt gesture direction); right when alone. */
  private rivalSide(): Side {
    const head = this.anchor('head', tmp2);
    const r = nearest(this.app, this.id, head, 12, () => true);
    if (!r) return 1;
    return tmp.subVectors(r.body, head).dot(new Vector3(1, 0, 0).applyQuaternion(this.root.quaternion)) < 0 ? -1 : 1;
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
    this.stateCues.dispose();
    this.offCine();
    this.fade.dispose();
    this.extenders?.dispose();
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
