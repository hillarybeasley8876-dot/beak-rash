// Sunset Pass dressing (落日山道): repaints the terrain and sky for golden hour, then turns layout
// marks + zones into scenery. Landmarks claim their footprint first, then the village, signage,
// forests and rocks, then sky life.
import { BILLBOARD_LINES, TRACK_BILLBOARDS } from '../../../data/memes';
import type { WorldCtx } from '../../ctx';
import { gradeMountainTerrain } from '../../env/mountain-grade';
import { buildMountainLake } from '../../env/mountain-lake';
import { buildRidges } from '../../env/mountain-ridges';
import { buildMountainSky } from '../../env/mountain-sky';
import { ensureFonts } from '../../fonts';
import { SignAtlas } from '../../scenery/signs/atlas';
import type { TerrainField } from '../../terrain/field';
import { flags } from '../coast/event';
import { banners, distanceMarkers, loadBillboardArt } from '../coast/signage';
import { finishDress, makeDress } from '../dress';
import { boulders, farForest, roadsideTrees } from './forest';
import { balloons, cableCar, turbines } from './life';
import { MARK_TEXTS, marks } from './marks';
import { billboards } from './signage';
import { zones } from './util';

const BANNERS = ['暴力鹈鹕 BEAK RASH', '落日山道 欢迎你', '秋名山？不，落日山', '山路十八弯 弯弯有大鹅', 'SHOWTIME!', '登山不易 骑车更难'];

export async function dressMountain(ctx: WorldCtx, field: TerrainField): Promise<void> {
  gradeMountainTerrain(ctx, field.noise);
  buildMountainSky(ctx);
  buildRidges(ctx);
  buildMountainLake(ctx);
  const art = await loadBillboardArt('mountain');
  await ensureFonts([...MARK_TEXTS, ...BANNERS, ...TRACK_BILLBOARDS.mountain, ...BILLBOARD_LINES, 'SUNSET PASS VIEWPOINT KM']);
  const d = makeDress(ctx, field, new SignAtlas(2048, 3072), ctx.rng.fork(0x3a7c));
  const L = ctx.L;
  marks(d);
  for (const name of ['start', 'finish']) {
    for (const z of zones(ctx, name)) {
      for (const side of [-1, 1] as const) {
        flags(d, side, z.s0, z.s1, 13);
        banners(d, side, z.s0 + 6, z.s1 - 6, d.rng.shuffle(BANNERS));
      }
    }
  }
  distanceMarkers(d);
  billboards(d, art);
  for (const name of ['cliff', 'cutting', 'bridgeExit', 'summit', 'crest']) {
    for (const z of zones(ctx, name)) boulders(d, z.s0, z.s1);
  }
  roadsideTrees(d, L.sMin, L.sMin + L.n - 1);
  farForest(d, L.sMin, L.sMin + L.n - 1);
  turbines(d, -1, 2450, 3300);
  cableCar(d, 2560, 1);
  balloons(d, [[140, -1], [420, -1], [2480, 1], [2760, 1], [3020, 1], [3260, 1], [3480, 1]]);
  const meshes = finishDress(d);
  console.info(`[track] mountain dressing: ${meshes.length} batched meshes`);
}
