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
import { finishCity, makeCity } from './city';
import { ALL_CITY_TEXT } from './lines';
import { neonSigns } from './neon';

export async function dressCity(ctx: WorldCtx, field: TerrainField): Promise<void> {
  const [art] = await Promise.all([loadBillboardArt(ctx.id), ensureFonts(ALL_CITY_TEXT)]);
  const t0 = performance.now();
  const d = makeDress(ctx, field, new SignAtlas(2048, 2048), ctx.rng.fork(0xc17e));
  const c = makeCity(d);
  streetWalls(c);
  skyline(c);
  neonSigns(c, art);
  const meshes = [...finishCity(c), ...finishDress(d)];
  // Lamps and lit props glow in the wet road too.
  for (const m of meshes) if (m.name.startsWith('glow:')) m.layers.enable(REFLECT_LAYER);
  buildWetRoad(ctx, REFLECT_LAYER);
  console.info(`[track] city dressing: ${meshes.length} batched meshes, ${c.slots.length} sign slots, ${Math.round(performance.now() - t0)} ms`);
}
