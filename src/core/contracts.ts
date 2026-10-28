// System interfaces each unit implements. core/session.ts and core/game.ts wire them together.
import type { Group, Object3D, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer } from 'three';
import type { EventBus } from './events';
import type { GameEvents } from './events-map';
import type { Clock } from './clock';
import type { Input } from './input';
import type { Rng } from './rng';
import type { SaveStore } from './save';
import type { Modules } from './modules';
import type { MemberPick, RoomSetup } from '../net/protocol';
import type { BikeId, CharacterId, Controls, CrashCause, EnvLook, Obstacle, Quality, RiderId, RiderState, Side, SkillLoadout, Surface, TrackFeature, TrackFrame, TrackId, Vec3Like, WeaponId, Weather } from './types';

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
  /** Set only where the game may close itself (the desktop shell, served from app://): menus may offer
   *  退出游戏 QUIT (with a confirm) when present. Browsers cannot close their own tab. */
  quit?: () => void;
  // App-level systems (created once, live across races):
  rig: CameraRig;
  fx: FxSystem;
  ui: Ui;
  audio: AudioSystem;
  /** r6 (SPEC §28): online rooms — the relay connection, the lobby, and the lockstep driver of online races. */
  net: NetSystem;
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
  // ---- r4 (SPEC §18, §20); absent = clear weather, authored direction and layout, no nemesis ----
  weather?: Weather;
  reverse?: boolean;
  route?: number;              // 0 / absent = the authored layout, else the seed of a generated route
  nemesis?: CharacterId | null; // the rival holding the biggest grudge (core fills it from SaveData.rivalry)
  // ---- r6 (SPEC §23–§24) ----
  /** The player's skills this race (core fills it from SaveData.loadouts / the 盲盒 roll, validated). */
  loadout?: SkillLoadout;
  /** Per rival (same order as `rivals`): their kits (core fills them; missing → data/loadouts rivalLoadout). */
  rivalLoadouts?: SkillLoadout[];
  // ---- r6 online rooms (SPEC §28) ----
  /** Set for an online race: the humans ride rider ids 0..n-1 (slot order), the AI `rivals` the rest. */
  online?: OnlineRace;
}

/** One human of an online race. */
export interface OnlineHuman {
  /** Rider id (= index in OnlineRace.humans). */
  slot: RiderId;
  /** The relay's member id of this human. */
  member: number;
  name: string;
  character: CharacterId;
  bike: BikeId;
  loadout: SkillLoadout;
}

/** The online part of a RaceConfig: identical on every client except `local`. */
export interface OnlineRace {
  room: string;
  humans: OnlineHuman[];
  /** This client's rider (its slot). Presentation only: the sim never reads it. */
  local: RiderId;
}

/** How a track is built (SPEC §20). */
export interface TrackOptions {
  weather?: Weather;
  reverse?: boolean;
  route?: number;
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
  styleBest?: number;          // best banked STYLE chain this race (player only, gameplay/style)
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
  /** r6 (SPEC §28): the riders a human rides (offline: [player]; online: every member still racing), in id order. */
  readonly humans: readonly RiderState[];
  /** Online races: advance one relay tick (TICK_SUBSTEPS fixed substeps) with every human's controls for this tick
   *  (`inputs[slot]`); `left` = slots whose human left right before it (an AI takes over). Never reads local input. */
  tick(inputs: ReadonlyArray<Controls>, left?: readonly RiderId[]): void;
  /** Update the rider views and the scenery for the sim time just advanced (once per rendered frame). */
  present(dtSim: number, dtReal: number): void;
  /** A hash of the sim state (riders, obstacles, rng, time): equal on every client of an online race. */
  hash(): string;
}

// ---------------------------------------------------------------- world/
export interface Track {
  readonly id: TrackId;
  readonly length: number;     // m, start line s=0 .. finish line s=length
  /** Drivable run-off after the finish line (m). frameAt/toWorld/project/bounds are valid on [0, length + runoff]. */
  readonly runoff?: number;
  readonly look: EnvLook;
  readonly group: Group;       // road, terrain, scenery, sky — added to the session world
  readonly features: TrackFeature[];
  /** r4 (SPEC §20): how this track was built; absent on builds that predate the option = clear / authored. */
  readonly weather?: Weather;
  readonly reverse?: boolean;
  readonly route?: number;
  /** Weather road-grip multiplier (rain 0.85, snow 0.75, else 1); sim multiplies the lateral grip with it. */
  readonly grip?: number;
  /** Interpolated frame at s (clamped to [0, length + runoff]). `out` is reused when given. */
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
  /** Optional, once per rendered frame after the rider views updated (visual sync, hit-stop re-facing). */
  frame?(dtReal: number): void;
  dispose(): void;
}

