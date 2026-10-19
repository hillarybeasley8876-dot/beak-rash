// Sunset Pass dressing (落日山道): repaints the terrain and sky for golden hour, then turns layout
// marks + zones into scenery. Landmarks and sky life (marks) claim their footprint first, then the
// tunnel, portals, start/finish, signage, rock walls, forests and verges.
import { BILLBOARD_LINES, TRACK_BILLBOARDS } from '../../../data/memes';
import { breathe } from '../../breathe';
import type { WorldCtx } from '../../ctx';
import { buildSkyFill } from '../../env/mountain-fill';
import { gradeMountainTerrain } from '../../env/mountain-grade';
import { MountainTerrain } from '../../env/mountain-relief';
import { buildMountainLake } from '../../env/mountain-lake';
import { buildRidges } from '../../env/mountain-ridges';
import { buildMountainSky } from '../../env/mountain-sky';
import { ensureFonts } from '../../fonts';
import { SignAtlas } from '../../scenery/signs/atlas';
import type { TerrainField } from '../../terrain/field';
import { flags } from '../coast/event';
import { banners, distanceMarkers, loadBillboardArt } from '../coast/signage';
import { finishDressYielding, makeDress } from '../dress';
import { rockBatch, rockWalls } from './crags';
import { boulders, farForest, roadsideTrees } from './forest';
import { LEG_TEXTS, switchbackLegs } from './legs';
import { installMountainLod } from './lod';
import { MARK_TEXTS, marks } from './marks';
import { portals } from './portal';
import { verges } from './scatter';
import { billboards } from './signage';
import { TUNNEL_TEXTS, tunnelFitOut } from './tunnel';
import { pickLine, zones } from './util';

// Two of content's mountain poster lines hang on the start/finish banners instead (never on a poster too),
// picked by content (the list is not positional).
const BANNER_PICKS = ['漂移', '海拔'].map((k) => pickLine(TRACK_BILLBOARDS.mountain, k)).filter((t): t is string => !!t);
const BANNERS = ['暴力鹈鹕 BEAK RASH', '落日山道 欢迎你', ...BANNER_PICKS, 'SHOWTIME!', '登山不易 骑车更难'];

/** Stage markers: `done` logs the stage's build time (debug), reports progress and yields so the loading
 *  screen keeps painting; `restart` drops time spent waiting (art, fonts) from the next stage. */
function stages(ctx: WorldCtx): { done(name: string, f: number): Promise<void>; restart(): void } {
  let t = performance.now();
  return {
    async done(name, f) {
      ctx.log(`mountain ${name}: ${Math.round(performance.now() - t)} ms`);
      ctx.progress(f);
      await breathe();
      t = performance.now();
    },
    restart() { t = performance.now(); },
  };
}

export async function dressMountain(ctx: WorldCtx, field: TerrainField): Promise<void> {
  const st = stages(ctx);
  if (field.mod instanceof MountainTerrain) ctx.log(field.mod.summary);
  gradeMountainTerrain(ctx, field.noise);
  await st.done('terrain grade', 0.08);
  buildMountainSky(ctx);
  buildSkyFill(ctx);
  buildRidges(ctx);
  buildMountainLake(ctx);
  await st.done('sky, ridges, lake', 0.16);
  const art = await loadBillboardArt('mountain');
  await ensureFonts([...MARK_TEXTS, ...TUNNEL_TEXTS, ...LEG_TEXTS, ...BANNERS, ...TRACK_BILLBOARDS.mountain, ...BILLBOARD_LINES, 'SUNSET PASS VIEWPOINT KM']);
  st.restart();
  const d = makeDress(ctx, field, new SignAtlas(2048, 3072), ctx.rng.fork(0x3a7c));
  const L = ctx.L;
  marks(d);
  await st.done('landmarks', 0.24);
  tunnelFitOut(d);
  await st.done('tunnel', 0.3);
  const rocks = rockBatch(d);
  portals(d, rocks);
  for (const name of ['start', 'finish']) {
    for (const z of zones(ctx, name)) {
      for (const side of [-1, 1] as const) {
        flags(d, side, z.s0, z.s1, 13);
        banners(d, side, z.s0 + 6, z.s1 - 6, d.rng.shuffle(BANNERS));
      }
    }
  }
  rockWalls(d, rocks, ['cliff', 'cutting', 'portal'].flatMap((name) => zones(ctx, name)));
  switchbackLegs(d, rocks);
  distanceMarkers(d);
  billboards(d, art, BANNER_PICKS);
  for (const name of ['cliff', 'cutting', 'bridgeExit', 'summit', 'crest']) {
    for (const z of zones(ctx, name)) boulders(d, z.s0, z.s1);
  }
  await st.done('walls, legs, signs', 0.42);
  roadsideTrees(d, L.sMin, L.sMin + L.n - 1);
  await st.done('roadside trees', 0.52);
  verges(d, 0, ctx.L.length);
  farForest(d, L.sMin, L.sMin + L.n - 1);
  await st.done('verges + far forest', 0.62);
  const meshes = await finishDressYielding(d, (f) => ctx.progress(0.62 + 0.34 * f));
  await rocks.finishYielding();
  installMountainLod(ctx, meshes);
  ctx.log(`mountain dressing: ${meshes.length} batched meshes, sign atlas ${d.atlas.usedHeight}/${d.atlas.height} px`);
}
