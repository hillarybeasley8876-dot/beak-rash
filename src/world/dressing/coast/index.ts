// Coast dressing (鹈鹕湾): turns layout marks + zones into scenery. Order matters: landmarks and
// mark-placed road signs claim their footprint first, then towns, signage, nature, the sea and the sky life.
import { BILLBOARD_LINES, ROAD_SIGNS } from '../../../data/memes';
import { breathe } from '../../breathe';
import type { WorldCtx } from '../../ctx';
import { ensureFonts } from '../../fonts';
import { SignAtlas } from '../../scenery/signs/atlas';
import type { TerrainField } from '../../terrain/field';
import { finishDressYielding, makeDress, repaintWhenFontsLoad, type Dress } from '../dress';
import { megaOf, megaSetPiece } from '../mega';
import { atSea, finishArchAt, flags, gantryAt, gulls, lighthouseAt, pierAt, STAND_BANNERS, stands } from './event';
import { farForest, hedges, hillsides, islands, midGround, palms, rocks } from './nature';
import { groundCover, oliveTerraces } from './cover';
import { bridgeShores, cragTops } from './crags';
import { hillVillages } from './hamlets';
import { banners, billboards, chevrons, distanceMarkers, loadBillboardArt, roadSign, warning } from './signage';
import { beachLife } from './beach';
import { lamps, market, QUAY_POST_U, sandShoulder, villas } from './town';
import { tunnelFitOut } from './tunnel';
import { TUNNEL_NAME, TUNNEL_SIGNS } from './tunnel-signs';

const BANNERS = ['暴力鹈鹕 BEAK RASH', '鹈鹕湾 欢迎你', '今日宜：撞人', '珍爱生命 远离大鹅', 'V我50 小鱼干', 'SHOWTIME!'];
const TERRACE_ZONES = new Set(['promenade', 'beach', 'bay', 'chicane', 'crest', 'descent', 'hillside', 'village', 'sprint']);
const HEDGE_ZONES = new Set(['promenade', 'beach', 'bay', 'chicane', 'crest', 'hillside', 'village', 'sprint']);

/**
 * Every run of a zone name, in street order; consecutive runs of the same name are merged. A route
 * may bring the same zone back later on the road (the cliff road runs twice), and the dressing has
 * to follow the road it stands on, not the whole span between the two runs.
 */
function zones(ctx: WorldCtx, name: string): Array<{ s0: number; s1: number }> {
  const out: Array<{ s0: number; s1: number }> = [];
  for (const z of ctx.L.zones) {
    if (z.name !== name) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(last.s1 - z.s0) < 0.5) last.s1 = z.s1;
    else out.push({ s0: z.s0, s1: z.s1 });
  }
  return out;
}

/** Layout marks → landmarks and signs; returns the hill-village sites and gull flocks they list. */
function marks(d: Dress): { villages: number[]; flocks: Array<[number, number]> } {
  const { ctx } = d;
  const L = ctx.L;
  const villages: number[] = [], flocks: Array<[number, number]> = [];
  for (const m of L.marks) {
    const side: -1 | 1 = m.x < 0 ? -1 : 1;
    const len = typeof m.data.len === 'number' ? m.data.len : 100;
    switch (m.kind) {
      case 'startGantry': gantryAt(d, m.s, 'START', '暴力鹈鹕 · 鹈鹕湾海滨公路', 'BEAK RASH', '本路段已被 AI 画过 请谨慎骑行'); break;
      case 'finishGantry': finishArchAt(d, m.s, 'FINISH 终点', '别急，鱼会有的', 'GG', '鹈鹕湾 欢迎再来'); break;
      case 'stands': stands(d, side, m.s, m.s + Math.min(len, 72)); break;
      case 'lighthouse': lighthouseAt(d, m.s, m.x); break;
      case 'pier': pierAt(d, m.s); break;
      case 'stalls': market(d, m.s, m.s + len); break;
      case 'villas': villas(d, side, m.s, m.s + len); break;
      case 'umbrellas': beachLife(d, side, m.s, m.s + len); break;
      case 'towels': sandShoulder(d, side, m.s, m.s + len); break;
      case 'palms': palms(d, side, m.s, m.s + len, 2, 10, 11); break;
      case 'chevrons': chevrons(d, side, m.s, m.s + len); break;
      case 'warnCrest': warning(d, m.s, side, '飞', '前方起飞'); break;
      case 'warnRamp': warning(d, m.s, side, '跳', '跳台 · 别怂'); break;
      case 'sailboats': atSea(d, side, m.s - 60, m.s + 60, 18, 52, 22); break;
      case 'sign': roadSign(d, m.s, side, String(m.data.sign ?? '')); break;
      case 'village': villages.push(m.s); break;
      case 'gulls': flocks.push([m.s, m.x]); break;
      case 'boats': break; // moored boats come with the market
      case 'paint': break; // painted road words: features/decals.ts
      default: console.warn('[track] unknown mark', m.kind);
    }
  }
  return { villages, flocks };
}

