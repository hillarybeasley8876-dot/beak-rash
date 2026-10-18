// Billboard art (data/assets.ts BILLBOARDS), decoded once per page and shared by every track build.
// Each image gets its own bounded wait: images that are ready are kept, late ones are skipped with a
// warning (they keep loading, so the next build has them), missing files warn once.
import { BILLBOARDS, assetUrl } from '../../../data/assets';
import type { TrackId } from '../../../core/types';

const cache = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(rel: string): Promise<HTMLImageElement | null> {
  let p = cache.get(rel);
  if (!p) {
    const img = new Image();
    img.src = assetUrl(rel);
    p = img.decode().then(() => img, (err: unknown) => {
      console.warn('[track] billboard art missing:', rel, err);
      return null;
    });
    cache.set(rel, p);
  }
  return p;
}

/** Start loading and decoding every track's billboard art (world preload; does not wait). */
export function warmBillboardArt(): void {
  for (const files of Object.values(BILLBOARDS)) for (const rel of files ?? []) void loadImage(rel);
}

/** Billboard art for a track: every image decoded within timeoutMs (each image waits on its own). */
export async function loadBillboardArt(id: string, timeoutMs = 2500): Promise<HTMLImageElement[]> {
  const files = BILLBOARDS[id as TrackId] ?? [];
  const imgs = await Promise.all(files.map(async (rel) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'late'>((resolve) => { timer = setTimeout(() => resolve('late'), timeoutMs); });
    const res = await Promise.race([loadImage(rel), late]);
    clearTimeout(timer);
    if (res === 'late') console.warn(`[track] billboard art not ready after ${timeoutMs} ms, skipped this build:`, rel);
    return res === 'late' ? null : res;
  }));
  return imgs.filter((i): i is HTMLImageElement => i !== null);
}
