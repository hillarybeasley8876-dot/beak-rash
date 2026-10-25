// fx unit entry: post-processing pipeline, particles, event reactions and the KO director.
// Contract: createFx(app) → FxSystem (core/contracts.ts).
import { fxDebugPart } from './debug';
import { KoDirector } from './ko/director';
import { KoTester } from './ko/tester';
import { busReactions } from './react/bus';
import { RiderEmitters } from './react/emitters';
import { r4Reactions } from './react/r4';
import { TrickTrails } from './react/tricks';
import { createFxCore } from './system';
import { WeatherLayer } from './weather';
import type { AppContext, FxSystem } from '../core/contracts';

export function createFx(app: AppContext): FxSystem {
  const { fx, ctx } = createFxCore(app);
  const director = new KoDirector(ctx);
  const tester = new KoTester(ctx);
  ctx.parts.push(
    busReactions(ctx), r4Reactions(ctx), new RiderEmitters(ctx), new TrickTrails(ctx),
    new WeatherLayer(app), director, tester, fxDebugPart(ctx, tester, director),
  );
  return fx;
}
