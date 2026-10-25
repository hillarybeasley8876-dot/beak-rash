// Shared shapes of the track-event system (SPEC §19): the props one event puts on the road and the
// slot the director keeps for it.
import type { Session } from '../../../core/contracts';
import type { Rng } from '../../../core/rng';
import type { EventKind } from '../../../data/event-lines';

export type { EventKind };

/** The live props of one event: the meshes, the obstacles and the little drama on the road. */
export interface EventProps {
  /** Advance the props (sim seconds). */
  update(dt: number): void;
  /** True once the props are gone: the director emits 'end' and disposes them. */
  readonly done: boolean;
  /** Remove the meshes, the obstacles and the bus listeners. */
  dispose(): void;
}

/** What an event factory needs. */
export interface EventSetup {
  session: Session;
  /** The event spot: the position the event is announced and scheduled at. */
  s: number;
  /** A per-event random stream (the session rng forked), so events never shift each other's rolls. */
  rng: Rng;
  /** The first obstacle id of this event (every event gets its own range). */
  idBase: number;
}

/** One scheduled (or forced) event in the director. */
export interface EventSlot {
  kind: EventKind;
  /** The event spot on the track. */
  s: number;
  phase: 'planned' | 'warned' | 'started' | 'ended';
  props: EventProps | null;
}
