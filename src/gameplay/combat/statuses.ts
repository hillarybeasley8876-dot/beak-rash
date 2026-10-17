// Status effects → rider.mods. Combat ticks every status each substep (including ones other units push,
// e.g. sim's 'oiled'/'wet'/'wobble' mirrors and police 'slow', all with source null) and rebuilds the mods
// physics/AI/views read. Entries combat creates are tracked so we merge into our own entries only and never
// fight other units over theirs. Duplicate ids count once (max strength). Skill 'boost' rides on mods.speedMul /
// accelMul, never on the shared boostTime/boostPower pair (writing that would merge its duration with drift and
// pad boosts): the stronger of the skill boost and the shared boost wins, each on its own clock.
import type { RiderId, RiderState, StatusEffect, StatusId } from '../../core/types';
import { STATUS_MODS } from './tuning';

const NEGATIVE: ReadonlySet<StatusId> = new Set<StatusId>(['stun', 'slow', 'chill', 'blind', 'wobble', 'gulped', 'oiled', 'wet']);
const owned = new WeakSet<StatusEffect>();

/** Protected riders shrug off new negative statuses (respawn invuln, ghosts, ult). */
const protectedFromDebuffs = (r: RiderState): boolean => r.invuln > 0 || r.mods.intangible;

/** Strongest active entry of `id` (0 if none). */
export function statusStrength(r: RiderState, id: StatusId): number {
  let best = 0;
  for (const st of r.statuses) if (st.id === id && st.time > 0) best = Math.max(best, st.strength);
  return best;
}

/**
 * Add or refresh a combat status: merges into our own entry of that id (time = max, strength = max,
 * latest source wins). Negative statuses are refused while protected unless `force`. Returns true if applied.
 */
export function addStatus(
  r: RiderState, id: StatusId, time: number, strength = 1, source: RiderId | null = null, force = false,
): boolean {
  if (time <= 0) return false;
  if (!force && NEGATIVE.has(id) && protectedFromDebuffs(r)) return false;
  const cur = r.statuses.find((st) => st.id === id && owned.has(st));
  if (cur) {
    cur.time = Math.max(cur.time, time);
    cur.strength = Math.max(cur.strength, strength);
    cur.source = source ?? cur.source;
    return true;
  }
  const st: StatusEffect = { id, time, strength, source };
  owned.add(st);
  r.statuses.push(st);
  return true;
}

/** Remove combat's own entries of `id`. */
export function removeStatus(r: RiderState, id: StatusId): void {
  for (let i = r.statuses.length - 1; i >= 0; i--) {
    const st = r.statuses[i];
    if (st && st.id === id && owned.has(st)) r.statuses.splice(i, 1);
  }
}

/** Count every timer down and drop expired entries (whoever pushed them). */
export function tickStatuses(r: RiderState, dt: number): void {
  for (let i = r.statuses.length - 1; i >= 0; i--) {
    const st = r.statuses[i];
    if (!st) continue;
    st.time -= dt;
    if (st.time <= 0) r.statuses.splice(i, 1);
  }
}

const strengths = new Map<StatusId, number>();

/** Rebuild r.mods in place from the current statuses (each id once) and feed 'boost' into physics. */
export function applyMods(r: RiderState): void {
  const m = r.mods;
  m.speedMul = m.accelMul = m.steerMul = m.gripMul = 1;
  m.canAttack = true;
  m.intangible = m.invisible = m.shield = false;
  strengths.clear();
  for (const st of r.statuses) {
    if (st.time > 0) strengths.set(st.id, Math.max(strengths.get(st.id) ?? 0, st.strength));
  }
  for (const [id, k] of strengths) {
    switch (id) {
      case 'stun':
        m.steerMul *= STATUS_MODS.stun.steer;
        m.accelMul *= STATUS_MODS.stun.accel;
        m.speedMul *= STATUS_MODS.stun.speed;
        m.canAttack = false;
        break;
      case 'slow':
        m.speedMul *= 1 - Math.min(0.9, k);
        m.accelMul *= 1 - Math.min(0.9, k) * 0.5;
        break;
      case 'chill':
        m.speedMul *= STATUS_MODS.chill.speed;
        m.canAttack = false;
        break;
      case 'boost': {
        const shared = r.boostTime > 0 ? r.boostPower : 0;
        m.speedMul *= Math.max(1, (1 + k) / (1 + shared));
        m.accelMul *= 1 + 2 * k;
        break;
      }
      case 'shield': m.shield = true; break;
      case 'invisible': m.invisible = true; break;
      case 'intangible': m.intangible = true; break;
      case 'blind': m.steerMul *= STATUS_MODS.blind.steer; break;
      case 'wobble':
        m.steerMul *= STATUS_MODS.wobble.steer;
        m.gripMul *= STATUS_MODS.wobble.grip;
        break;
      case 'gulped':
        m.intangible = m.invisible = true;
        m.canAttack = false;
        m.steerMul = 0;
        break;
      case 'oiled': m.gripMul *= STATUS_MODS.oiled.grip; break;
      case 'wet': m.gripMul *= STATUS_MODS.wet.grip; break;
      case 'angry': break;
    }
  }
  if (m.invisible || m.intangible) m.canAttack = false; // nobody lands blows from where they can't be hit back
}
