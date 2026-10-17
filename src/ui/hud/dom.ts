// Tiny DOM helpers for the HUD: element factories plus cached writers that touch the DOM only when
// a value actually changes (the HUD runs every frame and must stay well under 0.5 ms).

type Tag = keyof HTMLElementTagNameMap;

export function el<K extends Tag>(tag: K, cls = '', parent?: Element | null, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.append(node);
  return node;
}

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Record<string, string | number> = {}, parent?: Element | null,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.append(node);
  return node;
}

/** Cached writer for one element: every setter is a no-op when the value is unchanged. */
export class W {
  private styles = new Map<string, string>();
  private attrs = new Map<string, string>();
  private classes = new Map<string, boolean>();
  private lastText: string | null = null;

  constructor(readonly node: HTMLElement | SVGElement) {}

  text(v: string): void {
    if (this.lastText === v) return;
    this.lastText = v;
    this.node.textContent = v;
  }

  style(prop: string, v: string): void {
    if (this.styles.get(prop) === v) return;
    this.styles.set(prop, v);
    this.node.style.setProperty(prop, v);
  }

  tf(v: string): void {
    this.style('transform', v);
  }

  op(v: number): void {
    this.style('opacity', v >= 0.999 ? '1' : v <= 0.001 ? '0' : v.toFixed(3));
  }

  /** Show/hide without layout. 'inherit' (not 'visible') so a hidden ancestor still hides it. */
  show(on: boolean): void {
    this.style('visibility', on ? 'inherit' : 'hidden');
  }

  attr(name: string, v: string): void {
    if (this.attrs.get(name) === v) return;
    this.attrs.set(name, v);
    this.node.setAttribute(name, v);
  }

  cls(name: string, on: boolean): void {
    if (this.classes.get(name) === on) return;
    this.classes.set(name, on);
    this.node.classList.toggle(name, on);
  }

  /** Forget cached values (after the element was rebuilt or restyled from elsewhere). */
  reset(): void {
    this.styles.clear();
    this.attrs.clear();
    this.classes.clear();
    this.lastText = null;
  }
}

export const w = (node: HTMLElement | SVGElement): W => new W(node);

/** Pixel value rounded to half a pixel (fewer distinct transform strings, crisp text). */
export const px = (v: number): string => `${Math.round(v * 2) / 2}px`;
