// Track illustrations for cards (career, quick race): in-engine stills rendered by tools/ui-track-stills.mjs,
// given a P5 print treatment in CSS (.br-still: posterise filter defined here once, lifted exposure for the
// night / sunset tracks, halftone shade, red slash + ink frame). A broken still falls back to the vector scene.
import type { TrackId } from '../core/types';
import { h, svg, trackArtSvg } from './p5';
import cityUrl from './assets/track-city.webp';
import coastUrl from './assets/track-coast.webp';
import mountainUrl from './assets/track-mountain.webp';
import { STILL_URL as gobiUrl } from './tracks/gobi';
import { STILL_URL as watertownUrl } from './tracks/watertown';

const STILLS: Record<TrackId, string> = { coast: coastUrl, city: cityUrl, mountain: mountainUrl, watertown: watertownUrl, gobi: gobiUrl };

/** 6-level posterise (comic print look), referenced by kit.css as url(#br-poster). */
const POSTER = `<svg width="0" height="0" aria-hidden="true" style="position:absolute"><filter id="br-poster" color-interpolation-filters="sRGB">
<feComponentTransfer><feFuncR type="discrete" tableValues="0 .2 .4 .6 .8 1"/><feFuncG type="discrete" tableValues="0 .2 .4 .6 .8 1"/>
<feFuncB type="discrete" tableValues="0 .2 .4 .6 .8 1"/></feComponentTransfer></filter></svg>`;
let defs: SVGSVGElement | null = null;

function ensureDefs(): void {
  if (defs?.isConnected) return;
  defs = svg(POSTER, 'br-still-defs');
  document.body.append(defs);
}

/** Fills its box (size it with CSS); `.br-still` carries the halftone + tint hooks. */
export function trackArt(id: TrackId): HTMLDivElement {
  ensureDefs();
  const box = h('div', { class: `br-still is-${id}` });
  const img = h('img', { class: 'br-still-img', attrs: { src: STILLS[id], alt: '', draggable: 'false', decoding: 'async' } });
  img.addEventListener('error', () => {
    console.warn(`[ui] track still missing for ${id}, using the vector art`);
    img.replaceWith(svg(trackArtSvg(id), 'br-still-img'));
  }, { once: true });
  box.append(img, h('i', { class: 'br-still-dots' }));
  return box;
}
