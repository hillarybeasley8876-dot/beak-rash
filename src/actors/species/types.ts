// Species definition: joints (bind pose), behaviour hints for the rig, and a build() that models the
// character into a CharacterBuilder. One file per species under species/.
import type { CharacterId, Quality } from '../../core/types';
import type { CharacterBuilder } from '../kit/builder';
import type { V3 } from '../kit/sdf';
import type { Joints } from '../rig/skeleton';

export type HatKind = 'helmet' | 'cap' | 'bandana' | 'none';
export type SkillPose =
  | 'spit' | 'gulp' | 'wingspread' | 'honk' | 'chill' | 'spin' | 'doge' | 'ghost' | 'slide' | 'grab' | 'flash' | 'whistle';

export interface SpeciesMeta {
  /** Arms are wings (birds) — wing-grip pose, wing spread. */
  wings: boolean;
  /** Legs are too short for the pedals by design (corgi): never stretched to fit. */
  shortLegs?: boolean;
  hat: HatKind;
  /** Left eye look direction in the bind pose (unit). */
  eyeDir: V3;
  /** Upper-lid angles (rad about the lid hinge): open / closed. */
  lid: { open: number; closed: number };
  /** Resting lid closure 0..1 (capybara/sloth are sleepy). */
  sleepy: number;
  /** Lid slant (rad): + drops the inner corners (angry/smug), − lifts them (worried). */
  lidTilt?: number;
  /** Constant pupil yaw offset (rad, + = toward the rider's left): doge side-eye. */
  lookBias?: number;
  /** Pigeon-style head bob while pedalling. */
  headBob?: boolean;
  /** How far the head can stretch forward on attacks (m; pelican S-neck). */
  neckReach: number;
  tail: 'feather' | 'stub' | 'long' | 'curl' | 'none';
  /** Bind twist reference for the left arm (wing trailing direction for birds, elbow side for mammals). */
  armUp: V3;
  /** Height of the wing/arm "hand" grip point below the wrist joint (m). */
  gripDrop: number;
  /** Ankle sits this far above/behind the pedal centre (m). */
  ankleLift: V3;
  /** Beak / mouth tip in the bind pose (character space) — the 'beak' anchor. */
  beak: V3;
  /** Default vertex colour for eyelids (fur/feather). */
  skin: number;
  skillPose: SkillPose;
}

export interface SpeciesDef {
  id: CharacterId;
  joints: Joints;
  meta: SpeciesMeta;
  build(b: CharacterBuilder, quality: Quality): void;
}
