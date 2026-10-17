// Toast stack (top-right): short P5 strips that slide in, stack, and leave after a few seconds.
import { h } from './p5';

const LIFE_MS = 2600;
const MAX = 4;

export class Toasts {
  private readonly items: HTMLDivElement[] = [];

  constructor(private readonly layer: HTMLElement) {}

  show(text: string, kind: 'info' | 'warn' | 'meme' = 'info'): void {
    const el = h('div', { class: `br-toast is-${kind} is-in`, text, attrs: { role: 'status' } });
    this.layer.append(el);
    this.items.unshift(el);
    while (this.items.length > MAX) this.remove(this.items[this.items.length - 1] as HTMLDivElement, true);
    this.layout();
    setTimeout(() => this.remove(el), LIFE_MS);
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
    // Below the screens' top-right badges (coins, stats, tabs sit in the top ~13 % of the stage).
    let y = Math.max(24, Math.round(this.layer.clientHeight * 0.14));
    for (const el of this.items) {
      el.style.top = `${y}px`;
      y += (el.offsetHeight || 48) + 14;
    }
  }
}
