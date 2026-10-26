// 江南水乡 WATER TOWN dressing (r4, SPEC §20). Turns the layout's marks and zones into a canal
// town: white-walled houses along the lanes, willows and black-awning boats on the canals, market
// stalls on the promenade, red lantern strings, the memorial archway, the tea house, the humpback
// stone bridges and the water surfaces. Everything ends up under one group, `dress:watertown`.
import { Group } from 'three';
import { BILLBOARD_LINES, TRACK_BILLBOARDS, TRACK_SIGNS } from '../../../data/memes';
import { breathe } from '../../breathe';
import type { WorldCtx } from '../../ctx';
import { ensureFonts } from '../../fonts';
import { installFogCull } from '../../lod';
import { loadBillboardArt } from '../../scenery/signs/art';
import { SignAtlas } from '../../scenery/signs/atlas';
import type { TerrainField } from '../../terrain/field';
import { finishArchAt, flags, gantryAt, stands } from '../coast/event';
import { banners, chevrons, roadSign, warning } from '../coast/signage';
import { finishDressYielding, makeDress, repaintWhenFontsLoad } from '../dress';
import { megaOf, megaSetPiece } from '../mega';
import { humpbackArch, stoneBridge, waterSheet } from './bridges';
import * as P from './places';
import { quaySteps } from './quay';

const BANNERS = ['暴力鹈鹕 BEAK RASH', '江南水乡 欢迎你', '今日宜：撞人', '小桥流水 骑车小心', 'V我50 小鱼干', 'SHOWTIME!'];
const GANTRY = ['START', '暴力鹈鹕 · 江南水乡', 'BEAK RASH', '小桥流水 骑车小心'];
const FINISH = ['FINISH 终点', '别急，鱼会有的', 'GG', '水乡欢迎再来'];

/** Every text the Water Town signs draw (the world preload warms these fonts). */
export const WATERTOWN_SIGN_TEXTS = [
  ...BILLBOARD_LINES, ...TRACK_BILLBOARDS.watertown, ...TRACK_SIGNS.watertown, ...BANNERS, ...GANTRY, ...FINISH,
  '水乡第一桥', '茶', '石桥 慢行', '前方落水 请勿超车', '夜雨桥下 请勿漂移',
];

/** Layout marks → scenery. */
function marks(d: ReturnType<typeof makeDress>): void {
  for (const m of d.ctx.L.marks) {
    const side: -1 | 1 = m.x < 0 ? -1 : 1;
    const len = typeof m.data.len === 'number' ? m.data.len : 100;
    switch (m.kind) {
      case 'house': P.houses(d, side, m.s, m.s + len); break;
      case 'willow': P.willows(d, side, m.s, m.s + len); break;
      case 'boat': P.boats(d, side, m.s, m.s + len); break;
      case 'stalls': P.stalls(d, side, m.s, m.s + len); break;
      case 'roofline': P.roofline(d, side, m.s, m.s + len); break;
      case 'lantern': P.lanternLine(d, m.s); break;
      case 'archway': P.archway(d, m.s); break;
      case 'teahouse': P.teahouse(d, m.s, side); break;
      case 'pagoda': P.pagoda(d, m.s, m.x); break;
      case 'sign': roadSign(d, m.s, side, String(m.data.sign ?? '')); break;
      case 'chevrons': chevrons(d, side, m.s, m.s + len); break;
      case 'warnCrest': warning(d, m.s, side, '桥', '石桥 慢行'); break;
      case 'startGantry': gantryAt(d, m.s, GANTRY[0] ?? 'START', GANTRY[1] ?? '', GANTRY[2] ?? '', GANTRY[3] ?? ''); break;
      case 'finishGantry': finishArchAt(d, m.s, FINISH[0] ?? 'FINISH', FINISH[1] ?? '', FINISH[2] ?? '', FINISH[3] ?? ''); break;
      case 'stands': stands(d, side, m.s, m.s + Math.min(len, 72)); break;
      default: console.warn('[watertown] unknown mark', m.kind);
    }
  }
}

/** The water: the canal strips along the quays, the river under the stone bridges and the side
 *  canals under the humpback stone bridges. */
