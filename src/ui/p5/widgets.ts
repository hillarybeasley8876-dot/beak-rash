// Reusable P5 widgets: slanted buttons, segmented stat bars, sliders, choice pills, coin badge, hint bar.
import { fishSvg } from './art';
import { h, svg } from './dom';
import { jagged } from './shapes';

/** Slanted menu/button item. Navigable via ui/nav.ts (data-nav). */
export function button(label: string, opts: { sub?: string; className?: string; seed?: string } = {}): HTMLDivElement {
  const el = h('div', {
    class: `br-btn${opts.className ? ` ${opts.className}` : ''}`,
    data: { nav: '1' },
    vars: { '--clip': jagged(opts.seed ?? label, { jx: 2, jy: 10, notches: 1 }) },
    attrs: { role: 'button', 'aria-label': opts.sub ? `${label} ${opts.sub}` : label },
  });
  el.append(h('span', { class: 'br-btn-label', text: label }));
  if (opts.sub) el.append(h('span', { class: 'br-btn-sub', text: opts.sub }));
  return el;
}

/** 1..max rating as skewed segments. */
export function statBar(label: string, value: number, max = 5): HTMLDivElement {
  const bar = h('div', { class: 'br-stat' }, h('span', { class: 'br-stat-label', text: label }));
  const segs = h('span', { class: 'br-stat-segs' });
  for (let i = 0; i < max; i++) segs.append(h('i', { class: i < value ? 'is-on' : '' }));
  bar.append(segs);
  return bar;
}

export interface Meter { el: HTMLDivElement; set(v: number): void }

/** 0..1 value as 10 skewed ticks (volume, shake). */
export function meter(steps = 10): Meter {
  const el = h('div', { class: 'br-meter' });
  const ticks: HTMLElement[] = [];
  for (let i = 0; i < steps; i++) {
    const t = h('i', { vars: { '--h': `${40 + (60 * i) / (steps - 1)}%` } });
    ticks.push(t);
    el.append(t);
  }
  const num = h('b', { class: 'br-meter-num' });
  el.append(num);
  return {
    el,
    set(v) {
      const n = Math.round(v * steps);
      ticks.forEach((t, i) => t.classList.toggle('is-on', i < n));
      num.textContent = String(Math.round(v * 100));
    },
  };
}

export interface Choice { el: HTMLDivElement; set(i: number): void }

/** Row of option pills; exactly one lit. */
export function choice(options: string[]): Choice {
  const el = h('div', { class: 'br-choice' });
  const pills = options.map((o) => h('span', { class: 'br-pill', text: o }));
  el.append(...pills);
  return { el, set: (i) => pills.forEach((p, j) => p.classList.toggle('is-on', i === j)) };
}

export interface CoinBadge { el: HTMLDivElement; set(n: number): void }

export function coinBadge(amount: number): CoinBadge {
  const num = h('b', { class: 'br-coins-num', text: String(amount) });
  const el = h('div', { class: 'br-coins' }, svg(fishSvg(), 'br-coins-fish'), h('span', { class: 'br-coins-label', text: '小鱼干' }), num);
  return { el, set: (n) => { num.textContent = String(Math.round(n)); } };
}

/** `action` makes the hint clickable (the shell routes it like a key press: mouse users get a back button). */
export interface Hint { kb: string; pad: string; label: string; action?: 'confirm' | 'back' }

export const HINT_NAV: Hint = { kb: '↑↓', pad: '✚', label: '选择' };
export const HINT_LR: Hint = { kb: '←→', pad: '✚', label: '切换' };
export const HINT_OK: Hint = { kb: 'ENTER', pad: 'A', label: '确定', action: 'confirm' };
export const HINT_BACK: Hint = { kb: 'ESC', pad: 'B', label: '返回', action: 'back' };

/** Bottom hint strip; the shell toggles .is-pad on the root to show gamepad glyphs. */
export function hintBar(hints: Hint[]): HTMLDivElement {
  const el = h('div', { class: 'br-hints' });
  for (const hint of hints) {
    el.append(h('span', { class: `br-hint${hint.action ? ' is-click' : ''}`, data: hint.action ? { action: hint.action } : undefined },
      h('kbd', { class: 'br-key is-kb', text: hint.kb }),
      h('kbd', { class: 'br-key is-pad', text: hint.pad }),
      h('span', { text: hint.label })));
  }
  return el;
}
