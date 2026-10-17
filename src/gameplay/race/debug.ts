// window.__br.race — inspection/automation hooks for critics and the soak test (race unit only).
import type { RaceResult } from '../../core/contracts';
import type { RiderId } from '../../core/types';
import type { SpectateTarget } from './spectate';

export interface RaceDebug {
  skipIntro(): void;
  introFocus(): RiderId | null;
  results(): RaceResult[];
  /** Per-rider AI state summary (hunt target, plan, band). */
  ai(): Array<Record<string, unknown>>;
  traffic(): Array<Record<string, unknown>>;
  police(): Record<string, unknown> | null;
  /** Force police heat on the player (tests). */
  setHeat(v: number): void;
  /** Make an AI-driven rider (or the autopilot player) brake hard for `seconds`. */
  brake(id: RiderId, seconds: number): void;
  clock(): number;
  /** Debug camera: a rider id (chase), 'aerial', 'side', or null to return to the rig. */
  spectate(target: SpectateTarget): void;
}

type WithRace = { race?: RaceDebug };

export function exposeRaceDebug(api: RaceDebug): () => void {
  const br = window.__br as (WithRace & object) | undefined;
  if (!br) return () => undefined;
  br.race = api;
  return () => {
    if (br.race === api) delete br.race;
  };
}
