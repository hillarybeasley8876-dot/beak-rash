// Character portraits: generated art from data/assets.ts when present, otherwise a code-drawn
// sticker in the character's colours. Broken image files also fall back (onerror).
import { PORTRAITS, assetUrl } from '../../data/assets';
import { ROSTER } from '../../data/roster';
import type { CharacterId } from '../../core/types';
import { headSvg, pelicanSvg } from './art';
import { h, svg } from './dom';

export type Mood = 'main' | 'smug' | 'hurt' | 'eyes';

export function portraitUrl(id: CharacterId, mood: Mood): string | null {
  const set = PORTRAITS[id];
  const rel = set?.[mood] ?? (mood === 'eyes' ? undefined : set?.main);
  return rel ? assetUrl(rel) : null;
}

function fallback(id: CharacterId, mood: Mood): SVGSVGElement {
  const markup = id === 'pelican' ? pelicanSvg({ mood: mood === 'eyes' ? 'main' : mood }) : headSvg(id);
  return svg(markup, 'br-portrait-svg');
}

export interface PortraitOpts {
  mood?: Mood;
  className?: string;
  /** Show the 中文名 plate under the art. */
  plate?: boolean;
}

/** A portrait element (fills its box; size it with CSS). */
export function portrait(id: CharacterId, o: PortraitOpts = {}): HTMLDivElement {
  const def = ROSTER[id];
  const mood = o.mood ?? 'main';
  const el = h('div', {
    class: `br-portrait${o.className ? ` ${o.className}` : ''}`,
    vars: { '--pc': def.colors.primary, '--pa': def.colors.accent, '--ps': def.colors.secondary },
    data: { character: id },
  });
  const url = portraitUrl(id, mood);
  if (url) {
    const img = h('img', { class: 'br-portrait-img', attrs: { src: url, alt: def.name, draggable: 'false' } });
    img.addEventListener('error', () => {
      console.warn(`[ui] portrait missing: ${url}`);
      img.replaceWith(fallback(id, mood));
      el.classList.add('is-fallback');
    }, { once: true });
    el.append(img);
  } else {
    el.classList.add('is-fallback');
    el.append(fallback(id, mood));
  }
  if (o.plate) el.append(h('span', { class: 'br-portrait-plate', text: def.name }));
  return el;
}

/** A generated key-art image (data/assets.ts path) or null when missing; a broken file removes itself. */
export function artImage(rel: string | undefined, className: string, onFail?: () => void): HTMLImageElement | null {
  if (!rel) return null;
  const url = assetUrl(rel);
  const img = h('img', { class: className, attrs: { src: url, alt: '', draggable: 'false', decoding: 'async' } });
  img.addEventListener('error', () => {
    console.warn(`[ui] art missing: ${url}`);
    img.remove();
    onFail?.();
  }, { once: true });
  return img;
}
