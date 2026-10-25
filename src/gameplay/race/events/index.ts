// Track events (SPEC §19): 1–2 seeded events per race ahead of the player — a fish truck tipping over, geese crossing,
// roadworks, market stalls. Wired by race/logic.ts (traffic is null when the race has no traffic).
// SCAFFOLD: does nothing until the r4 events job lands (it owns this folder).
import type { RaceCtx } from '../ctx';
import type { Traffic } from '../traffic';

export interface EventDirector {
  preStep(dt: number): void;
  postStep(dt: number): void;
  dispose(): void;
}

export function createEventDirector(ctx: RaceCtx, traffic: Traffic | null): EventDirector {
  void ctx;
  void traffic;
  return { preStep: () => undefined, postStep: () => undefined, dispose: () => undefined };
}
