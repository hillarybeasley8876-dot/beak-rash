// Toast lane: P5 strips with a per-kind star icon, right-aligned under the screens' top-right badge
// (stage coordinates, so they never drift onto lists at other sizes). Newest on top, at most two.
// ui-hud mirrors TOP / the strip pitch in hud/cutins/chips.ts (its chip column sits below the lane).
// The shell quiets the lane during KO cinematics, like the HUD.
import { h, starSvg, svg } from './p5';

type Kind = 'info' | 'warn' | 'meme';

const LIFE_MS = 2600;
const MAX = 2;
const TOP = 136;
const GAP = 12;
const ICON: Record<Kind, { glyph: string; fill: string }> = {
  info: { glyph: 'i', fill: '#ffffff' },
  warn: { glyph: '!', fill: '#ffe600' },
  meme: { glyph: '鹕', fill: '#e5191c' },
};

export class Toasts {
  private readonly lane: HTMLDivElement;
  private readonly items: HTMLDivElement[] = [];
  private quiet = false;

  constructor(layer: HTMLElement) {
    this.lane = h('div', { class: 'br-stage br-toast-lane' });
    layer.append(this.lane);
  }

  show(text: string, kind: Kind = 'info'): void {
    const icon = ICON[kind];
    const el = h('div', { class: `br-toast is-${kind} is-in`, attrs: { role: 'status' } },
      h('i', { class: 'br-toast-icon' },
        svg(starSvg({ points: 10, inner: 0.7, fill: icon.fill, stroke: '#0b0b0f', strokeWidth: 12, seed: `toast-${kind}` })),
        h('b', { text: icon.glyph })),
      h('span', { class: 'br-toast-text', text }));
    this.lane.append(el);
    this.items.unshift(el);
    while (this.items.length > MAX) this.remove(this.items[this.items.length - 1] as HTMLDivElement, true);
    this.layout();
    setTimeout(() => this.remove(el), LIFE_MS);
  }

  /** Hide the lane (toasts keep their timers) while a cinematic owns the screen. */
  setQuiet(quiet: boolean): void {
    if (quiet === this.quiet) return;
    this.quiet = quiet;
    this.lane.classList.toggle('is-quiet', quiet);
  }

  private remove(el: HTMLDivElement, now = false): void {
    const i = this.items.indexOf(el);
    if (i < 0) return;
    this.items.splice(i, 1);
    this.layout();
    if (now) {
      el.remove();
      return;
    }
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 220);
  }

  private layout(): void {
    let y = TOP;
    for (const el of this.items) {
      el.style.top = `${y}px`;
      y += (el.offsetHeight || 58) + GAP;
    }
  }
}
