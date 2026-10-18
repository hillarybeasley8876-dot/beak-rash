// Gallery helpers: tiny DOM builder, sections, and the overflow checks run once fonts are loaded.

type Attrs = { class?: string; text?: string; style?: string; id?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, a: Attrs = {}, ...kids: Array<Node | string>): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (a.class) el.className = a.class;
  if (a.text !== undefined) el.textContent = a.text;
  if (a.style) el.style.cssText = a.style;
  if (a.id) el.id = a.id;
  for (const k of kids) el.append(k);
  return el;
}

const nav = document.querySelector<HTMLElement>('.cg-nav');
const main = document.querySelector<HTMLElement>('.cg-main');

/** A titled gallery section (also adds a jump link to the header). */
export function section(id: string, cn: string, en: string): HTMLElement {
  const sec = h('section', { class: 'cg-sec', id }, h('h2', { text: cn }, h('small', { text: en })));
  main?.append(sec);
  const link = h('a', { text: en });
  link.setAttribute('href', `#${id}`);
  nav?.append(link);
  return sec;
}

export const label = (text: string): HTMLElement => h('div', { class: 'cg-label', text });

export interface Overflow { where: string; text: string; why: string }

type Rule = { el: HTMLElement; where: string; text: string; test: () => string | null };
const rules: Rule[] = [];

/** Register a check; `test` returns a reason when the element does not fit. */
export function check(el: HTMLElement, where: string, text: string, test: () => string | null): void {
  rules.push({ el, where, text, test });
}

/** Rendered line count of a text block (content box height / line-height). */
export function lineCount(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  const height = el.getBoundingClientRect().height - pad;
  return Math.max(1, Math.round(height / (Number.isFinite(lh) && lh > 0 ? lh : 1)));
}

export const maxLines = (el: HTMLElement, n: number) => (): string | null => {
  const lines = lineCount(el);
  return lines > n ? `${lines} lines (max ${n})` : null;
};

/** Letters/digits on the last rendered line of a block whose text is one text node. */
export function lastLineGlyphs(el: HTMLElement): number {
  const node = el.firstChild;
  if (!(node instanceof Text)) return Infinity;
  const half = (parseFloat(getComputedStyle(el).lineHeight) || 20) / 2;
  const range = document.createRange();
  const glyphs: Array<{ top: number; ch: string }> = [];
  for (let i = 0; i < node.data.length; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rect = range.getClientRects()[0];
    if (rect) glyphs.push({ top: rect.top, ch: node.data[i] ?? '' });
  }
  const last = Math.max(...glyphs.map((g) => g.top));
  return glyphs.filter((g) => g.top > last - half && /[\p{L}\p{N}]/u.test(g.ch)).length;
}

/** A wrapped block must not end on a lone glyph (孤字: 「用。」 alone under a full line reads as a slip). */
export const noOrphan = (el: HTMLElement, min = 2) => (): string | null => {
  if (lineCount(el) < 2) return null;
  const n = lastLineGlyphs(el);
  return n < min ? `last line holds ${n} glyph (min ${min})` : null;
};

export const maxWidth = (el: HTMLElement, px: number) => (): string | null => {
  const w = el.getBoundingClientRect().width;
  return w > px + 0.5 ? `${Math.round(w)} px wide (max ${px})` : null;
};

/** Content wider than its box (nowrap rows). */
export const noOverflow = (el: HTMLElement) => (): string | null =>
  el.scrollWidth > el.clientWidth + 1 ? `content ${el.scrollWidth} px in a ${el.clientWidth} px box` : null;

/** Run every check, outline offenders and report (also on window.__content for scripts). */
export function runChecks(stats: Record<string, number>): Overflow[] {
  const found: Overflow[] = [];
  for (const r of rules) {
    const why = r.test();
    r.el.classList.toggle('is-over', why !== null);
    if (why) found.push({ where: r.where, text: r.text, why });
  }
  const summary = document.querySelector<HTMLElement>('.cg-summary');
  if (summary) {
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    summary.textContent = `${total} lines · ${rules.length} checks · ${found.length ? `${found.length} OVERFLOW` : 'all fit'}`;
    summary.classList.toggle('is-bad', found.length > 0);
  }
  for (const f of found) console.warn(`[content] overflow ${f.where}: «${f.text}» ${f.why}`);
  (window as unknown as { __content?: unknown }).__content = { ready: true, overflow: found, stats, checks: rules.length };
  return found;
}
