// Full-bleed P5 backdrops: base colour, drifting halftone, a slowly rotating star burst, diagonal bands
// and speed lines. Pure DOM/CSS (compositor-friendly transforms only).
import { h, svg } from './dom';
import { jagged, starSvg } from './shapes';

export interface BackdropOpts {
  tone?: 'red' | 'black' | 'split';
  seed?: string;
  star?: { x: string; y: string; size: number; color?: string; spin?: number } | false;
  bands?: Array<{ top: string; height: number; color: string; rotate?: number }>;
  speedlines?: boolean;
  dots?: { color: string; size?: number; mask?: string };
}

export function backdrop(o: BackdropOpts = {}): HTMLDivElement {
  const tone = o.tone ?? 'red';
  const el = h('div', { class: `br-backdrop is-${tone}` });
  if (o.dots !== undefined || tone !== 'split') {
    const d = o.dots ?? { color: tone === 'red' ? 'rgba(0,0,0,.34)' : 'rgba(229,25,28,.42)' };
    el.append(h('div', {
      class: 'br-halftone is-drift',
      vars: { '--dot': d.color, '--dot-size': `${d.size ?? 18}px`, ...(d.mask ? { '--dot-mask': d.mask } : {}) },
    }));
  }
  if (o.star !== false) {
    const s = o.star ?? { x: '68%', y: '50%', size: 1500 };
    const star = h('div', {
      class: 'br-star',
      vars: { '--size': `calc(${s.size}px * var(--s))`, '--spin': `${s.spin ?? 60}s` },
      style: `left:calc(${s.x} - ${s.size / 2}px * var(--s));top:calc(${s.y} - ${s.size / 2}px * var(--s))`,
    });
    star.append(svg(starSvg({ points: 12, inner: 0.62, fill: s.color ?? (tone === 'red' ? '#ff1e3c' : '#1b1b22'), seed: o.seed ?? 'bg' })));
    el.append(star);
  }
  for (const [i, b] of (o.bands ?? []).entries()) {
    el.append(h('div', {
      class: 'br-band',
      vars: { '--band-h': `calc(${b.height}px * var(--s))`, '--band-bg': b.color, '--band-r': `${b.rotate ?? -14}deg`, '--clip': jagged(`${o.seed ?? 'band'}${i}`, { jx: 0.5, jy: 12, notches: 3 }) },
      style: `top:${b.top}`,
    }));
  }
  if (o.speedlines) el.append(h('div', { class: 'br-speedlines' }));
  return el;
}
