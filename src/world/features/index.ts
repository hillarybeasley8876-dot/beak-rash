// Gameplay feature visuals: road decals, ramps, the tunnel and the bridge. Crest jumps, pickup rows
// and checkpoints need no geometry (the road shape / combat pickups show them).
import type { WorldCtx } from '../ctx';
import { PropBatch } from '../kit/batch';
import { glowMat } from '../mats';
import type { TerrainField } from '../terrain/field';
import { buildBridge } from './bridge';
import { buildDecals } from './decals';
import { buildRamp } from './ramp';
import { buildTunnel } from './tunnel';

export function buildFeatures(ctx: WorldCtx, field: TerrainField): void {
  buildDecals(ctx);
  const props = new PropBatch(ctx, 'features');
  const structure = new PropBatch(ctx, 'structures', { outline: 0.06, cell: 400 });
  const lamps = new PropBatch(ctx, 'lamps', { outline: 0, material: glowMat(ctx), castShadow: false, receiveShadow: false });
  for (const f of ctx.L.features) {
    if (f.kind === 'ramp') buildRamp(ctx, props, f);
    else if (f.kind === 'tunnel') buildTunnel(ctx, structure, lamps, field, f);
    else if (f.kind === 'bridge') buildBridge(ctx, structure, field, f);
  }
  props.finish();
  structure.finish();
  lamps.finish();
}
