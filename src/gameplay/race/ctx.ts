// Shared per-race state of the race unit (private to gameplay/race).
import type { Session } from '../../core/contracts';
import type { RiderId } from '../../core/types';

/**
 * A work zone on the road (SPEC §19): the stretch where the wall stands and the open lane is the only way
 * through. The AI is told about a zone when it is ANNOUNCED (the wall goes up 60 m later), so it rides the
 * open lane instead of the racing line: a hole in the closed side of the wall is a dead end, and a rider
 * that ends up in one cannot get out.
 */
export interface WorkZone {
  /** s of the first row of the zone. */
  s0: number;
  /** s of the last row of the zone. */
  s1: number;
  /** Half the width of the open lane (m). */
  half: number;
  /** The centre of the open lane at a point of the road (it tapers across the zone). */
  centre(at: number): number;
}

export interface RaceCtx {
  readonly session: Session;
  /** Race seconds since GO; keeps running after the player finishes (session.time stops). */
  clock: number;
  /** Race time when the first rider crossed the line. */
  winnerTime: number | null;
  /** Race time when the first HUMAN crossed the line (online: the 45 s grace starts here). */
  firstHumanFinish: number | null;
  /** An online race (SPEC §28): the sim runs for every human, not for the local player. */
  readonly online: boolean;
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
    firstHumanFinish: null,
    online: !!session.config.online,
    bustedCount: new Map(),
    ended: false,
    projected: new Set(),
  };
}
