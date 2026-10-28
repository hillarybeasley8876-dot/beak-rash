// Shared data contracts. Units talk to each other ONLY through these types, the event bus
// (core/events-map.ts) and the system interfaces in core/contracts.ts. Never import another
// unit's internals.

export type CharacterId =
  | 'pelican' | 'goose' | 'capybara' | 'cat' | 'shiba'
  | 'pigeon' | 'penguin' | 'seagull' | 'sloth' | 'corgi'
  // r6 meme roster (SPEC §23): racers since their species models passed review
  | 'bananacat' | 'cryingcat' | 'xinxian' | 'moodeng' | 'pedro' | 'hamster';

export type BikeId = 'roadbike' | 'erba' | 'shared' | 'fixie' | 'mtb' | 'tandem' | 'kidbike'
  | 'llm'; // 大模型限定款: secret, unlocked by the Konami code (SPEC §21); not in BIKE_ORDER until unlocked
export type TrackId = 'coast' | 'city' | 'mountain'
  | 'watertown' | 'gobi'; // r4 (SPEC §20): per-track content lives in */track-content, env/<id>-look, ui/tracks; hidden until in TRACK_ORDER
export type WeaponId =
  | 'none' | 'saltfish' | 'baguette' | 'pan' | 'leek' | 'umbrella' | 'selfie' | 'slipper' | 'keyboard'
  | 'baton'; // police only (SPEC §14): never in crates or rival loadouts
export type Surface = 'road' | 'curb' | 'grass' | 'sand' | 'dirt' | 'water' | 'wall';
export type Side = -1 | 1; // -1 = left, +1 = right (rider's own left/right)
export type RiderId = number;
export type Quality = 'low' | 'medium' | 'high';
/** Race weather (SPEC §20): looks, road grip, particles and ambience follow it. */
export type Weather = 'clear' | 'rain' | 'snow' | 'fog' | 'dusk';
/** Air tricks (SPEC §16). */
export type TrickKind = 'spin' | 'backflip' | 'frontflip' | 'superman';

export interface Vec3Like { x: number; y: number; z: number }

/** What a controller (keyboard/gamepad/AI/test script) asks the bike to do this sim step. */
export interface Controls {
  steer: number;      // -1 full left .. +1 full right (already smoothed for keyboard)
  throttle: number;   // 0..1 pedal effort
  brake: number;      // 0..1
  drift: boolean;     // held
  lookBack: boolean;  // held (player only)
  // Edge-triggered: true for exactly one sim step after the press.
  hop: boolean;
  attackL: boolean;
  attackR: boolean;
  heavy: boolean;
  skill1: boolean;
  skill2: boolean;
  skill3: boolean;
  ult: boolean;
  bell: boolean;
  /** Held state of the heavy key/button (a heavy press still held when its windup ends = throw aim, SPEC §15). */
  heavyHeld: boolean;
}

export const emptyControls = (): Controls => ({
  steer: 0, throttle: 0, brake: 0, drift: false, lookBack: false,
  hop: false, attackL: false, attackR: false, heavy: false,
  skill1: false, skill2: false, skill3: false, ult: false, bell: false, heavyHeld: false,
});

export type StatusId =
  | 'stun' | 'slow' | 'chill' | 'boost' | 'shield' | 'invisible' | 'intangible'
  | 'blind' | 'wobble' | 'gulped' | 'angry' | 'oiled' | 'wet'
  // r6 elements & control (SPEC §24): fire DoT, ice (cold stacks → frozen), the thunder mark, inverted steering,
  // stopped in place (eating the pie), no skills (the sad violin), time stop (halted: sim skips the rider)
  | 'burn' | 'frozen' | 'cold' | 'charged' | 'confused' | 'rooted' | 'silenced' | 'halted';

/** The five skill elements (SPEC §24). Water also comes from rain and puddles ('wet'). */
export type Element = 'fire' | 'ice' | 'thunder' | 'water' | 'wind';

/** Elemental reactions (SPEC §24): what an element does to a rider already carrying another one. */
export type Reaction = 'vaporize' | 'melt' | 'freeze' | 'electro' | 'superconduct' | 'overload' | 'swirl';

