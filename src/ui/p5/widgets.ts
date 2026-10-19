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

/** 1..max rating as skewed segments. With `ref` (e.g. the equipped bike) the segments gained are solid red,
 * the ones lost red-hatched ghosts, and a ±n badge follows the bar. */
export function statBar(label: string, value: number, max = 5, ref?: number): HTMLDivElement {
  const bar = h('div', { class: 'br-stat' }, h('span', { class: 'br-stat-label', text: label }));
  const segs = h('span', { class: 'br-stat-segs' });
  const base = ref ?? value;
  for (let i = 0; i < max; i++) {
    const cls = i < Math.min(value, base) ? 'is-on' : i < value ? 'is-on is-up' : i < base ? 'is-down' : '';
    segs.append(h('i', { class: cls }));
  }
  bar.append(segs);
  if (ref !== undefined && ref !== value) {
    const up = value > ref;
    bar.append(h('b', { class: `br-stat-delta ${up ? 'is-up' : 'is-down'}`, text: `${up ? '+' : '−'}${Math.abs(value - ref)}` }));
  }
  return bar;
}

export interface Meter { el: HTMLDivElement; set(v: number): void }

/** Mouse picking for a row of parts: press (or drag across) a part picks it; the click never bubbles
 * to the row (whose own click cycles the value). onPick's second argument tells a drag from a press. */
function pickable(el: HTMLElement, parts: HTMLElement[], onPick: (i: number, drag: boolean) => void, drag: boolean): void {
  el.classList.add('is-pickable');
  parts.forEach((p, i) => {
    p.addEventListener('pointerdown', (e) => {
      if (e.button === 0) onPick(i, false);
    });
    if (drag) p.addEventListener('pointerenter', (e) => {
      if (e.buttons === 1) onPick(i, true);
    });
  });
  el.addEventListener('click', (e) => e.stopPropagation());
}

/** 0..1 value as 10 skewed ticks (volume, shake). `onPick(i, drag)` makes ticks clickable / draggable. */
export function meter(steps = 10, onPick?: (i: number, drag: boolean) => void): Meter {
  const el = h('div', { class: 'br-meter' });
  const ticks: HTMLElement[] = [];
  for (let i = 0; i < steps; i++) {
    const t = h('i', { vars: { '--h': `${40 + (60 * i) / (steps - 1)}%` } });
    ticks.push(t);
    el.append(t);
  }
  if (onPick) pickable(el, ticks, onPick, true);
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

/** Row of option pills; exactly one lit. `onPick(i)` makes each pill clickable. */
export function choice(options: string[], onPick?: (i: number) => void): Choice {
  const el = h('div', { class: 'br-choice' });
  const pills = options.map((o) => h('span', { class: 'br-pill', text: o }));
  el.append(...pills);
  if (onPick) pickable(el, pills, onPick, false);
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

/** Keyboard + gamepad glyph pair; the shell toggles .is-pad on the root to show the right one. */
export function keyGlyph(kb: string, pad: string): HTMLElement[] {
  return [h('kbd', { class: 'br-key is-kb', text: kb }), h('kbd', { class: 'br-key is-pad', text: pad })];
}

/** Bottom hint strip. */
export function hintBar(hints: Hint[]): HTMLDivElement {
  const el = h('div', { class: 'br-hints' });
  for (const hint of hints) {
    el.append(h('span', { class: `br-hint${hint.action ? ' is-click' : ''}`, data: hint.action ? { action: hint.action } : undefined },
      ...keyGlyph(hint.kb, hint.pad), h('span', { text: hint.label })));
  }
  return el;
}
