// Ransom-note lettering: every glyph its own cut-out box (mixed fonts, palettes, ±rotation, ±scale).
// Seeded per text so a title keeps its look between visits.
import { Rng, hashString } from '../../core/rng';
import { h } from './dom';
import { jagged } from './shapes';

export type RansomStyle = 'bw' | 'wb' | 'wr' | 'rw' | 'yb';

export interface RansomOpts {
  seed?: number | string;
  /** Allowed palettes: bw = black ink on white paper, wb = white on black, wr = white on red, rw = red on white. */
  styles?: RansomStyle[];
  /** Force the palette of the first glyph (emphasis). */
  first?: RansomStyle;
  rot?: number;          // max |rotation| in degrees (default 8)
  scale?: number;        // max |scale - 1| (default 0.2)
  fonts?: 'mixed' | 'block' | 'brush';
  slam?: boolean;        // staggered slam-in animation
  className?: string;
}

const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
const CN_FONTS = ["'ZCOOL QingKe HuangYou'", "'Noto Sans SC'", "'ZCOOL KuaiLe'", "'Ma Shan Zheng'", "'ZCOOL QingKe HuangYou'", "'Zhi Mang Xing'"];
const CN_BLOCK = ["'ZCOOL QingKe HuangYou'", "'Noto Sans SC'", "'ZCOOL KuaiLe'"];
const CN_BRUSH = ["'Ma Shan Zheng'", "'Zhi Mang Xing'"];
const EN_FONTS = ["'Anton'", "'Bebas Neue'", "'Bangers'", "'Black Ops One'", "'Rubik Mono One'", "'Permanent Marker'", "'Anton'"];
const EN_BLOCK = ["'Anton'", "'Bebas Neue'", "'Black Ops One'", "'Rubik Mono One'"];

function fontFor(ch: string, mode: RansomOpts['fonts'], r: Rng): string {
  if (CJK.test(ch)) return r.pick(mode === 'brush' ? CN_BRUSH : mode === 'block' ? CN_BLOCK : CN_FONTS);
  return r.pick(mode === 'block' || mode === 'brush' ? EN_BLOCK : EN_FONTS);
}

/** Build a ransom-note word. Size it with font-size on the returned element (or a parent). */
export function ransom(text: string, o: RansomOpts = {}): HTMLSpanElement {
  const r = new Rng(hashString(String(o.seed ?? text)));
  const styles = o.styles ?? ['bw', 'wb', 'wr', 'bw', 'wb'];
  const rot = o.rot ?? 8;
  const sc = o.scale ?? 0.2;
  const root = h('span', { class: `br-rn${o.slam ? ' is-slam' : ''}${o.className ? ` ${o.className}` : ''}`, attrs: { 'aria-label': text, role: 'img' } });
  let prev: RansomStyle | null = null;
  let i = 0;
  for (const ch of Array.from(text)) {
    if (ch === ' ') {
      root.append(h('span', { class: 'br-rn-sp' }));
      continue;
    }
    let style: RansomStyle = i === 0 && o.first ? o.first : r.pick(styles);
    if (style === prev && styles.length > 1) style = r.pick(styles.filter((s) => s !== prev));
    prev = style;
    const g = h('span', {
      class: `br-rn-g s-${style}`,
      text: ch,
      attrs: { 'aria-hidden': 'true' },
      vars: {
        '--r': `${r.range(-rot, rot).toFixed(1)}deg`,
        '--k': (1 + r.range(-sc, sc)).toFixed(3),
        '--dy': `${r.range(-0.07, 0.07).toFixed(3)}em`,
        '--i': i,
        '--clip': jagged(r.int(0, 1e9), { jx: 7, jy: 7, notches: 0 }),
      },
      style: `font-family:${fontFor(ch, o.fonts ?? 'mixed', r)}`,
    });
    root.append(g);
    i++;
  }
  return root;
}
