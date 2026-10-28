// The humans of a race (SPEC §28): the riders a human rides — offline the player, online every member of the
// room that is still racing. The sim never reads `session.player` (the LOCAL rider: camera, HUD, audio): where
// the rules of the game talk about "the player", they talk about a human.
//   · a rule about one rival and the player → that rival's NEAREST human (smallest |Δs|, ties → the lower id)
//   · a rule about the race as a whole → the leading or the trailing human
// Offline there is exactly one human (the player), so every rule below is exactly the old one.
import type { Session } from '../../core/contracts';
import type { RiderState } from '../../core/types';

/** The humans still in the race, in rider id order (a human who left drops out). */
export const humansOf = (session: Session): readonly RiderState[] => session.humans;

/** The human nearest to `r` along the track (smallest |Δs|; a tie goes to the lower id). */
export function nearestHuman(session: Session, r: RiderState): RiderState | null {
  let best: RiderState | null = null;
  let bestD = Infinity;
  for (const h of session.humans) {
    const d = Math.abs(h.s - r.s);
    if (d < bestD || (d === bestD && best !== null && h.id < best.id)) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

/** The human furthest ahead of the field (the one the race-wide rules look at). */
export function leadingHuman(session: Session): RiderState | null {
  let best: RiderState | null = null;
  for (const h of session.humans) {
    if (!best || h.s > best.s || (h.s === best.s && h.id < best.id)) best = h;
  }
  return best;
}

/** The human furthest behind the field (the last one still to come through). */
export function trailingHuman(session: Session): RiderState | null {
  let best: RiderState | null = null;
  for (const h of session.humans) {
    if (!best || h.s < best.s || (h.s === best.s && h.id < best.id)) best = h;
  }
  return best;
}

/** The s of the leading human (0 when there is none). */
export const leadingS = (session: Session): number => leadingHuman(session)?.s ?? 0;

/** The s of the trailing human (0 when there is none). */
export const trailingS = (session: Session): number => trailingHuman(session)?.s ?? 0;

/** Is any human within `range` m of `r` (laterally included)? */
export function humanNear(session: Session, r: RiderState, range: number): boolean {
  for (const h of session.humans) {
    if (Math.abs(h.s - r.s) < range && Math.abs(h.x - r.x) < range) return true;
  }
  return false;
}
