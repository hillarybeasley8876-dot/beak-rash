// Layout registry. city / mountain are wave 2: until their layout files exist they reuse the coast
// layout under their own id (their look and dressing already differ, see looks.ts / dressing/).
import type { TrackId } from '../../core/types';
import type { LayoutDef } from '../layout/types';
import { COAST } from './coast';

export function layoutFor(id: TrackId): LayoutDef {
  return id === 'coast' ? COAST : { ...COAST, id };
}
