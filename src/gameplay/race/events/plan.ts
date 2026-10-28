// The seeded schedule of the track events (SPEC §19): one or two spots per race, drawn from the middle of
// the track, never two of them close together, never inside a tunnel, on a bridge or in a jump's run-up or
// flight, and never near the finish. The spot is where the event is announced; the props reach around it.
import type { Rng } from '../../../core/rng';
import type { Track } from '../../../core/contracts';
import type { TrackId } from '../../../core/types';
import type { EventKind } from '../../../data/event-lines';
import { roadworksSpan } from './roadworks';
import { FREE_SPAN } from './spot';
import { EVENT_TUNING as T } from './tuning';

/** The tracks with a fruit market on the roadside. */
const STALL_TRACKS: readonly TrackId[] = ['coast', 'city', 'watertown'];

/** A goose's own half length (geese.ts): the flock is spread over `spread` metres around the spot. */
const GOOSE_HALF = 0.3;
/** The market stalls stand one every this many metres (stalls.ts). */
const STALL_EVERY = 6.5;

/**
 * How far the props of an event reach around its spot (before, after). This is the REAL extent of what
 * the event puts on the road — a prop whose spot is taken is pushed on by `FREE_SPAN`, the work zone is
 * the whole wall it builds — so a spot is only planned where every prop clears a jump's run-up.
 */
const SPAN: Record<EventKind, { before: number; after: number }> = {
  // The spilled fish lie `pickupBack` behind the truck; the truck itself may stop further on.
  fishSpill: { before: T.fishSpill.pickupBack, after: FREE_SPAN + T.fishSpill.truckLength / 2 },
  geese: { before: T.geese.spread / 2 + GOOSE_HALF, after: T.geese.spread / 2 + FREE_SPAN + GOOSE_HALF },
  roadworks: roadworksSpan(),
  stalls: {
    before: T.stalls.length / 2,
    after: STALL_EVERY * (T.stalls.count[1] - 1) + FREE_SPAN + T.stalls.length / 2,
  },
};

export interface PlannedEvent {
  kind: EventKind;
  /** The spot on the track. */
  s: number;
}

/** The event kinds a track can host. */
export function eventKinds(trackId: TrackId): EventKind[] {
  const kinds: EventKind[] = ['fishSpill', 'geese', 'roadworks'];
  if (STALL_TRACKS.includes(trackId)) kinds.push('stalls');
  return kinds;
}

/** The events of this race (empty when the level has no events yet). */
export function planEvents(rng: Rng, track: Track, level: number): PlannedEvent[] {
  if (level < 1) return [];
  // The schedule draws from its own child stream (like every other system that rolls): the props of an
  // event are forked from `rng` after the plan (events/index.ts), so a planner that drew from it directly
  // would shift every prop in the race as soon as one rule is added or retuned.
  const draw = rng.fork(0x5c4ed);
  const kinds = eventKinds(track.id);
  const want = draw.chance(0.55) ? 2 : 1;
  const out: PlannedEvent[] = [];
  for (let i = 0; i < want; i++) {
    const kind = kinds.splice(draw.int(0, kinds.length - 1), 1)[0];
    if (!kind) break;
    const s = findSpot(draw, track, kind, out);
    if (s === null) continue;
    out.push({ kind, s });
  }
  return out;
}

/** The step (m) the search for a spot that keeps every rule walks along the track. */
const SPOT_STEP = 10;

/**
 * A spot that keeps every rule: inside the planned stretch of the track, far from the other events, out
 * of a tunnel or a bridge, clear of a jump's run-up and flight, and clear of the finish.
 */
function allowed(track: Track, s: number, span: { before: number; after: number }, taken: readonly PlannedEvent[]): boolean {
  const L = track.length;
  if (s < T.spotFrom * L || s > T.spotTo * L) return false;
  if (s > L - T.finishClear) return false;
  if (s + span.after > L - 60) return false;
  if (taken.some((o) => Math.abs(o.s - s) < T.minGap)) return false;
  return !covered(track, s - span.before, s + span.after);
}

/**
 * The spot of this event: the seeded draw, moved on to the next one that keeps every rule (forward first,
 * then back). An event is never dropped for want of a spot — it is placed where it fits.
 */
function findSpot(rng: Rng, track: Track, kind: EventKind, taken: readonly PlannedEvent[]): number | null {
  const L = track.length;
  const span = SPAN[kind];
  const drawn = rng.range(T.spotFrom * L, T.spotTo * L);
  for (let d = 0; d <= (T.spotTo - T.spotFrom) * L; d += SPOT_STEP) {
    const ahead = drawn + d;
    if (allowed(track, ahead, span, taken)) return ahead;
    const behind = drawn - d;
    if (behind !== ahead && allowed(track, behind, span, taken)) return behind;
  }
  return null;
}

/** Does a tunnel, a bridge or a jump sit between s0 and s1 (with the clearance each of them needs)? */
function covered(track: Track, s0: number, s1: number): boolean {
  for (const f of track.features) {
    const jump = f.kind === 'ramp' || f.kind === 'jumpCrest';
    if (f.kind !== 'tunnel' && f.kind !== 'bridge' && !jump) continue;
    // A rider lines up for a jump over the last JUMP_RUNUP metres and flies JUMP_FLIGHT past it: no prop
    // of an event may stand in that lane (the run-up is ridden at full speed, the flight ends in a landing).
    const before = jump ? T.jumpRunup : T.featureClear;
    const after = jump ? T.featureClear + T.jumpFlight : T.featureClear;
    if (s1 >= f.s0 - before && s0 <= f.s1 + after) return true;
  }
  return false;
}
