// Rivals (SPEC §18): the persistent grudge per species (SaveData.rivalry, updated at race end), the nemesis of this
// race (RaceConfig.nemesis) and the in-race alliances against a runaway player. Wired by race/logic.ts.
// SCAFFOLD: does nothing until the r4 rivals job lands (it owns this folder and race/ai/).
import type { AiDirector } from '../ai';
import type { RaceCtx } from '../ctx';

export interface Rivals {
  preStep(dt: number): void;
  postStep(dt: number): void;
  dispose(): void;
}

export function createRivals(ctx: RaceCtx, ai: AiDirector): Rivals {
  void ctx;
  void ai;
  return { preStep: () => undefined, postStep: () => undefined, dispose: () => undefined };
}
