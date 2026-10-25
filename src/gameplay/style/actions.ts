// Which bus events score STYLE points and what they are worth (SPEC §17). Every mapper is pure: the caller
// (index.ts) decides whether the event belongs to the player.
import type { WeaponId } from '../../core/types';
import { DRIFT_POWER, LABEL, POINTS, type FixedKind } from './tuning';

export interface StyleAction {
  /** The action kind: two actions of the same kind in a row score half, and the kind counts once for the multiplier. */
  kind: string;
  /** Short Chinese label for the HUD. */
  label: string;
  /** Base points, before the half-repeat rule. */
  points: number;
}

/** An action that always scores the same points. */
export function fixedAction(kind: FixedKind): StyleAction {
  return { kind, label: LABEL[kind], points: POINTS[kind] };
}

/** A landed trick: the event carries its own points (120 per trick, +50 per extra trick in the same air). */
export function trickAction(points: number): StyleAction | null {
  if (points <= 0) return null;
  return { kind: 'trick', label: LABEL.trick, points };
}

/** A drift mini-turbo: the boost power picks the level (L1 / L2 / L3). */
export function driftAction(power: number): StyleAction {
  const kind = power >= DRIFT_POWER.level3 ? 'drift3' : power >= DRIFT_POWER.level2 ? 'drift2' : 'drift1';
  return { kind, label: LABEL[kind], points: POINTS[kind] };
}

/**
 * A hit the player landed. A weapon that is not in the player's hands any more is a thrown weapon (it left the
 * hand when it was thrown) and beats the heavy/light split.
 */
export function hitAction(heavy: boolean, weapon: WeaponId, held: WeaponId): StyleAction {
  if (weapon !== 'none' && weapon !== held) return { kind: 'throwHit', label: LABEL.throwHit, points: POINTS.throwHit };
  if (heavy) return { kind: 'heavyHit', label: LABEL.heavyHit, points: POINTS.heavyHit };
  return { kind: 'hit', label: LABEL.hit, points: POINTS.hit };
}
