// Layout registry: one layout file per track (coast = track unit, city / mountain = env units).
import type { TrackId } from '../../core/types';
import type { LayoutDef } from '../layout/types';
import { COAST } from './coast';
import { CITY } from './city';
import { MOUNTAIN } from './mountain';

const LAYOUTS: Record<TrackId, LayoutDef> = { coast: COAST, city: CITY, mountain: MOUNTAIN };

export function layoutFor(id: TrackId): LayoutDef {
  return LAYOUTS[id];
}
