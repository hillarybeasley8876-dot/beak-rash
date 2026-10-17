// Shared per-race state of the race unit (private to gameplay/race).
import type { Session } from '../../core/contracts';
import type { RiderId } from '../../core/types';

export interface RaceCtx {
  readonly session: Session;
  /** Race seconds since GO; keeps running after the player finishes (session.time stops). */
  clock: number;
  /** Race time when the first rider crossed the line. */
  winnerTime: number | null;
  /** Times each rider was busted this race. */
  readonly bustedCount: Map<RiderId, number>;
  /** race:end has been emitted. */
  ended: boolean;
  /** Final results were computed with projected times (player finished, others still racing). */
  projected: Set<RiderId>;
}

export function createRaceCtx(session: Session): RaceCtx {
  return {
    session,
    clock: 0,
    winnerTime: null,
    bustedCount: new Map(),
    ended: false,
    projected: new Set(),
  };
}
