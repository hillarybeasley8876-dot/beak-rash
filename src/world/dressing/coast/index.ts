// Coast dressing (鹈鹕湾): turns layout marks + zones into scenery. Order matters: big landmarks
// claim their footprint first, then towns, signage, nature, the sea and the sky life.
import { BILLBOARD_LINES, ROAD_SIGNS } from '../../../data/memes';
import type { WorldCtx } from '../../ctx';
import { ensureFonts } from '../../fonts';
import { SignAtlas } from '../../scenery/signs/atlas';
import type { TerrainField } from '../../terrain/field';
import { finishDress, makeDress, type Dress } from '../dress';
import { atSea, flags, gantryAt, gulls, lighthouseAt, pierAt, stands } from './event';
import { farForest, hillsides, islands, palms, rocks } from './nature';
import { hillVillages } from './hamlets';
import { banners, billboards, chevrons, distanceMarkers, loadBillboardArt, roadSigns, warning } from './signage';
import { beachLife, lamps, market, sandShoulder, villas } from './town';

const BANNERS = ['暴力鹈鹕 BEAK RASH', '鹈鹕湾 欢迎你', '今日宜：撞人', '珍爱生命 远离大鹅', 'V我50 小鱼干', 'SHOWTIME!'];

function zone(ctx: WorldCtx, name: string): { s0: number; s1: number } | null {
  const zs = ctx.L.zones.filter((z) => z.name === name);
  if (!zs.length) return null;
  return { s0: Math.min(...zs.map((z) => z.s0)), s1: Math.max(...zs.map((z) => z.s1)) };
}

function marks(d: Dress): void {
  const { ctx } = d;
  const L = ctx.L;
  for (const m of L.marks) {
    const side: -1 | 1 = m.x < 0 ? -1 : 1;
    const len = typeof m.data.len === 'number' ? m.data.len : 100;
    switch (m.kind) {
      case 'startGantry': gantryAt(d, m.s, 'START', '暴力鹈鹕 · 鹈鹕湾海滨公路', 'BEAK RASH', '本路段已被 AI 画过 请谨慎骑行'); break;
      case 'finishGantry': gantryAt(d, m.s, 'FINISH', '终点 · 别急，鱼会有的', 'GG', '鹈鹕湾 欢迎再来'); break;
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
      case 'boats': break; // moored boats come with the market
      default: console.warn('[track] unknown mark', m.kind);
    }
  }
}

export async function dressCoast(ctx: WorldCtx, field: TerrainField): Promise<void> {
  const art = await loadBillboardArt(ctx.id);
  await ensureFonts([...BILLBOARD_LINES, ...ROAD_SIGNS, ...BANNERS, '鹈鹕湾灯塔 ←限速随缘鱼鹕飞跳台别怂终点别急会有的欢迎再来本路段已被画过请谨慎骑行海滨公路']);
  const d = makeDress(ctx, field, new SignAtlas(2048, 2560), ctx.rng.fork(0xd5e5));
  const L = ctx.L;
  marks(d);
  // Festive start / finish: flags and banners behind the barriers.
  for (const name of ['start', 'finish']) {
    const z = zone(ctx, name);
    if (!z) continue;
    for (const side of [-1, 1] as const) {
      flags(d, side, z.s0, z.s1);
      banners(d, side, z.s0 + 6, z.s1 - 6, d.rng.shuffle(BANNERS));
    }
  }
  // Palm boulevards on the land side through town, lamps along promenades and quays.
  for (const name of ['promenade', 'village', 'sprint', 'finish']) {
    const z = zone(ctx, name);
    if (z) palms(d, 1, z.s0, z.s1, 0.9, 2.2, 15);
  }
  for (const name of ['promenade', 'village', 'sprint']) {
    const z = zone(ctx, name);
    if (z) lamps(d, 1, z.s0, z.s1, 0.9, 30);
  }
  const quay = zone(ctx, 'market');
  if (quay) lamps(d, -1, quay.s0, quay.s1, 0.12, 30, true);
  roadSigns(d);
  distanceMarkers(d);
  billboards(d, art);
  hillsides(d, L.sMin, L.sMin + L.n - 1);
  hillVillages(d, [330, 880, 1480, 2460, 3060]);
  farForest(d, L.sMin, L.sMin + L.n - 1);
  for (const name of ['bay', 'hillside', 'cliff', 'crest', 'descent']) {
    const z = zone(ctx, name);
    if (z) rocks(d, -1, z.s0, z.s1);
  }
  islands(d);
  atSea(d, -1, L.sMin, L.sMin + L.n - 1, 70, 320, 130);
  atSea(d, -1, L.sMin, L.sMin + L.n - 1, 25, 60, 260);
  gulls(d, [[300, -40], [1450, -70], [2240, 30], [2850, -45], [3220, -20]], d.rng);
  const meshes = finishDress(d);
  console.info(`[track] coast dressing: ${meshes.length} batched meshes`);
}
