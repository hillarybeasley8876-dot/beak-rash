// Today's form: per-race dice that decide most of a rival's pace, cornering and slipstream appetite, so the
// podium changes from race to race instead of following species stats (acceptance r1: the pigeon owned it).
// One rival drawn from the field is today's favourite (strong form on both dice). A small handicap evens out
// bike handling: a clumsy-cornering bike (erba, tandem) gets a little more straight-line pace, a nimble one
// (kidbike) a little less, so the corners don't settle the order before the dice do.
import type { Session } from '../../../core/contracts';
import { hashString } from '../../../core/rng';
import type { RiderId, RiderState } from '../../../core/types';
import { handlingOf } from './control';

export interface Form {
  /** −1..1: straight-line pace (offset = PACE_SPREAD × pace + the handling handicap). */
  pace: number;
  /** −1..1: driving (skill, corner risk, slipstream and drift appetite; personality.ts). */
  drive: number;
}
export type FormTable = ReadonlyMap<RiderId, Form>;

const PACE_SPREAD = 0.045;    // ± pace offset from form (the SPEC ±8 % band: leader ease −8 %, catch-up +8 %)
const HANDLING_EVEN = 0.04;   // pace offset per unit of rider handling below the reference (1.0)

/** Roll today's form for every rival (the humans have none); the same seed on another track is another day. */
export function rollForm(session: Session): FormTable {
  const rng = session.rng.fork(0xf02 ^ hashString(session.track.id));
  // The humans are the rivals' yardstick, not their rivals: form is rolled for the AI riders only, so the
  // dice are the same on every client of an online race (offline: everyone but the player).
  const rivals = session.riders.filter((r) => !r.human);
  const fav = rivals.length > 0 ? rng.int(0, rivals.length - 1) : -1;
  return new Map(rivals.map((r, i): [RiderId, Form] => [r.id, i === fav
    ? { pace: rng.range(0.85, 1), drive: rng.range(0.5, 1) }
    : { pace: rng.range(-1, 0.7), drive: rng.range(-1, 1) }]));
}

/** Pace offset (fraction of the level reference) of a rival: today's form plus the handling handicap. */
export const paceOffset = (r: RiderState, f: Form | undefined): number =>
  PACE_SPREAD * (f?.pace ?? 0) + HANDLING_EVEN * (1 - handlingOf(r));
