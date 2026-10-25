// The seeded schedule of the track events (SPEC §19): one or two spots per race, drawn from the middle of
// the track, never two of them close together, never inside a tunnel or on a bridge and never near the
// finish. The spot is where the event is announced; the props of an event reach around it.
import type { Rng } from '../../../core/rng';
import type { Track } from '../../../core/contracts';
import type { TrackId } from '../../../core/types';
import type { EventKind } from '../../../data/event-lines';
import { EVENT_TUNING as T } from './tuning';

/** The tracks with a fruit market on the roadside. */
const STALL_TRACKS: readonly TrackId[] = ['coast', 'city', 'watertown'];

/** How far the props of an event reach around its spot (before, after). */
const SPAN: Record<EventKind, { before: number; after: number }> = {
  fishSpill: { before: 80, after: 10 },
  geese: { before: 8, after: 8 },
  roadworks: { before: T.roadworks.lead, after: T.roadworks.zone - T.roadworks.lead },
  stalls: { before: 6, after: 6 },
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
  const kinds = eventKinds(track.id);
  const want = rng.chance(0.55) ? 2 : 1;
  const out: PlannedEvent[] = [];
  for (let i = 0; i < want; i++) {
    const kind = kinds.splice(rng.int(0, kinds.length - 1), 1)[0];
    if (!kind) break;
    const s = findSpot(rng, track, kind, out);
    if (s === null) continue;
    out.push({ kind, s });
  }
  return out;
}

/** A spot that keeps every rule: mid-track, far from the other events, out of a tunnel, clear of the finish. */
function findSpot(rng: Rng, track: Track, kind: EventKind, taken: readonly PlannedEvent[]): number | null {
  const L = track.length;
  const span = SPAN[kind];
  for (let tries = 0; tries < 60; tries++) {
    const s = rng.range(T.spotFrom * L, T.spotTo * L);
    if (s > L - T.finishClear) continue;
    if (s + span.after > L - 60) continue;
    if (taken.some((o) => Math.abs(o.s - s) < T.minGap)) continue;
    if (covered(track, s - span.before, s + span.after)) continue;
    return s;
  }
  return null;
}

/** Does a tunnel or a bridge sit between s0 and s1 (with a margin)? */
function covered(track: Track, s0: number, s1: number): boolean {
  const clear = T.featureClear;
  for (const f of track.features) {
    if (f.kind !== 'tunnel' && f.kind !== 'bridge') continue;
    if (s1 >= f.s0 - clear && s0 <= f.s1 + clear) return true;
  }
  return false;
}