export interface RaceLogic {
  preStep(dt: number): void;   // AI controls, traffic, police decisions
  postStep(dt: number): void;  // standings, finish line, race end
  results(): RaceResult[];
  /** r6 (SPEC §28): an online human left; an AI rides `id` from now on (called between two substeps). */
  takeover?(id: RiderId): void;
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
  /** Optional: the pose the chase camera would have right now (for cinematics flying home); returns its FOV. */
  chasePose?(outPos: Vector3, outQuat: Quaternion): number;
}

// ---------------------------------------------------------------- actors/
export type AnchorName =
  | 'head' | 'beak' | 'chest' | 'handL' | 'handR' | 'saddle' | 'wheelF' | 'wheelR' | 'body' | 'bike';

export type ViewCue =
  | 'attack' | 'heavy' | 'hit' | 'stun' | 'ko' | 'respawn' | 'taunt' | 'bell'
  | 'victory' | 'defeat' | 'skill' | 'ult' | 'land' | 'boost';

/** Options for Modules.createRiderView. `track` is set for a race session's views (absent in menus / sandboxes),
 *  e.g. to ground crash debris exactly with track.project / frameAt. */
export interface RiderViewOpts {
  isPlayer: boolean;
  quality: Quality;
  track?: Track;
}

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
export const SCREEN_IDS = [
  'boot', 'title', 'menu', 'career', 'garage', 'trackSelect', 'intro',
  'loading', 'race', 'pause', 'results', 'settings', 'howto', 'credits',
  'roster', 'records', // r6 (SPEC §23, §26): character + skill select; the achievements & eggs screen
  'online', 'lobby',   // r6 (SPEC §28): create / join a room; the room before the race
] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

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
  /** Session in progress (positional SFX, adaptive music); null between races. */
  attach?(session: Session | null): void;
  music(id: string | null, fade?: number): void;
  sfx(id: string, opts?: { volume?: number; pitch?: number; pan?: number }): void;
  voice(id: string): void;
  /** 0 = normal, 1 = fully muffled (slow-mo / pause). */
  setMuffle(amount: number): void;
  update(dtReal: number): void;
  setVolumes(v: { master?: number; music?: number; sfx?: number; voice?: number }): void;
}

// ---------------------------------------------------------------- net/ (r6, SPEC §28)
export type NetState = 'offline' | 'connecting' | 'online' | 'error';

/** A member of the room as the lobby shows it. */
export interface NetMember extends MemberPick {
  id: number;
  name: string;
  ready: boolean;
}

export interface NetRoom {
  code: string;
  host: number;
  /** This client's member id. */
  you: number;
  members: NetMember[];
  setup: RoomSetup | null;
  state: 'lobby' | 'loading' | 'racing';
}

export interface NetSystem {
  /** The relay connection (the lobby screens show it). */
  readonly state: NetState;
  /** The last error / status line for the player (Chinese), '' when none. */
  readonly message: string;
  /** Round-trip time to the relay (ms), null before the first pong. */
  readonly ping: number | null;
  readonly room: NetRoom | null;
  /** Called after any change of state / message / ping / room; returns the unsubscribe. */
  onChange(fn: () => void): () => void;
  /** Connect to the relay (`?relay=ws://…` or the build's default) under this player name. */
  connect(name: string): Promise<boolean>;
  createRoom(): void;
  joinRoom(code: string): void;
  pick(p: MemberPick): void;
  ready(on: boolean): void;
  /** Host only. */
  setup(s: RoomSetup): void;
  /** Host only, every member ready: builds the RaceConfig and starts the race for the room. */
  start(): void;
  /** Leave the room (and an online race in progress) and disconnect. */
  leave(): void;
  /** Core calls it once per rendered frame during an online race: sends the local input, runs session.tick() for
   *  the ticks that arrived (never more than a few per frame) and returns how many ran (0 = waiting). */
  frame(dtReal: number): number;
}
