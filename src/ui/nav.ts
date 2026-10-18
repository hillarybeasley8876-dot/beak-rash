// Focus navigation for menus: keyboard / gamepad actions (via input.onAction) and mouse hover/click.
// The focused element always carries .is-focus (visible focus is a hard UI rule).
import type { Action } from '../core/input';

export interface NavItem {
  el: HTMLElement;
  confirm?(): void;
  /** Horizontal value change on vertical lists (settings rows). */
  left?(): void;
  right?(): void;
  disabled?: () => boolean;
  /** Activation of a disabled item (key or click): explain why (toast). */
  onDenied?(): void;
  /** Called whenever this item gains focus (previews). */
  onFocus?(): void;
}

export interface NavOpts {
  layout: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  wrap?: boolean;
  start?: number;
  sfx(id: string): void;
  onMove?(index: number, item: NavItem): void;
}

// Hover focus follows REAL pointer movement only: a cursor parked where a new screen draws its items
// must not steal the keyboard focus (browsers fire synthetic moves when content changes under it).
let lastX = Number.NaN;
let lastY = Number.NaN;
let lastMoveAt = -Infinity;
let tracking = false;

function trackPointer(): void {
  if (tracking) return;
  tracking = true;
  window.addEventListener('pointermove', (e) => {
    if (e.clientX === lastX && e.clientY === lastY) return;
    const first = Number.isNaN(lastX);
    lastX = e.clientX;
    lastY = e.clientY;
    if (!first) lastMoveAt = performance.now();
  }, { capture: true, passive: true });
}

export class Nav {
  index = 0;
  enabled = true;
  /** Pointer gate set by the shell (no clicks while a screen is leaving / under the wipe / a modal). */
  gate: () => boolean = () => true;
  private readonly born = performance.now();
  private readonly cleanups: Array<() => void> = [];

  constructor(readonly items: NavItem[], private readonly o: NavOpts) {
    trackPointer();
    items.forEach((item, i) => {
      item.el.dataset.nav = '1';
      const hover = (): void => {
        if (this.enabled && lastMoveAt > this.born && this.index !== i && this.gate()) this.focus(i);
      };
      const click = (e: MouseEvent): void => {
        if (!this.enabled || e.button !== 0 || !this.gate()) return;
        this.focus(i, true);
        this.activate();
      };
      item.el.addEventListener('pointermove', hover);
      item.el.addEventListener('click', click);
      this.cleanups.push(() => {
        item.el.removeEventListener('pointermove', hover);
        item.el.removeEventListener('click', click);
      });
    });
    this.focus(Math.min(o.start ?? 0, Math.max(0, items.length - 1)), true);
  }

  get current(): NavItem | undefined {
    return this.items[this.index];
  }

  focus(i: number, silent = false): void {
    if (this.items.length === 0) return;
    const prev = this.items[this.index];
    prev?.el.classList.remove('is-focus');
    this.index = i;
    const item = this.items[i];
    if (!item) return;
    item.el.classList.add('is-focus');
    item.el.setAttribute('aria-selected', 'true');
    if (prev && prev !== item) prev.el.removeAttribute('aria-selected');
    if (!silent) this.o.sfx('ui.move');
    item.onFocus?.();
    this.o.onMove?.(i, item);
  }

  /** Returns true when the action was consumed. */
  handle(a: Action): boolean {
    if (!this.enabled || this.items.length === 0) return false;
    const { layout } = this.o;
    const cols = layout === 'grid' ? Math.max(1, this.o.columns ?? 1) : 1;
    const item = this.current;
    if (a === 'confirm') {
      this.activate();
      return true;
    }
    if (layout === 'vertical' && (a === 'left' || a === 'right')) {
      const fn = a === 'left' ? item?.left : item?.right;
      if (!fn) return false;
      fn();
      return true;
    }
    const step =
      layout === 'vertical' ? (a === 'up' ? -1 : a === 'down' ? 1 : 0) :
      layout === 'horizontal' ? (a === 'left' ? -1 : a === 'right' ? 1 : 0) :
      a === 'left' ? -1 : a === 'right' ? 1 : a === 'up' ? -cols : a === 'down' ? cols : 0;
    if (step === 0) return false;
    this.move(step);
    return true;
  }

  activate(): void {
    const item = this.current;
    if (!item) return;
    if (item.disabled?.()) {
      this.o.sfx('ui.deny');
      item.el.classList.remove('br-anim-shake');
      void item.el.offsetWidth;
      item.el.classList.add('br-anim-shake');
      item.onDenied?.();
      return;
    }
    item.el.classList.remove('is-press');
    void item.el.offsetWidth;
    item.el.classList.add('is-press');
    this.o.sfx('ui.confirm');
    item.confirm?.();
  }

  /** Mouse activation of the focused item from a separate CTA element (honours the pointer gate). */
  pointerActivate(): void {
    if (this.enabled && this.gate()) this.activate();
  }

  private move(step: number): void {
    const n = this.items.length;
    let next = this.index + step;
    if (this.o.wrap !== false) next = ((next % n) + n) % n;
    else next = Math.max(0, Math.min(n - 1, next));
    if (next !== this.index) this.focus(next);
  }

  dispose(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
  }
}
