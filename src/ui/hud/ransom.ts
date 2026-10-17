// Ransom-note lettering (SPEC §5): every glyph in its own box, mixed fonts, ±8° rotation, ±20 % scale,
// black-on-white / white-on-black / white-on-red. Deterministic per (text, seed) so a word keeps its
// look while it is on screen; callers pass a fresh seed per showing for variety on repeat.
import { hashString, Rng } from '../../core/rng';
import { el } from './dom';

export const FONT_EN = ['Anton', 'Bebas Neue', 'Bangers', 'Black Ops One'];
export const FONT_CN = ['ZCOOL QingKe HuangYou', 'Noto Sans SC', 'ZCOOL KuaiLe', 'Ma Shan Zheng'];

export type RansomScheme = 'mix' | 'hot' | 'mono' | 'ink';

export interface RansomOptions {
  seed?: number;
  /** mix = all three box styles; hot = mostly red; mono = black/white only; ink = mostly black. */
  scheme?: RansomScheme;
  /** Max rotation in degrees (default 8). */
  tilt?: number;
  /** Scale spread (default 0.2 = ±20 %). */
  spread?: number;
}

const CJK = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;

const STYLES: Record<RansomScheme, string[]> = {
  mix: ['w', 'b', 'r', 'w', 'b', 'r', 'b'],
  hot: ['r', 'r', 'w', 'r', 'b'],
  mono: ['w', 'b'],
  ink: ['w', 'w', 'b', 'w', 'r'],
};

/** Build the glyph boxes for `text` into `host` (replacing its content). Returns the glyph nodes. */
export function setRansom(host: HTMLElement, text: string, opts: RansomOptions = {}): HTMLElement[] {
  host.textContent = '';
  host.classList.add('rn');
  const rng = new Rng(hashString(text) ^ ((opts.seed ?? 1) * 2654435761));
  const tilt = opts.tilt ?? 8;
  const spread = opts.spread ?? 0.2;
  const styles = STYLES[opts.scheme ?? 'mix'];
  const glyphs: HTMLElement[] = [];
  let prevStyle = '';
  for (const ch of Array.from(text)) {
    if (ch === ' ') {
      el('span', 'rg-gap', host);
      continue;
    }
    const g = el('span', 'rg', host, ch);
    let style = rng.pick(styles);
    if (style === prevStyle) style = rng.pick(styles); // fewer identical neighbours
    prevStyle = style;
    const fonts = CJK.test(ch) ? FONT_CN : FONT_EN;
    const rot = rng.range(-tilt, tilt);
    const scale = 1 + rng.range(-spread, spread);
    const dy = rng.range(-0.06, 0.06);
    g.classList.add(`rg-${style}`);
    g.style.fontFamily = `"${rng.pick(fonts)}", "Noto Sans SC", sans-serif`;
    g.style.setProperty('--rg-tf', `translateY(${dy.toFixed(3)}em) rotate(${rot.toFixed(1)}deg) scale(${scale.toFixed(2)})`);
    glyphs.push(g);
  }
  return glyphs;
}

/** Convenience: a new <span> with ransom lettering. */
export function ransom(text: string, opts: RansomOptions = {}, cls = ''): { node: HTMLSpanElement; glyphs: HTMLElement[] } {
  const node = el('span', cls);
  const glyphs = setRansom(node, text, opts);
  return { node, glyphs };
}