/** The skills a rider carries into a race: slots U / I / O (index 0..2) and the ult (P); null = empty. */
export interface SkillLoadout {
  slots: [string | null, string | null, string | null];
  ult: string | null;
}

export interface StatusEffect {
  id: StatusId;
  time: number;        // seconds remaining
  strength: number;    // effect-specific magnitude (e.g. slow 0.3 = -30% speed)
  source: RiderId | null;
}

/** Recomputed from statuses every step by combat; read by physics/AI/views. */
export interface RiderMods {
  speedMul: number;    // top-speed multiplier
  accelMul: number;
  steerMul: number;    // 0 = cannot steer (stunned)
  gripMul: number;     // lateral grip (oil < 1)
  canAttack: boolean;
  intangible: boolean; // ignores rider collisions & melee
  invisible: boolean;
  shield: boolean;     // blocks next hit
  pushImmune: boolean; // rider contacts cost this rider no speed (the other rider is still pushed, rider:bump still fires)
  steerInvert: boolean; // r6 'confused': sim flips the steering input (player and AI alike)
  halted: boolean;      // r6 'halted' (time stop): sim leaves the rider where it is (speed kept for afterwards)
  silenced: boolean;    // r6 'silenced': no skill casts (melee still works)
}

export const defaultMods = (): RiderMods => ({
  speedMul: 1, accelMul: 1, steerMul: 1, gripMul: 1,
  canAttack: true, intangible: false, invisible: false, shield: false, pushImmune: false,
  steerInvert: false, halted: false, silenced: false,
});

export type RiderMode = 'grid' | 'racing' | 'crashed' | 'respawning' | 'finished' | 'busted';
export type CrashCause = 'ko' | 'traffic' | 'wall' | 'water' | 'obstacle' | 'skill' | 'police' | 'trick';

export interface CrashInfo {
  cause: CrashCause;
  /** World-space launch velocity of the rider body (m/s) and angular velocity (rad/s). */
  vel: Vec3Like;
  spin: Vec3Like;
  /** World position where the crash happened. */
  origin: Vec3Like;
  attacker: RiderId | null;
}

/** Current animated action, for views and hit timing. */
export interface RiderAction {
  kind: 'attack' | 'heavy' | 'skill' | 'ult' | 'bell' | 'hit' | 'throw'; // 'throw' = aiming (cocked) until release
  side: Side;
  t: number;           // seconds since start
  dur: number;         // total duration
  weapon: WeaponId;
  skillId: string | null;
  resolved: boolean;   // combat already applied the hit for this swing
}

