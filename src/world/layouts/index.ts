// Layout registry. city / mountain are wave 2: until their layout files exist they reuse the coast
// layout under their own id (their look and dressing already differ, see looks.ts / dressing/).
import type { TrackId } from '../../core/types';
import type { LayoutDef } from '../layout/types';
import { COAST } from './coast';
import { CITY } from './city';
import { MOUNTAIN } from './mountain';

export function layoutFor(id: TrackId): LayoutDef {
  if (id === 'mountain') return MOUNTAIN;
  if (id === 'city') return CITY;
  return id === 'coast' ? COAST : { ...COAST, id };
}
