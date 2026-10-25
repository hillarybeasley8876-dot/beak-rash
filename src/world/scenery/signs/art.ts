// Billboard art (data/assets.ts BILLBOARDS), decoded once per page and shared by every track build.
// A build waits a bounded time for the decodes, then hands out every image that has not failed, ready or
// still decoding: faces drawn with pending art show a placeholder and repaint themselves when it lands
// (scenery/signs/faces.ts, SignAtlas). Missing files warn once and are left out.
import { BILLBOARDS, assetUrl } from '../../../data/assets';
import type { TrackId } from '../../../core/types';

interface Art { img: HTMLImageElement; ready: boolean; failed: boolean; done: Promise<HTMLImageElement | null> }

const byFile = new Map<string, Art>();
const byImg = new WeakMap<HTMLImageElement, Art>();

function artFor(rel: string): Art {
  const hit = byFile.get(rel);
  if (hit) return hit;
  const img = new Image();
  img.src = assetUrl(rel);
  const art: Art = { img, ready: false, failed: false, done: Promise.resolve(null) };
  art.done = img.decode().then(() => {
    art.ready = true;
    return img;
  }, (err: unknown) => {
    art.failed = true;
    console.warn('[track] billboard art missing:', rel, err);
    return null;
  });
  byFile.set(rel, art);
  byImg.set(img, art);
  return art;
}

/** True once `img` is decoded and drawable. */
export function artReady(img: HTMLImageElement): boolean {
  const art = byImg.get(img);
  return art ? art.ready : img.complete && img.naturalWidth > 0;
}

/** Settles when `img` is decoded (→ img) or has failed (→ null); at once for images already ready. */
export function whenArt(img: HTMLImageElement): Promise<HTMLImageElement | null> {
  return byImg.get(img)?.done ?? Promise.resolve(artReady(img) ? img : null);
}

/** Start loading and decoding every track's billboard art (world preload; does not wait). */
export function warmBillboardArt(): void {
  for (const files of Object.values(BILLBOARDS)) for (const rel of files ?? []) artFor(rel);
}

/** Billboard art for a track in file order: waits up to timeoutMs for the decodes, then returns every image
 *  that has not failed. Late ones come back still decoding (artReady false): faces use a placeholder. */
export async function loadBillboardArt(id: string, timeoutMs = 1500): Promise<HTMLImageElement[]> {
  const files = BILLBOARDS[id as TrackId] ?? [];
  const arts = files.map(artFor);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); });
  await Promise.race([Promise.all(arts.map((a) => a.done)), late]);
  clearTimeout(timer);
  const slow = files.filter((_, i) => !arts[i]?.ready && !arts[i]?.failed);
  if (slow.length) console.info(`[track] billboard art still decoding after ${timeoutMs} ms, placeholder faces until it lands:`, slow.join(', '));
  return arts.filter((a) => !a.failed).map((a) => a.img);
}
