// System interfaces each unit implements. core/session.ts and core/game.ts wire them together.
import type { Group, Object3D, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer } from 'three';
import type { EventBus } from './events';
import type { GameEvents } from './events-map';
import type { Clock } from './clock';
import type { Input } from './input';
import type { Rng } from './rng';
import type { SaveStore } from './save';
import type { Modules } from './modules';
import type {
  BikeId, CharacterId, Controls, CrashCause, EnvLook, Obstacle, Quality, RiderId, RiderState,
  Side, Surface, TrackFeature, TrackFrame, TrackId, Vec3Like, WeaponId,
} from './types';

// ---------------------------------------------------------------- app
export interface AppContext {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;   // the one render camera; CameraRig drives it
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;         // full-screen DOM overlay for ui/
  bus: EventBus<GameEvents>;
  clock: Clock;
  input: Input;
  save: SaveStore;
  params: URLSearchParams;
  quality: Quality;
  size: { width: number; height: number; dpr: number };
  modules: Modules;
  // App-level systems (created once, live across races):
  rig: CameraRig;
  fx: FxSystem;
  ui: Ui;
  audio: AudioSystem;
}

// ---------------------------------------------------------------- race session
export interface RaceConfig {
  trackId: TrackId;
  mode: 'quick' | 'career' | 'test';
  seed: number;
  level: number;               // career level 1..n (AI aggression, traffic density)
  playerCharacter: CharacterId;
  playerBike: BikeId;
  rivals: CharacterId[];       // AI riders, in grid order behind the player
  rivalBikes: BikeId[];        // same length as rivals (missing → data default)
  traffic: boolean;
  police: boolean;
  autopilot: boolean;          // player bike driven by AI (soak tests / attract mode)
}

export interface RaceResult {
  riderId: RiderId;
  character: CharacterId;
  name: string;
  isPlayer: boolean;
  place: number;
  time: number | null;         // null = did not finish (busted / timed out)
  kos: number;
  wrecked: number;
  coins: number;
}

export interface Session {
  readonly app: AppContext;
  readonly config: RaceConfig;
  readonly track: Track;
  readonly riders: RiderState[];
  readonly player: RiderState;
  readonly controls: Map<RiderId, Controls>;
  readonly obstacles: Obstacle[];
  readonly views: Map<RiderId, RiderView>;
  readonly rng: Rng;
  readonly world: Group;       // session-owned scene content (removed on dispose)
  phase: 'intro' | 'countdown' | 'racing' | 'finished';
  time: number;                // sim seconds since GO (0 before)
  physics: PhysicsSystem;
  combat: CombatSystem;
  logic: RaceLogic;
  rider(id: RiderId): RiderState | undefined;
}

// ---------------------------------------------------------------- world/
export interface Track {
  readonly id: TrackId;
  readonly length: number;     // m, start line s=0 .. finish line s=length
  readonly look: EnvLook;
  readonly group: Group;       // road, terrain, scenery, sky — added to the session world
  readonly features: TrackFeature[];
  /** Interpolated frame at s (clamped to [0, length]). `out` is reused when given. */
  frameAt(s: number, out?: TrackFrame): TrackFrame;
  /** World position of track-space point (s, x, y). */
  toWorld(s: number, x: number, y: number, out: Vector3): Vector3;
  /** Nearest track-space coordinates of a world point; hintS speeds up the search. */
  project(p: Vec3Like, hintS?: number): { s: number; x: number; y: number };
  /** Drivable extent at s: asphalt half-width plus the shoulders before a wall/drop. */
  bounds(s: number): { halfWidth: number; left: number; right: number; leftKind: Surface; rightKind: Surface };
  surfaceAt(s: number, x: number): Surface;
  /** Animate scenery (waves, signs, crowds). */
  update(dtSim: number, dtReal: number, camera: PerspectiveCamera): void;
  dispose(): void;
}

// ---------------------------------------------------------------- sim/
export interface PhysicsSystem {
  step(dt: number): void;
  applyImpulse(r: RiderState, imp: { forward?: number; lateral?: number; up?: number }): void;
  crash(r: RiderState, cause: CrashCause, attacker: RiderId | null): void;
  respawn(r: RiderState): void;
  /** World pose of the bike (contact point under the saddle), including lean & yaw. */
  pose(r: RiderState, outPos: Vector3, outQuat: Quaternion): void;
  dispose(): void;
}

