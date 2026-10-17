// Character art for the HUD: round species badges (progress strip, tags, chips), portrait cards
// (cluster, KO splash, calling cards) and eyes strips (skill cut-ins). Generated portraits from
// data/assets.ts are used when present; otherwise the bold SVG fallbacks in heads.ts / eyes.ts.
import { assetUrl, PORTRAITS } from '../../data/assets';
import { ROSTER } from '../../data/roster';
import type { CharacterId } from '../../core/types';
import { el } from './dom';
import { eyesSvg } from './eyes';
import { headSvg } from './heads';

export type Mood = 'main' | 'smug' | 'hurt';

/** One-glyph species label (readable at 20 px) for chips and tiny markers. */
export const SPECIES_GLYPH: Record<CharacterId, string> = {
  pelican: '鹕', goose: '鹅', capybara: '卡', cat: '猫', shiba: '柴',
  pigeon: '鸽', penguin: '企', seagull: '鸥', sloth: '懒', corgi: '警',
};

function resolve(rel: string | undefined): string | null {
  if (!rel) return null;
  return /^(https?:|\/|data:|blob:)/.test(rel) || rel.includes('assets/') ? rel : assetUrl(rel);
}

export function portraitUrl(id: CharacterId, mood: Mood | 'eyes'): string | null {
  const set = PORTRAITS[id];
  if (!set) return null;
  return resolve(set[mood]) ?? (mood === 'eyes' ? null : resolve(set.main));
}

/** <img> that swaps itself for `fallback()` markup if the file fails to load. */
function imgOr(host: HTMLElement, url: string | null, cls: string, fallback: () => string): void {
  if (!url) {
    host.innerHTML = fallback();
    return;
  }
  const img = el('img', cls, host);
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('error', () => {
    console.warn(`[ui-hud] portrait missing, using fallback: ${url}`);
    host.innerHTML = fallback();
  }, { once: true });
  img.src = url;
}

function tint(node: HTMLElement, id: CharacterId): void {
  const c = ROSTER[id].colors;
  node.style.setProperty('--c1', c.primary);
  node.style.setProperty('--c2', c.secondary);
  node.style.setProperty('--c3', c.accent);
}

/** Round species badge: a face crop of the smug bust (busts centre the head), else the SVG head. */
export function badge(id: CharacterId, cls = ''): HTMLDivElement {
  const node = el('div', `bdg ${cls}`.trim());
  node.dataset.c = id;
  tint(node, id);
  const inner = el('div', 'bdg-in', node);
  imgOr(inner, portraitUrl(id, 'smug'), 'bdg-img', () => headSvg(id));
  return node;
}

/** Portrait card with one layer per mood; `setMood` swaps them without rebuilding. */
export class PortraitCard {
  readonly node: HTMLDivElement;
  private layers = new Map<Mood, HTMLDivElement>();
  private mood: Mood | null = null;

  constructor(readonly id: CharacterId, cls = '', moods: Mood[] = ['main']) {
    this.node = el('div', `pc ${cls}`.trim());
    this.node.dataset.c = id;
    tint(this.node, id);
    el('div', 'pc-bg', this.node);
    for (const m of moods) {
      const layer = el('div', `pc-l pc-${m}`, this.node);
      imgOr(layer, portraitUrl(id, m), 'pc-img', () => `<div class="pc-sil">${headSvg(id)}</div>`);
      this.layers.set(m, layer);
    }
    this.setMood(moods[0] ?? 'main');
  }

  setMood(m: Mood): void {
    if (m === this.mood || !this.layers.has(m)) return;
    this.mood = m;
    for (const [k, layer] of this.layers) layer.style.visibility = k === m ? 'inherit' : 'hidden';
    this.node.dataset.mood = m;
  }
}

/** Eyes close-up strip (wide). */
export function eyesStrip(id: CharacterId, cls = ''): HTMLDivElement {
  const node = el('div', `eyes ${cls}`.trim());
  tint(node, id);
  imgOr(node, portraitUrl(id, 'eyes'), 'eyes-img', () => eyesSvg(id));
  return node;
}
