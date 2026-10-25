// Builds a Track: layout → queries → road, environment, terrain, features, scenery (per-track
// dressing). Everything the track creates is owned by it and disposed with it. The build yields to
// the browser between stages (the loading screen keeps animating) and reports `flow:loading`.
import { Group } from 'three';
import { hashString, Rng } from '../core/rng';
import type { AppContext, Track, TrackOptions } from '../core/contracts';
import type { TrackId } from '../core/types';
import { breathe } from './breathe';
import { createCtx } from './ctx';
import { renderHeightMap } from './env/heightmap';
import { buildLights } from './env/lights';
import { buildSea } from './env/sea';
import { buildSky } from './env/sky';
import { buildLayout } from './layout/build';
import { TrackQuery } from './layout/query';
import { layoutFor } from './layouts';
import { reverseLayout } from './layout/reverse';
import { publishDebug } from './debug';
import { installFogCull } from './lod';
import { lookFor, roadLookFor } from './looks';
import { buildEdges } from './road/edges';
import { dressingFor } from './dressing';
import { buildFeatures } from './features';
import { warmFonts } from './fonts';
import { buildRoadMarks, roadWords } from './road/marks';
import { buildRoad } from './road/road';
import { warmBillboardArt } from './scenery/signs/art';
import { buildFarTerrain } from './terrain/far';
import { TerrainField } from './terrain/field';
import { makeGround } from './terrain/ground';
import { buildNearTerrain } from './terrain/near';
import { addPuddles, applyWeatherMaterials, gripFor, resolveWeather, weatherLook } from './weather';

export async function createTrack(app: AppContext, id: TrackId, rng: Rng, opts?: TrackOptions): Promise<Track> {
  const t0 = performance.now();
  warmBillboardArt();   // cached per page: downloads overlap the road / terrain stages
  const weather = resolveWeather(id, opts?.weather);   // SPEC §20: a track only builds the weathers it allows
  const reverse = !!opts?.reverse;                      // SPEC §20: the same road, driven the other way
  const L = buildLayout(reverse ? reverseLayout(layoutFor(id)) : layoutFor(id));
  const q = new TrackQuery(L);
  const group = new Group();
  group.name = `track:${id}`;
  // Loading progress: each stage spans [from, to]; builders report fractions inside it (ctx.progress).
  const span = { from: 0, to: 0.12, label: '' };
  const report = (f: number): void => {
    const k = Math.min(1, Math.max(0, Number.isFinite(f) ? f : 0));
    app.bus?.emit('flow:loading', { progress: span.from + (span.to - span.from) * k, label: span.label });   // sandboxes have no bus
  };
  const { ctx, updaters, owned } = createCtx({
    app, id, L, q, look: weatherLook(lookFor(id), weather), rng: new Rng(hashString(`track:${id}`)), raceRng: rng.fork(0x7a3c),
    quality: app.quality, group, progress: report, mirror: reverse ? -1 : 1,
  });
  addPuddles(ctx, weather);   // rain's standing water (features: the sim makes them slick)
  let restoreEnv: (() => void) | null = null;
  const teardown = (): void => {
    restoreEnv?.();
    restoreEnv = null;
    group.removeFromParent();
    for (const res of owned) res.dispose();
    owned.length = 0;
    updaters.length = 0;
  };
  const times: string[] = [];
  let tStage = t0;
  const stage = async (from: number, to: number, label: string, done: string): Promise<void> => {
    times.push(`${done} ${Math.round(performance.now() - tStage)}`);
    Object.assign(span, { from, to, label });
    report(0);
    await breathe();
    tStage = performance.now();
  };
  try {
    await stage(0.12, 0.3, '铺路中 ROAD', 'layout');
    // Painted road words repaint themselves if their font arrives late (features/textures.ts, road/marks.ts).
    warmFonts(['START', 'FINISH', ...L.marks.filter((m) => m.kind === 'paint').map((m) => String(m.data.text ?? '')), ...roadWords(id).flat()]);
    restoreEnv = buildLights(ctx);
    buildSky(ctx);
    const line = buildRoad(ctx);
    await breathe();   // road, road marks and near terrain are separate tasks (no long stall on a busy machine)
    buildRoadMarks(ctx, roadLookFor(id), line);
    await breathe();
    const field = new TerrainField(L, q);
    const ribbons = buildNearTerrain(ctx, field);
    await stage(0.3, 0.48, '堆山中 HILLS', 'road+near');
    const far = buildFarTerrain(ctx, field, ribbons);
    Object.assign(ctx, makeGround(ctx, field, ribbons, far));
    await stage(0.48, 0.62, '灌海水 SEA', 'far');
    // Sea, edges and features (tunnel shells, bridge) are separate tasks (no long stall on a busy machine).
    buildSea(ctx, renderHeightMap(ctx, group));
    await breathe();
    buildEdges(ctx, field);
    await breathe();
    buildFeatures(ctx, field);
    await stage(0.62, 0.9, '摆摊中 PROPS', 'sea+edges+features');
    await dressingFor(id)(ctx, field);
    applyWeatherMaterials(ctx, weather);   // wet asphalt (rain) / snow on the up-facing surfaces (snow)
    installFogCull(ctx, group);
    await stage(0.9, 0.9, '鹈鹕就位 READY', 'dressing');
  } catch (err) {
    console.error(`[track] build failed (${id})`, err);
    teardown();
    throw err;
  }
  const unpublish = publishDebug(L);
  ctx.log(`${id} built in ${Math.round(performance.now() - t0)} ms (${times.join(', ')}), ${L.length.toFixed(0)} m`);
  let disposed = false;
  return {
    id,
    length: L.length,
    runoff: q.runoff,
    look: ctx.look,
    group,
    features: L.features,
    weather,
    reverse,
    route: 0,
    grip: gripFor(weather),
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
      unpublish();
      teardown();
    },
  };
}