export interface RiderState {
  readonly id: RiderId;
  readonly character: CharacterId;
  readonly bike: BikeId;
  /** The LOCAL player's rider (camera, HUD, audio, achievements). The sim never reads it (SPEC §28). */
  readonly isPlayer: boolean;
  /** r6 (SPEC §28): a human rides it (offline: the player; online: every member's rider). The sim's "the player". */
  human: boolean;
  name: string;
  // --- kinematics, track space (owned by sim/) ---
  s: number;           // distance along the track centre line (m)
  x: number;           // lateral offset from centre, + = right (m)
  y: number;           // height above road surface (m), > 0 when airborne
  speed: number;       // forward speed along the track (m/s)
  vx: number;          // lateral velocity (m/s)
  vy: number;          // vertical velocity (m/s)
  yaw: number;         // heading relative to the track tangent (rad, + = right)
  lean: number;        // visual lean (rad, + = right)
  airborne: boolean;
  airTime: number;
  drifting: boolean;
  driftCharge: number; // seconds of drift held (mini-turbo charge)
  boostTime: number;   // seconds of boost remaining
  boostPower: number;  // extra top-speed fraction while boosting (0.25 = +25%)
  surface: Surface;
  draft: number;       // 0..1 slipstream amount
  trick: TrickState | null; // air trick in progress (SPEC §16); views rotate the rider + bike by it
  trickChain: number;  // tricks completed in the current air (0 on the ground)
  gliding: boolean;    // umbrella glide in progress (sim-owned, SPEC §15); views open the umbrella overhead
  // --- race (owned by gameplay/race) ---
  mode: RiderMode;
  modeTime: number;    // seconds in current mode
  place: number;       // 1-based standing
  progress: number;    // 0..1 of track length
  finishTime: number | null;
  rubber: number;      // race-owned top-speed factor (rubber band / hunt sprint), 1 = neutral; physics multiplies it in
  // --- combat (owned by gameplay/combat) ---
  hp: number;
  maxHp: number;
  sp: number;          // 0..100 skill/ult meter
  weapon: WeaponId;
  weaponUses: number;  // hits left on the held weapon (Infinity for 'none'); combat owns it
  ultTarget: boolean;  // a SHOWTIME cast now would find victims (combat's planUlt window); combat owns it, HUD reads it
  statuses: StatusEffect[];
  mods: RiderMods;
  action: RiderAction | null;
  cooldowns: number[]; // seconds left per skill slot [s1, s2, s3]
  loadout: SkillLoadout; // r6: the skills in the slots (core sets it at spawn from RaceConfig; combat casts from it)
  combo: number;       // consecutive hits without being hit
  comboTimer: number;
  kos: number;         // riders this rider knocked out
  wrecked: number;     // times this rider was knocked out
  lastHitBy: RiderId | null;
  lastHitTime: number;
  invuln: number;      // seconds of post-respawn invulnerability
  coins: number;       // 小鱼干 earned this race
  heat: number;        // 0..1 police attention
  crash: CrashInfo | null;
}

/** An air trick in progress (sim-owned). progress = t / dur; superman has dur = Infinity while held. */
export interface TrickState {
  kind: TrickKind;
  t: number;           // seconds since the trick started
  dur: number;         // seconds for the full rotation
  dir: Side;           // spin direction (+1 = clockwise seen from above); flips use −1 back / +1 front
}

export interface TrackFrame {
  s: number;
  pos: Vec3Like;       // centre-line road surface point (world)
  tangent: Vec3Like;   // unit, direction of travel
  up: Vec3Like;        // unit road normal (includes bank)
  right: Vec3Like;     // unit, tangent × up
  curvature: number;   // 1/m, + = road turns right
  slope: number;       // rise per metre along tangent
  bank: number;        // rad, + = right side lower
  halfWidth: number;   // drivable asphalt half-width (m)
}

export type FeatureKind =
  | 'ramp' | 'tunnel' | 'bridge' | 'oil' | 'puddle' | 'cones' | 'barrier'
  | 'boostPad' | 'pickupRow' | 'checkpoint' | 'jumpCrest' | 'secret'; // secret: data.id (gameplay/secrets, SPEC §21)

export interface TrackFeature {
  kind: FeatureKind;
  s0: number;
  s1: number;
  x0: number;          // lateral extent (m)
  x1: number;
  data?: Record<string, number | string | boolean>;
}

export interface EnvLook {
  name: string;
  sky: { top: string; horizon: string; bottom: string };
  fog: { color: string; near: number; far: number };
  sun: { dir: Vec3Like; color: string; intensity: number };
  ambient: { sky: string; ground: string; intensity: number };
  /** Post-processing hints for fx/ (grading). */
  grade: { saturation: number; contrast: number; tint: string; bloom: number; night: boolean };
}

export type ObstacleKind =
  | 'car' | 'van' | 'truck' | 'bus' | 'police' | 'cone' | 'crate' | 'barrel' | 'oil' | 'puddle' | 'ramp'
  | 'barrier' | 'goose' | 'stall' | 'prop'; // r4: roadblocks/roadworks, crossing geese, market stalls, hittable props

/** Anything on the road physics must collide with (traffic, props). Track space, like riders. */
export interface Obstacle {
  readonly id: number;
  kind: ObstacleKind;
  s: number;
  x: number;
  speed: number;       // m/s along +s (negative = oncoming)
  halfWidth: number;
  halfLength: number;
  height: number;
  solid: boolean;      // false = surface effect only (oil, puddle) or ramp
  active: boolean;
}
