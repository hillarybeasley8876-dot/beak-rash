// Rivals (SPEC §18): the persistent grudge per species (SaveData.rivalry, written at race:end), the nemesis of
// this race (RaceConfig.nemesis) and the in-race alliance against a runaway player. Wired by race/logic.ts.
import type { AiDirector } from '../ai';
import type { RaceCtx } from '../ctx';
import { Alliance } from './alliance';
import { Nemesis } from './nemesis';
import { Rivalry } from './rivalry';

export interface Rivals {
  preStep(dt: number): void;
  postStep(dt: number): void;
  dispose(): void;
}

export function createRivals(ctx: RaceCtx, ai: AiDirector): Rivals {
  const { session } = ctx;
  const rivalry = new Rivalry(session);
  const nemesis = new Nemesis(ctx, ai);
  const alliance = new Alliance(session, ai);
  // One save update at the end of the race: the grudge of every rival species.
  const offs = [session.app.bus.on('race:end', () => rivalry.apply())];

  return {
    preStep(dt) {
      const time = ctx.clock;
      nemesis.update();
      alliance.update(dt, time);
      ai.setAlliance(alliance.view());
    },
    postStep() {
      // Everything happens before the physics step: the AI reads the alliance of this frame right after.
    },
    dispose() {
      for (const off of offs) off();
      offs.length = 0;
      rivalry.dispose();
      nemesis.dispose();
      alliance.dispose();
    },
  };
}
