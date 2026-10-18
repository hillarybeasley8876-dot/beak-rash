// City dressing (霓虹夜城): turns layout marks + zones into the night city. Landmarks claim their
// footprint first, then street walls and towers, street furniture, signage, sky and rain.
import type { WorldCtx } from '../../ctx';
import { ensureFonts } from '../../fonts';
import { SignAtlas } from '../../scenery/signs/atlas';
import type { TerrainField } from '../../terrain/field';
import { loadBillboardArt } from '../coast/signage';
import { buildWetRoad } from '../../env/city-wet';
import { finishDress, makeDress } from '../dress';
import { skyline, streetWalls } from './blocks';
import { REFLECT_LAYER } from './batch';
import { finishCity, makeCity, type City } from './city';
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

/** Stalls, people, kerb props (filling what is left), the night-market gates and lanterns, cables. */
function life(c: City): void {
  const stops = marksOf(c, 'busStop');
  const nStalls = stalls(c);
  const people = crowds(c, marksOf(c, 'crossing').map((m) => m.s), marksOf(c, 'scramble').map((m) => m.s), stops, marksOf(c, 'subway'));
  kerbProps(c);
  for (const m of marksOf(c, 'stalls')) {
    marketGate(c, m.s - 12, '鹈鹕夜市', 'NIGHT MARKET');
    marketGate(c, m.s + m.len + 8, '鹈鹕夜市', 'SEE YOU TONIGHT');
    lanternStrings(c, m.s - 8, m.s + m.len + 4);
  }
  const nCables = cables(c);
  console.info(`[track] city life: ${people} pedestrians, ${nStalls} stalls, ${nCables} cable runs`);
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
  tunnelFitOut(c, pools);
  console.info(`[track] city streets: ${lamps} lamps, ${cross.length} crossings`);
}

export async function dressCity(ctx: WorldCtx, field: TerrainField): Promise<void> {
  const [art] = await Promise.all([loadBillboardArt(ctx.id), ensureFonts([...ALL_CITY_TEXT, ...BANNERS, ...ROAD_SIGNS, '前方起飞 0123456789. KM'])]);
  const t0 = performance.now();
  const d = makeDress(ctx, field, new SignAtlas(2048, 2048), ctx.rng.fork(0xc17e));
  const c = makeCity(d);
  const pools = new Pools(ctx);
  landmarks(c, art);
  streetWalls(c);
  skyline(c);
  const blocks = farFill(c);
  neonSigns(c, art);
  streets(c, pools);
  life(c);
  pools.build();
  const meshes = [...finishCity(c), ...finishDress(d)];
  // Lamps and lit props glow in the wet road too.
  for (const m of meshes) if (m.name.startsWith('glow:')) m.layers.enable(REFLECT_LAYER);
  buildWetRoad(ctx, REFLECT_LAYER);
  console.info(`[track] city dressing: ${meshes.length} batched meshes, ${c.slots.length} sign slots, ${blocks} fill blocks, ${Math.round(performance.now() - t0)} ms`);
}
