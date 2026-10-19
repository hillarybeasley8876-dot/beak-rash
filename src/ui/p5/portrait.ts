// Character portraits: generated art from data/assets.ts when present, otherwise a code-drawn
// sticker in the character's colours. Broken image files also fall back (onerror).
import { PORTRAITS, assetUrl } from '../../data/assets';
import { ROSTER } from '../../data/roster';
import type { CharacterId } from '../../core/types';
import { headSvg, pelicanSvg } from './art';
import { h, reducedMotion, svg, wait } from './dom';

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
  /** Always the code-drawn sticker (a stand-in that never waits for a download). */
  drawn?: boolean;
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
  const url = o.drawn ? null : portraitUrl(id, mood);
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

/** A generated key-art image (data/assets.ts path) or null when missing; a broken file removes itself.
 * It stays hidden until fully decoded (a slow download never paints half an image), then fades in (150 ms);
 * `stand` (a drawn stand-in already on screen) goes away on that reveal, or stays as the fallback. */
export function artImage(rel: string | undefined, className: string, onFail?: () => void, stand?: Element): HTMLImageElement | null {
  if (!rel) return null;
  const url = assetUrl(rel);
  const img = h('img', { class: `${className} br-art-pending`, attrs: { src: url, alt: '', draggable: 'false', decoding: 'async' } });
  img.addEventListener('error', () => {
    console.warn(`[ui] art missing: ${url}`);
    img.remove();
    onFail?.();
  }, { once: true });
  const reveal = (): void => {
    if (!img.classList.contains('br-art-pending')) return;
    img.classList.remove('br-art-pending');
    stand?.remove();
    if (!reducedMotion()) img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'linear' });
  };
  // decode() waits for the whole file. If it refuses although every pixel arrived, show the art anyway;
  // a broken file takes the error path above.
  img.decode().then(reveal, () => {
    if (img.complete && img.naturalWidth > 0) reveal();
  });
  return img;
}

/** Resolves once `img` is decoded (or failed, or after capMs), so a screen's wipe never reveals an empty
 * art frame; the cap keeps a slow disk from holding the screen up. */
export function artReady(img: HTMLImageElement | null, capMs = 1200): Promise<void> {
  if (!img) return Promise.resolve();
  const decoded = img.decode().catch(() => undefined); // a broken file falls back via artImage's onerror
  return Promise.race([decoded, wait(capMs)]);
}

const warm = new Map<string, Promise<void>>();

/** Fetch + decode key art ahead of its screen (boot warms title, menu, garage, loading). */
export function preloadArt(rels: Array<string | undefined>, capMs = 1500): Promise<void> {
  const jobs = rels.filter((r): r is string => Boolean(r)).map((rel) => {
    let job = warm.get(rel);
    if (!job) {
      const img = new Image();
      img.src = assetUrl(rel);
      job = img.decode().catch((err: unknown) => console.warn(`[ui] art preload failed: ${rel}`, err));
      warm.set(rel, job);
    }
    return job;
  });
  return Promise.race([Promise.all(jobs).then(() => undefined), wait(capMs)]);
}