// ---------------------------------------------------------------- gameplay/
export interface CombatSystem {
  preStep(dt: number): void;   // statuses → mods, start swings/skills from controls
  postStep(dt: number): void;  // resolve hits, projectiles, pickups, KOs
  dispose(): void;
}

export interface RaceLogic {
  preStep(dt: number): void;   // AI controls, traffic, police decisions
  postStep(dt: number): void;  // standings, finish line, race end
  results(): RaceResult[];
  dispose(): void;
}

// ---------------------------------------------------------------- camera/
export type CameraOverride = (cam: PerspectiveCamera, dtReal: number) => boolean;

export interface CameraRig {
  readonly camera: PerspectiveCamera;
  mode: 'chase' | 'lookBack' | 'cinematic' | 'orbit' | 'free';
  attach(session: Session | null): void;
  update(dtReal: number, dtSim: number): void;
  shake(intensity: number, duration: number): void;
  kick(fovDelta: number, duration: number): void;
  /** Hand the camera to a cinematic until the callback returns false; blends back over blendOut s. */
  override(fn: CameraOverride | null, blendOut?: number): void;
  resize(width: number, height: number): void;
}

// ---------------------------------------------------------------- actors/
export type AnchorName =
  | 'head' | 'beak' | 'chest' | 'handL' | 'handR' | 'saddle' | 'wheelF' | 'wheelR' | 'body' | 'bike';

export type ViewCue =
  | 'attack' | 'heavy' | 'hit' | 'stun' | 'ko' | 'respawn' | 'taunt' | 'bell'
  | 'victory' | 'defeat' | 'skill' | 'ult' | 'land' | 'boost';

export interface RiderView {
  readonly root: Object3D;
  /** Place & animate from sim state; pose comes from PhysicsSystem.pose(). */
  update(state: RiderState, pos: Vector3, quat: Quaternion, dtSim: number, dtReal: number): void;
  cue(cue: ViewCue, opts?: { side?: Side; skillId?: string; weapon?: WeaponId; intensity?: number }): void;
  setWeapon(weapon: WeaponId): void;
  anchor(name: AnchorName, out: Vector3): Vector3;
  dispose(): void;
}

// ---------------------------------------------------------------- fx/
export interface FxSystem {
  attach(session: Session | null): void;
  update(dtSim: number, dtReal: number): void;
  /** Render the frame (scene + post-processing) with app.camera. */
  render(): void;
  resize(width: number, height: number, dpr: number): void;
  /** Spawn a named effect; unknown names are ignored with a console warning. */
  burst(name: string, pos: Vec3Like, opts?: { count?: number; color?: string; dir?: Vec3Like; scale?: number }): void;
}

// ---------------------------------------------------------------- ui/
export type ScreenId =
  | 'boot' | 'title' | 'menu' | 'career' | 'garage' | 'trackSelect' | 'intro'
  | 'loading' | 'race' | 'pause' | 'results' | 'settings' | 'howto' | 'credits';

export interface ScreenProps {
  results?: RaceResult[];
  config?: RaceConfig;
  progress?: number;
  message?: string;
}

export interface Ui {
  show(screen: ScreenId, props?: ScreenProps): Promise<void>;
  readonly screen: ScreenId;
  attach(session: Session | null): void;
  update(dtReal: number): void;
  toast(text: string, kind?: 'info' | 'warn' | 'meme'): void;
}

// ---------------------------------------------------------------- audio/
export interface AudioSystem {
  /** Must be called from a user gesture before anything is audible. */
  unlock(): Promise<void>;
  music(id: string | null, fade?: number): void;
  sfx(id: string, opts?: { volume?: number; pitch?: number; pan?: number }): void;
  voice(id: string): void;
  /** 0 = normal, 1 = fully muffled (slow-mo / pause). */
  setMuffle(amount: number): void;
  update(dtReal: number): void;
  setVolumes(v: { master?: number; music?: number; sfx?: number; voice?: number }): void;
}
