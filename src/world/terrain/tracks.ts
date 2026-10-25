// Per-track switches for the shared far grid (terrain/far.ts): how the grid's outer border falls
// away at the horizon. (The farmland quilt's switch lives in terrain/farmland.ts.)
import type { TrackId } from '../../core/types';

/**
 * The height (m above sea level) the far grid's outer border falls to. The coasts sink under the
 * sea, so the world reads as a headland; the desert falls to a dry basin, so no ocean shows at the
 * horizon.
 */
export function borderSink(id: TrackId): number {
  return id === 'gobi' ? 60 : -26;
}
