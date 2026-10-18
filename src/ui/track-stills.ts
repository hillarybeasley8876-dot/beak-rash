// Track illustrations for cards (career, quick race): in-engine stills rendered by tools/ui-track-stills.mjs,
// with a halftone shade (CSS .br-still). A missing or broken still falls back to the vector scene.
import type { TrackId } from '../core/types';
import { h, svg, trackArtSvg } from './p5';
import cityUrl from './assets/track-city.webp';
import coastUrl from './assets/track-coast.webp';
import mountainUrl from './assets/track-mountain.webp';

const STILLS: Record<TrackId, string> = { coast: coastUrl, city: cityUrl, mountain: mountainUrl };

/** Fills its box (size it with CSS); `.br-still` carries the halftone + tint hooks. */
export function trackArt(id: TrackId): HTMLDivElement {
  const box = h('div', { class: `br-still is-${id}` });
  const img = h('img', { class: 'br-still-img', attrs: { src: STILLS[id], alt: '', draggable: 'false', decoding: 'async' } });
  img.addEventListener('error', () => {
    console.warn(`[ui] track still missing for ${id}, using the vector art`);
    img.replaceWith(svg(trackArtSvg(id), 'br-still-img'));
  }, { once: true });
  box.append(img, h('i', { class: 'br-still-dots' }));
  return box;
}
