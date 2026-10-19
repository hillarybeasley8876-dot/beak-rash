// Font step of the single-file build. @fontsource ships every family as unicode-range slices
// (woff2 + a woff fallback). Keep only the slices whose range covers a character that occurs in
// the built game (JS/CSS/HTML), so every glyph the UI can show still comes from the same font
// file as before, and inline each kept slice's woff2 as a data: URL. The woff fallbacks are
// dropped: every browser that can run the game (WebGL2) reads woff2.
import fs from 'node:fs';
import path from 'node:path';

const JS_ESCAPE = /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g;
const CSS_ESCAPE = /\\([0-9a-fA-F]{1,6})\s?/g;

function decode(text, pattern) {
  return text.replace(pattern, (m, a, b, c) => {
    const cp = parseInt(a ?? b ?? c, 16);
    return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });
}

/** Sorted code points used by the sources (printable ASCII is always included). */
export function usedCodePoints({ js = [], css = [], html = [] }) {
  const set = new Set();
  for (let c = 0x20; c < 0x7f; c++) set.add(c);
  const texts = [...js.map((t) => decode(t, JS_ESCAPE)), ...css.map((t) => decode(t, CSS_ESCAPE)), ...html];
  for (const text of texts) {
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if (c > 0x7f) set.add(c);
    }
  }
  return Int32Array.from(set).sort();
}

function parseRanges(value) {
  return value.split(',').map((part) => {
    const p = part.trim().replace(/^U\+/i, '');
    if (p.includes('?')) return [parseInt(p.replaceAll('?', '0'), 16), parseInt(p.replaceAll('?', 'F'), 16)];
    const [lo, hi] = p.split('-');
    return [parseInt(lo, 16), parseInt(hi ?? lo, 16)];
  });
}

/** True when some code point of the sorted array `used` lies inside one of the ranges. */
function covers(ranges, used) {
  return ranges.some(([lo, hi]) => {
    let a = 0, b = used.length;
    while (a < b) {
      const mid = (a + b) >> 1;
      if (used[mid] < lo) a = mid + 1;
      else b = mid;
    }
    return a < used.length && used[a] <= hi;
  });
}

const WOFF2_SRC = /url\((["']?)([^)"']+\.woff2)\1\)\s*format\((["']?)woff2\3\)/;

/**
 * Rewrites every @font-face in `css` (whose url()s are relative to `cssDir`): unused slices are
 * removed, used ones get a single woff2 data: URL source. Throws on anything it cannot inline.
 */
export function inlineFonts(css, cssDir, used) {
  const stats = { kept: 0, dropped: 0, bytes: 0, families: new Map() };
  const out = css.replace(/@font-face\s*\{[^}]*\}/g, (rule) => {
    const range = /unicode-range\s*:\s*([^;}]+)/.exec(rule);
    if (range && !covers(parseRanges(range[1]), used)) {
      stats.dropped++;
      return '';
    }
    const woff2 = WOFF2_SRC.exec(rule);
    if (!woff2) throw new Error(`@font-face without a woff2 source: ${rule.slice(0, 160)}`);
    const data = fs.readFileSync(path.resolve(cssDir, woff2[2]));
    const family = /font-family\s*:\s*([^;}]+)/.exec(rule)?.[1].trim() ?? '?';
    stats.families.set(family, (stats.families.get(family) ?? 0) + data.length);
    stats.kept++;
    stats.bytes += data.length;
    const src = `src:url(data:font/woff2;base64,${data.toString('base64')})format("woff2")`;
    return rule.replace(/src\s*:[^;}]+/, src);
  });
  const leftover = [...out.matchAll(/url\(\s*(["']?)([^)"']*)\1\s*\)/g)].map((m) => m[2]).filter((u) => !/^(data:|#)/.test(u));
  if (leftover.length) throw new Error(`CSS still references external files: ${leftover.slice(0, 5).join(', ')}`);
  return { css: out, stats };
}