function water(d: ReturnType<typeof makeDress>): void {
  const q = d.ctx.q;
  for (const side of [-1, 1] as const) {
    let s0 = -1;
    for (let s = 0; s <= q.length; s += 2) {
      const isQuay = q.edgeKindAt(s, side) === 'quay';
      if (isQuay && s0 < 0) s0 = s;
      if (!isQuay && s0 >= 0) {
        waterSheet(d, s0, s, (ss) => {
          const b = d.field.bound(ss, side);
          return side < 0 ? [-b - 10, -b + 0.4] : [b - 0.4, b + 10];
        });
        s0 = -1;
      }
    }
  }
  for (const f of d.ctx.L.features) {
    if (f.kind === 'jumpCrest') {
      // The mega jump's canal is the widest: the water runs under the whole flight.
      const mega = f.data?.mega === 1 || f.data?.mega === true;
      const pad = mega ? 26 : 2;
      waterSheet(d, f.s0 - pad, f.s1 + pad, (ss) => {
        const b = d.field.bound(ss, 1);
        return [-b - 8, b + 8];
      });
    } else if (f.kind === 'bridge') {
      waterSheet(d, f.s0 - 4, f.s1 + 4, () => [-32, 32], 10);
    }
  }
}

/** The stone landings down to the water, every few metres along the quays. */
function quays(d: ReturnType<typeof makeDress>): void {
  const q = d.ctx.q;
  for (const side of [-1, 1] as const) {
    for (let s = 30; s < q.length - 20; s += 34) {
      if (q.edgeKindAt(s, side) !== 'quay') continue;
      if (d.rng.chance(0.45)) continue;
      quaySteps(d, side, s + d.rng.range(-4, 4));
    }
  }
}

/**
 * The shared 'bridge' feature draws a red steel through-arch (a P5 landmark). The water town
 * takes those meshes out of the scene and draws its own stone bridges over the canals instead.
 */
function hideSteelBridges(ctx: WorldCtx): void {
  let n = 0;
  for (const child of [...ctx.group.children]) {
    if (child.name.startsWith('structures:')) {
      ctx.group.remove(child);
      n++;
    }
  }
  ctx.log(`watertown: took ${n} shared steel bridge meshes out of the scene (the town draws its own stone bridges)`);
}

export async function dressWatertown(ctx: WorldCtx, field: TerrainField): Promise<void> {
  const fonts = ensureFonts(WATERTOWN_SIGN_TEXTS, 4000);
  const art = await loadBillboardArt(ctx.id);
  const d = makeDress(ctx, field, new SignAtlas(2048, 3072, true), ctx.rng.fork(0x77e0));
  await breathe();
  ctx.progress(0.06);
  hideSteelBridges(ctx);
  marks(d);
  await breathe();
  ctx.progress(0.4);
  // The humpback stone bridges: a stone arch under every jump crest, and a stone bridge over
  // every canal crossing.
  for (const f of ctx.L.features) {
    if (f.kind === 'jumpCrest') humpbackArch(d, f);
    else if (f.kind === 'bridge') stoneBridge(d, f);
  }
  await breathe();
  ctx.progress(0.52);
  water(d);
  quays(d);
  await breathe();
  ctx.progress(0.6);
  // The start and the finish: gantries, stands, flags and banners behind the barriers.
  for (const name of ['start', 'finish']) {
    const z = ctx.L.zones.find((zz) => zz.name === name);
    if (!z) continue;
    for (const side of [-1, 1] as const) {
      flags(d, side, z.s0, z.s1, 11, name === 'finish');
      banners(d, side, z.s0 + 6, z.s1 - 6, d.rng.shuffle(BANNERS));
    }
  }
  P.billboards(d, art);
  // The track's own road signs along the lanes.
  for (const [i, text] of TRACK_SIGNS.watertown.entries()) {
    const s = 260 + i * 620;
    if (s > ctx.L.length - 200) break;
    P.wtSign(d, s, i % 2 ? 1 : -1, text);
  }
  await breathe();
  ctx.progress(0.68);
  // The mega jump's set piece: the tall humpback bridge with its lanterns.
  megaSetPiece(megaOf(d));
  const fontsReady = await fonts;
  d.atlas.flush();
  if (!fontsReady) repaintWhenFontsLoad(d);
  const meshes = await finishDressYielding(d, (f) => ctx.progress(0.68 + 0.32 * f));
  // Everything the dressing built lives in one group, so the track can be reviewed (and culled) as a whole.
  const group = new Group();
  group.name = 'dress:watertown';
  ctx.group.add(group);
  for (const mesh of meshes) group.add(mesh);
  installFogCull(ctx, group);
  ctx.log(`watertown dressing: ${meshes.length} batched meshes, sign atlas ${d.atlas.usedHeight}/${d.atlas.height} px`);
}