/** Every text the coast signs draw (world preload warms these fonts; the atlas paints once they are in). */
export const COAST_SIGN_TEXTS = [
  ...BILLBOARD_LINES, ...ROAD_SIGNS, ...BANNERS, ...TUNNEL_SIGNS, TUNNEL_NAME, ...STAND_BANNERS,
  '鹈鹕湾灯塔 ←限速随缘鱼鹕飞跳台别怂终点别急会有的欢迎再来本路段已被画过请谨慎骑行海滨公路',
];

export async function dressCoast(ctx: WorldCtx, field: TerrainField): Promise<void> {
  // Fonts load while the scenery builds: the deferred atlas records every sign face and paints them
  // all at the end (one deterministic paint), repainting once more only if the fonts were late.
  const fonts = ensureFonts(COAST_SIGN_TEXTS, 4000);
  const art = await loadBillboardArt(ctx.id);
  const d = makeDress(ctx, field, new SignAtlas(2048, 3072, true), ctx.rng.fork(0xd5e5));
  const L = ctx.L;
  const { villages, flocks } = marks(d);
  await breathe();
  ctx.progress(0.08);
  // Festive start / finish: flags and banners behind the barriers.
  for (const name of ['start', 'finish']) {
    for (const z of zones(ctx, name)) {
      for (const side of [-1, 1] as const) {
        flags(d, side, z.s0, z.s1, 11, name === 'finish');
        banners(d, side, z.s0 + 6, z.s1 - 6, d.rng.shuffle(BANNERS));
      }
    }
  }
  // Palm boulevards on the land side through town, lamps along promenades and quays.
  for (const name of ['promenade', 'village', 'sprint', 'finish']) {
    for (const z of zones(ctx, name)) palms(d, d.side(1), z.s0, z.s1, 0.9, 2.2, 15);
  }
  for (const name of ['promenade', 'village', 'sprint']) {
    for (const z of zones(ctx, name)) lamps(d, d.side(1), z.s0, z.s1, 0.9, 30);
  }
  for (const z of zones(ctx, 'market')) lamps(d, d.side(-1), z.s0, z.s1, QUAY_POST_U, 30, true);
  distanceMarkers(d);
  billboards(d, art);
  await breathe();
  ctx.progress(0.22);
  for (const z of ctx.L.zones) {
    if (TERRACE_ZONES.has(z.name)) oliveTerraces(d, z.s0, z.s1);
    if (HEDGE_ZONES.has(z.name)) hedges(d, d.side(1), z.s0, z.s1);
  }
  hillsides(d, L.sMin, L.sMin + L.n - 1);
  await breathe();
  ctx.progress(0.32);
  // quality=low: no distant hill villages / mid-ground / groves and no ground cover (status: quality scaling).
  const low = ctx.quality === 'low';
  if (!low) {
    hillVillages(d, villages, d.side(1));
    midGround(d, L.sMin, L.sMin + L.n - 1);
    farForest(d, L.sMin, L.sMin + L.n - 1);
    await breathe();
    ctx.progress(0.42);
  }
  // The cliff road runs twice: each run of the zone gets its own rocks.
  for (const name of ['bay', 'hillside', 'cliff', 'crest', 'descent', 'chicane']) {
    for (const z of zones(ctx, name)) rocks(d, d.side(-1), z.s0, z.s1);
  }
  cragTops(d, L.sMin, L.sMin + L.n - 1);
  bridgeShores(d);
  tunnelFitOut(d);
  await breathe();
  ctx.progress(0.52);
  islands(d);
  atSea(d, d.side(-1), L.sMin, L.sMin + L.n - 1, 70, 320, 130);
  atSea(d, d.side(-1), L.sMin, L.sMin + L.n - 1, 25, 60, 260);
  gulls(d, flocks, d.rng);
  await breathe();
  ctx.progress(0.58);
  if (!low) groundCover(d, L.sMin, L.sMin + L.n - 1);
  await breathe();
  ctx.progress(0.66);
  // The mega jump's set piece: the boardwalk launch with the crowd on its deck.
  megaSetPiece(megaOf(d));
  const fontsReady = await fonts;
  d.atlas.flush();
  if (!fontsReady) repaintWhenFontsLoad(d);
  const meshes = await finishDressYielding(d, (f) => ctx.progress(0.66 + 0.34 * f));
  ctx.log(`coast dressing: ${meshes.length} batched meshes, sign atlas ${d.atlas.usedHeight}/${d.atlas.height} px`);
}
