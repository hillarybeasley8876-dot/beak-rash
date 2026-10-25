// Tiny DOM builders for the UI (no framework). Text goes through textContent; SVG markup is only ever
// built from our own constants, numbers and roster colours (never from user or save data).
import { reducedMotion as coreReducedMotion } from '../../core/motion';

export type Child = Node | string | number | null | undefined | false;

export interface Attrs {
  class?: string;
  style?: string;
  text?: string;
  title?: string;
  data?: Record<string, string | number>;
  vars?: Record<string, string | number>;
  attrs?: Record<string, string>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, a?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (a) {
    if (a.class) el.className = a.class;
    if (a.style) el.style.cssText = a.style;
    if (a.text !== undefined) el.textContent = a.text;
    if (a.title) el.title = a.title;
    if (a.data) for (const [k, v] of Object.entries(a.data)) el.dataset[k] = String(v);
    if (a.vars) setVars(el, a.vars);
    if (a.attrs) for (const [k, v] of Object.entries(a.attrs)) el.setAttribute(k, v);
    if (a.on) {
      for (const [type, fn] of Object.entries(a.on)) el.addEventListener(type, fn as EventListener);
    }
  }
  append(el, ...children);
  return el;
}

export function append(el: Element, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function setVars(el: HTMLElement | SVGElement, vars: Record<string, string | number>): void {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k.startsWith('--') ? k : `--${k}`, String(v));
}

/** Parse trusted SVG markup (our own generators) into an element. */
export function svg(markup: string, cls?: string): SVGSVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  const node = tpl.content.firstElementChild;
  if (!(node instanceof SVGSVGElement)) throw new Error('[ui] svg(): markup is not an <svg>');
  if (cls) node.setAttribute('class', cls);
  return node;
}

export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** In-game 动态效果 setting first (减弱 / 完整), else the OS prefers-reduced-motion flag. */
export function reducedMotion(): boolean {
  return coreReducedMotion();
}

/** Await a Web Animation without throwing when it is cancelled (screen torn down mid-flight). */
export async function settle(anim: Animation): Promise<void> {
  try {
    await anim.finished;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) console.error('[ui] animation failed', err);
  }
}
