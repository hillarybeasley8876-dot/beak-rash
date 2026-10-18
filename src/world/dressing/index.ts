// Dressing registry: one module per environment (coast = track unit, city / mountain = env units).
import type { TrackId } from '../../core/types';
import type { WorldCtx } from '../ctx';
import type { TerrainField } from '../terrain/field';
import { dressCoast } from './coast';
import { dressCity } from './city';
import { dressMountain } from './mountain';

type Dressing = (ctx: WorldCtx, field: TerrainField) => Promise<void>;

const DRESSINGS: Record<TrackId, Dressing> = {
  coast: dressCoast,
  city: dressCity,
  mountain: dressMountain,
};

export function dressingFor(id: TrackId): Dressing {
  return DRESSINGS[id];
}
