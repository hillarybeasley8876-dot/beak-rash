// City dressing (霓虹夜城): turns layout marks + zones into the night city. Landmarks claim their
// footprint first, then street walls and towers, street furniture, signage, sky and rain. Every stage
// (and the long loops inside the heavy ones) yields to the browser and reports progress, so the loading
// screen keeps painting: no build task runs much over ~60-80 ms.
import { breathe, slicer } from '../../breathe';
import type { WorldCtx } from '../../ctx';
import { ensureFonts } from '../../fonts';
import type { TerrainField } from '../../terrain/field';
import { loadBillboardArt } from '../coast/signage';
import { buildRain } from '../../env/city-rain';
import { buildWetRoad } from '../../env/city-wet';
import { finishDressYielding, makeDress } from '../dress';
import { SlicedAtlas } from './atlas';
import { skyline, streetWalls } from './blocks';
import { REFLECT_LAYER } from './batch';
import { finishCity, makeCity, paintAtlases, type City } from './city';
import { ALL_CITY_TEXT, GANTRY } from './lines';
import { neonSigns } from './neon';
import { crossings, Pools, scramble, sidewalks } from './paint';
import { busStop, kerbProps, streetLamps, trafficLights } from './street';
import { muralAt, roundaboutAt, storeAt, subwayAt } from './landmarks';
import { cables, crowds, lanternStrings, marketGate, stalls } from './life';
import { finishScreen, neonGantry } from './gantries';
import { retainingWalls, tunnelFitOut } from './underpass';
import { viaduct } from './viaduct';
import { farFill } from './farfill';
import { farBank } from './farbank';
import { billboardCanyon } from './canyon';
import { hazardStripes, p5Pylons, streetP5Boards } from './p5';
import { bridgeLights } from './bridge';
import { BANNERS, citySignage } from './signs';
import { ROAD_SIGNS } from '../../../data/memes';

/** s of every layout mark of a kind (with its side). */
function marksOf(c: City, kind: string): Array<{ s: number; side: -1 | 1; len: number }> {
  return c.d.ctx.L.marks.filter((m) => m.kind === kind).map((m) => ({
    s: m.s, side: m.x < 0 ? -1 : 1, len: typeof m.data.len === 'number' ? m.data.len : 0,
  }));
}

/** Landmarks and structures claim their lots before the street walls go up. */
function landmarks(c: City, art: HTMLImageElement[]): void {
  const g = GANTRY;
  for (const m of marksOf(c, 'startGantry')) neonGantry(c, m.s, g.start.word, g.start.sub, g.start.back, g.start.backSub);
  for (const m of marksOf(c, 'finishGantry')) {
    neonGantry(c, m.s, g.finish.word, g.finish.sub, g.finish.back, g.finish.backSub);
    finishScreen(c, m.s + 22, art, 'FINISH!', g.finish.sub);
  }
  viaduct(c);
  bridgeLights(c);
  for (const m of marksOf(c, 'store')) storeAt(c, m.s, m.side);
  for (const m of marksOf(c, 'subway')) subwayAt(c, m.s, m.side);
  for (const m of marksOf(c, 'mural')) muralAt(c, m.s, m.side);
  for (const m of c.d.ctx.L.marks.filter((k) => k.kind === 'roundabout')) roundaboutAt(c, m.s, m.x);
}

/** Stalls, people, kerb props (filling what is left), the night-market gates and lanterns, cables; `tick` yields. */
async function life(c: City, tick: () => Promise<void>): Promise<void> {
  const stops = marksOf(c, 'busStop');
  const nStalls = stalls(c);
  await tick();
  const people = crowds(c, marksOf(c, 'crossing').map((m) => m.s), marksOf(c, 'scramble').map((m) => m.s), stops, marksOf(c, 'subway'));
  await tick();
  const nTrees = kerbProps(c);
  await tick();
  for (const m of marksOf(c, 'stalls')) {
    marketGate(c, m.s - 12, '鹈鹕夜市', 'NIGHT MARKET');
    marketGate(c, m.s + m.len + 8, '鹈鹕夜市', 'SEE YOU TONIGHT');
    lanternStrings(c, m.s - 8, m.s + m.len + 4);
  }
  const nCables = cables(c);
  c.d.ctx.log(`city life: ${people} pedestrians, ${nStalls} stalls, ${nTrees} trees, ${nCables} cable runs`);
}

