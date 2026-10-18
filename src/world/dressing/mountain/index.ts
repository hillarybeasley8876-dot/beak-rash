// Sunset Pass dressing (落日山道): repaints the terrain and sky for golden hour, then turns layout
// marks + zones into scenery. Landmarks claim their footprint first, then the village, signage,
// forests and rocks, then sky life.
import type { WorldCtx } from '../../ctx';
import { gradeMountainTerrain } from '../../env/mountain-grade';
import { buildMountainLake } from '../../env/mountain-lake';
import { buildRidges } from '../../env/mountain-ridges';
import { buildMountainSky } from '../../env/mountain-sky';
import { SignAtlas } from '../../scenery/signs/atlas';
import type { TerrainField } from '../../terrain/field';
import { finishDress, makeDress } from '../dress';
import { boulders, farForest, roadsideTrees } from './forest';
import { zones } from './util';

export async function dressMountain(ctx: WorldCtx, field: TerrainField): Promise<void> {
  gradeMountainTerrain(ctx, field.noise);
  buildMountainSky(ctx);
  buildRidges(ctx);
  buildMountainLake(ctx);
  const d = makeDress(ctx, field, new SignAtlas(2048, 2560), ctx.rng.fork(0x3a7c));
  const L = ctx.L;
  for (const name of ['cliff', 'cutting', 'bridgeExit', 'summit', 'crest']) {
    for (const z of zones(ctx, name)) boulders(d, z.s0, z.s1);
  }
  roadsideTrees(d, L.sMin, L.sMin + L.n - 1);
  farForest(d, L.sMin, L.sMin + L.n - 1);
  const meshes = finishDress(d);
  console.info(`[track] mountain dressing: ${meshes.length} batched meshes`);
}
