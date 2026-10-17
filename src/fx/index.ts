// fx unit entry: post-processing pipeline, particles, event reactions and the KO director.
// Contract: createFx(app) → FxSystem (core/contracts.ts).
import { fxDebugPart } from './debug';
import { KoDirector } from './ko/director';
import { KoTester } from './ko/tester';
import { busReactions } from './react/bus';
import { RiderEmitters } from './react/emitters';
import { createFxCore } from './system';
import type { AppContext, FxSystem } from '../core/contracts';

export function createFx(app: AppContext): FxSystem {
  const { fx, ctx } = createFxCore(app);
  const director = new KoDirector(ctx);
  const tester = new KoTester(ctx);
  ctx.parts.push(busReactions(ctx), new RiderEmitters(ctx), director, tester, fxDebugPart(ctx, tester, director));
  return fx;
}
