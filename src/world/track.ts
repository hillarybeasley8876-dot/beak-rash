// Builds a Track: layout → queries → road, environment, terrain, features, scenery (per-track
// dressing). Everything the track creates is owned by it and disposed with it.
import { Group } from 'three';
import { hashString, Rng } from '../core/rng';
import type { AppContext, Track } from '../core/contracts';
import type { TrackId } from '../core/types';
import { createCtx } from './ctx';
import { renderHeightMap } from './env/heightmap';
import { buildLights } from './env/lights';
import { buildSea } from './env/sea';
import { buildSky } from './env/sky';
import { buildLayout } from './layout/build';
import { TrackQuery } from './layout/query';
import { layoutFor } from './layouts';
import { publishDebug } from './debug';
import { installFogCull } from './lod';
import { lookFor } from './looks';
import { buildEdges } from './road/edges';
import { dressingFor } from './dressing';
import { buildFeatures } from './features';
import { ensureFonts } from './fonts';
import { buildRoad } from './road/road';
import { buildFarTerrain } from './terrain/far';
import { TerrainField } from './terrain/field';
import { makeGround } from './terrain/ground';
import { buildNearTerrain } from './terrain/near';

export async function createTrack(app: AppContext, id: TrackId, rng: Rng): Promise<Track> {
  const t0 = performance.now();
  const L = buildLayout(layoutFor(id));
  const q = new TrackQuery(L);
  const group = new Group();
  group.name = `track:${id}`;
  const { ctx, updaters, owned } = createCtx({
    app, id, L, q, look: lookFor(id), rng: new Rng(hashString(`track:${id}`)), raceRng: rng.fork(0x7a3c),
    quality: app.quality, group,
  });
  const restoreEnv = buildLights(ctx);
  buildSky(ctx);
  buildRoad(ctx);
  const field = new TerrainField(L, q);
  const ribbons = buildNearTerrain(ctx, field);
  const far = buildFarTerrain(ctx, field);
  Object.assign(ctx, makeGround(ctx, field, ribbons, far));
  buildSea(ctx, renderHeightMap(ctx, group));
  buildEdges(ctx, field);
  await ensureFonts(['START', 'FINISH']);
  buildFeatures(ctx, field);
  await dressingFor(id)(ctx, field);
  installFogCull(ctx, group);
  const unpublish = publishDebug(L);
  console.info(`[track] ${id} built in ${Math.round(performance.now() - t0)} ms, ${L.length.toFixed(0)} m`);
  let disposed = false;
  return {
    id,
    length: L.length,
    runoff: q.runoff,
    look: ctx.look,
    group,
    features: L.features,
    frameAt: (s, out) => q.frameAt(s, out),
    toWorld: (s, x, y, out) => q.toWorld(s, x, y, out),
    project: (p, hintS) => q.project(p, hintS),
    bounds: (s) => q.bounds(s),
    surfaceAt: (s, x) => q.surfaceAt(s, x),
    update(dtSim, dtReal, camera) {
      for (const fn of updaters) fn(dtSim, dtReal, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restoreEnv();
      unpublish();
      group.removeFromParent();
      for (const res of owned) res.dispose();
      owned.length = 0;
      updaters.length = 0;
    },
  };
}