/** Road paint and street furniture (after the buildings, so props keep clear of their lots). */
function streets(c: City, pools: Pools): void {
  const { ctx } = c.d;
  const cross = marksOf(c, 'crossing').map((m) => m.s);
  sidewalks(ctx);
  crossings(ctx, cross);
  for (const m of marksOf(c, 'scramble')) scramble(ctx, m.s, 44);
  marksOf(c, 'busStop').forEach((m, k) => busStop(c, m.s, m.side, k));
  trafficLights(c, cross);
  citySignage(c);
  const lamps = streetLamps(c, pools);
  retainingWalls(c);
  tunnelFitOut(c);
  ctx.log(`city streets: ${lamps} lamps, ${cross.length} crossings`);
}

/** Stage markers (as in dressMountain): `done` logs the stage's build time (debug), reports progress and
 *  yields so the loading screen keeps painting; `restart` drops time spent waiting (fonts) from the next stage. */
function stages(ctx: WorldCtx): { done(name: string, f: number): Promise<void>; restart(): void } {
  let t = performance.now();
  return {
    async done(name, f) {
      ctx.log(`city ${name}: ${Math.round(performance.now() - t)} ms`);
      ctx.progress(f);
      await breathe();
      t = performance.now();
    },
    restart() { t = performance.now(); },
  };
}

export async function dressCity(ctx: WorldCtx, field: TerrainField): Promise<void> {
  // Fonts load while the city builds: the deferred atlases record every face and paint them at the end,
  // repainting once more only if the fonts were late (machine under load).
  const fonts = ensureFonts([...ALL_CITY_TEXT, ...BANNERS, ...ROAD_SIGNS, '前方起飞 0123456789. KM'], 4000);
  const art = await loadBillboardArt(ctx.id);
  const t0 = performance.now();
  const st = stages(ctx), tick = slicer();
  const faces = new SlicedAtlas();
  const d = makeDress(ctx, field, faces, ctx.rng.fork(0xc17e));
  const c = makeCity(d);
  const pools = new Pools(ctx);
  landmarks(c, art);
  await st.done('landmarks', 0.06);
  await streetWalls(c, tick);
  await st.done('street walls', 0.16);
  const canyon = billboardCanyon(c, art);
  const boards = streetP5Boards(c), pylons = p5Pylons(c);
  const jump = ctx.L.features.find((f) => f.kind === 'jumpCrest');
  const peak = jump?.data?.peak;
  hazardStripes(c, typeof peak === 'number' ? peak : null, c.d.rng.fork(0x4a2));
  await st.done('canyon, P5 boards + pylons', 0.22);
  await skyline(c, tick);
  await st.done('skyline', 0.28);
  const blocks = await farFill(c, tick) + await farBank(c, tick);
  await st.done('far fill + bank', 0.34);
  neonSigns(c, art);
  await st.done('neon', 0.42);
  streets(c, pools);
  await st.done('streets', 0.5);
  await life(c, tick);
  await st.done('life', 0.56);
  pools.build();
  const fontsReady = await fonts;
  st.restart();
  await paintAtlases(c, faces, fontsReady);
  await st.done('pools + atlases', 0.62);
  const cityMeshes = await finishCity(c, (f) => ctx.progress(0.62 + 0.2 * f));
  const meshes = [...cityMeshes, ...await finishDressYielding(d, (f) => ctx.progress(0.82 + 0.14 * f))];
  // Lamps and lit props glow in the wet road too.
  for (const m of meshes) if (m.name.startsWith('glow:')) m.layers.enable(REFLECT_LAYER);
  await st.done('batches', 0.96);
  buildWetRoad(ctx, REFLECT_LAYER);
  buildRain(ctx);
  ctx.log(`city dressing: ${meshes.length} batched meshes, ${c.slots.length} sign slots, ${blocks} fill blocks, ${canyon} canyon scaffolds, ${boards} P5 boards, ${pylons} P5 pylons, ${Math.round(performance.now() - t0)} ms`);
}
